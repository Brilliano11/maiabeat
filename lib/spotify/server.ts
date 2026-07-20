import "server-only";

import type {
  AlbumItem,
  ArtistItem,
  PlaylistItem,
  SearchPagination,
  SearchSection,
  Song,
  SpotifyProfile,
} from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const spotifyScopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-library-read",
  "user-library-modify",
].join(" ");

type SpotifyTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope: string;
  expires_in: number;
};

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album?: {
    name?: string;
    images?: Array<{ url: string }>;
  };
  duration_ms: number;
  explicit?: boolean;
  popularity?: number;
  external_urls?: { spotify?: string };
  preview_url?: string | null;
};

type SpotifyArtist = {
  id: string;
  uri?: string;
  name: string;
  images?: Array<{ url: string }>;
  followers?: { total?: number };
  genres?: string[];
  popularity?: number;
  external_urls?: { spotify?: string };
};

type SpotifyAlbum = {
  id: string;
  uri?: string;
  name: string;
  artists?: Array<{ id: string; name: string }>;
  images?: Array<{ url: string }>;
  release_date?: string;
  total_tracks?: number;
  album_type?: string;
  external_urls?: { spotify?: string };
};

type SpotifyPlaylist = {
  id: string;
  uri?: string;
  name: string;
  description?: string | null;
  images?: Array<{ url: string }>;
  owner?: { display_name?: string };
  tracks?: { total?: number };
  external_urls?: { spotify?: string };
};

type SpotifyPaging<T> = {
  items?: T[];
  limit?: number;
  offset?: number;
  total?: number;
};

export type SpotifySearchType =
  | "track"
  | "artist"
  | "album"
  | "playlist"
  | "track,artist,album"
  | "track,artist,album,playlist";
type SpotifySearchOptions = {
  type: SpotifySearchType;
  limit: number;
  offset?: number;
};

let clientCredentialsToken: { accessToken: string; expiresAt: number } | null = null;
const userTokenRefreshPromises = new Map<string, Promise<{ accessToken: string; expiresAt: string }>>();

function requireSpotifyEnv() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Spotify env is not configured.");
  }

  return { clientId, clientSecret, redirectUri };
}

function tokenAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function parseSpotifyJson<T>(text: string, fallback: string): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallback);
  }
}

export function getSpotifyAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = requireSpotifyEnv();
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", spotifyScopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeCodeForToken(code: string) {
  const { clientId, clientSecret, redirectUri } = requireSpotifyEnv();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: tokenAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Failed to exchange Spotify code.");
  return (await response.json()) as SpotifyTokenResponse;
}

export async function fetchSpotifyProfile(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Failed to fetch Spotify profile.");
  return (await response.json()) as SpotifyProfile;
}

async function refreshSpotifyTokenUncached(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin is not configured.");

  const { data: connection, error } = await admin
    .from("spotify_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !connection) throw new Error("Spotify is not connected.");

  const expiresAt = new Date(connection.expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) {
    return {
      accessToken: connection.access_token as string,
      expiresAt: connection.expires_at as string,
    };
  }

  const { clientId, clientSecret } = requireSpotifyEnv();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: tokenAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token as string,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Spotify token refresh failed.");

  const token = (await response.json()) as SpotifyTokenResponse;
  const nextExpiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { error: updateError } = await admin
    .from("spotify_connections")
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? connection.refresh_token,
      token_type: token.token_type,
      scope: token.scope,
      expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) throw new Error("Could not save refreshed Spotify token.");

  return { accessToken: token.access_token, expiresAt: nextExpiresAt };
}

export async function refreshSpotifyToken(userId: string) {
  const existing = userTokenRefreshPromises.get(userId);
  if (existing) return existing;

  const promise = refreshSpotifyTokenUncached(userId).finally(() => {
    userTokenRefreshPromises.delete(userId);
  });
  userTokenRefreshPromises.set(userId, promise);
  return promise;
}

export async function getFreshSpotifyAccessToken(userId: string) {
  return refreshSpotifyToken(userId);
}

export function mapSpotifyTrackToSong(track: SpotifyTrack): Song {
  return {
    spotifyTrackId: track.id,
    spotifyUri: track.uri,
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    artists: track.artists.map((artist) => ({ id: artist.id, name: artist.name })),
    album: track.album?.name,
    coverUrl: track.album?.images?.[0]?.url ?? "/icons/default-cover.svg",
    durationMs: track.duration_ms,
    explicit: track.explicit,
    popularity: track.popularity,
    externalUrl: track.external_urls?.spotify,
    previewUrl: track.preview_url ?? null,
  };
}

export function mapSpotifyArtist(artist: SpotifyArtist): ArtistItem {
  return {
    id: artist.id,
    spotifyUri: artist.uri,
    name: artist.name,
    imageUrl: artist.images?.[0]?.url ?? null,
    followers: artist.followers?.total,
    genres: artist.genres ?? [],
    popularity: artist.popularity,
    externalUrl: artist.external_urls?.spotify,
  };
}

export function mapSpotifyAlbum(album: SpotifyAlbum): AlbumItem {
  return {
    id: album.id,
    spotifyUri: album.uri,
    title: album.name,
    artist: album.artists?.map((artist) => artist.name).join(", ") ?? "Unknown Artist",
    artists: album.artists ?? [],
    coverUrl: album.images?.[0]?.url ?? "/icons/default-cover.svg",
    releaseDate: album.release_date,
    totalTracks: album.total_tracks,
    albumType: album.album_type,
    externalUrl: album.external_urls?.spotify,
  };
}

export function mapSpotifyPlaylist(playlist: SpotifyPlaylist): PlaylistItem {
  return {
    id: playlist.id,
    spotifyUri: playlist.uri,
    name: playlist.name,
    description: playlist.description ?? undefined,
    coverUrl: playlist.images?.[0]?.url ?? "/icons/default-cover.svg",
    owner: playlist.owner?.display_name,
    totalTracks: playlist.tracks?.total,
    route: `/playlist/${playlist.id}`,
    externalUrl: playlist.external_urls?.spotify,
  };
}

export async function upsertSong(song: Song) {
  const admin = createSupabaseAdminClient();
  if (!admin) return song;

  const { data, error } = await admin
    .from("songs")
    .upsert(
      {
        spotify_track_id: song.spotifyTrackId,
        spotify_uri: song.spotifyUri,
        title: song.title,
        artist: song.artist,
        artists: song.artists ?? [],
        album: song.album,
        cover_url: song.coverUrl,
        duration_ms: song.durationMs,
        explicit: song.explicit ?? false,
        popularity: song.popularity,
        external_url: song.externalUrl,
        preview_url: song.previewUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "spotify_track_id" },
    )
    .select("id")
    .single();

  if (error) throw error;
  return { ...song, id: data.id as string };
}

export async function searchSpotifyTracksForUser(
  userId: string,
  query: string,
  options: SpotifySearchOptions,
) {
  const { accessToken } = await getFreshSpotifyAccessToken(userId);
  return searchSpotifyTracksWithToken(query, accessToken, options);
}

async function getClientCredentialsAccessToken() {
  if (clientCredentialsToken && clientCredentialsToken.expiresAt > Date.now() + 60_000) {
    return clientCredentialsToken.accessToken;
  }

  const { clientId, clientSecret } = requireSpotifyEnv();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: tokenAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  const text = await response.text();
  const body = parseSpotifyJson<SpotifyTokenResponse & { error_description?: string }>(
    text,
    "Spotify token response was not valid JSON.",
  );

  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description ?? "Spotify app search token failed.");
  }

  clientCredentialsToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };

  return clientCredentialsToken.accessToken;
}

// Spotify endpoints return many shapes; route handlers narrow the payload they use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function spotifyFetchWithClientCredentials(path: string, init: RequestInit = {}): Promise<any> {
  const accessToken = await getClientCredentialsAccessToken();
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const body = parseSpotifyJson<{
    error?: { message?: string };
    error_description?: string;
  }>(text, "Spotify catalog response was not valid JSON.");

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.error_description ??
      "Spotify catalog request failed.";
    throw new Error(message);
  }

  return body;
}

export async function searchSpotifyTracksWithClientCredentials(
  query: string,
  options: SpotifySearchOptions,
) {
  const accessToken = await getClientCredentialsAccessToken();
  return searchSpotifyTracksWithToken(query, accessToken, options);
}

async function searchSpotifyTracksWithToken(
  query: string,
  accessToken: string,
  options: SpotifySearchOptions,
) {
  const data = await spotifySearchRequest(query, accessToken, options);
  const songs = (data.tracks?.items ?? []).map(mapSpotifyTrackToSong);

  return Promise.all(
    songs.map(async (song) => {
      try {
        return await upsertSong(song);
      } catch {
        return song;
      }
    }),
  );
}

async function spotifySearchRequest(
  query: string,
  accessToken: string,
  options: SpotifySearchOptions,
) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", options.type);
  url.searchParams.set("market", "ID");
  url.searchParams.set("limit", String(options.limit));
  url.searchParams.set("offset", String(options.offset ?? 0));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const text = await response.text();
  const body = parseSpotifyJson<{
    error?: { message?: string };
    error_description?: string;
    tracks?: SpotifyPaging<SpotifyTrack>;
    artists?: SpotifyPaging<SpotifyArtist>;
    albums?: SpotifyPaging<SpotifyAlbum>;
    playlists?: SpotifyPaging<SpotifyPlaylist | null>;
  }>(text, "Spotify search response was not valid JSON.");

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.error_description ??
      `Spotify search failed (${response.status}).`;
    throw new Error(message);
  }

  return body ?? {};
}

function paginationFromPaging<T>(
  paging: SpotifyPaging<T> | undefined,
  fallbackLimit: number,
  fallbackOffset: number,
): SearchPagination {
  const limit = paging?.limit ?? fallbackLimit;
  const offset = paging?.offset ?? fallbackOffset;
  const total = paging?.total ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;
  return {
    limit,
    offset,
    total,
    nextOffset,
    hasMore: nextOffset !== null,
  };
}

function sectionFromPaging<TSource, TMapped>(
  paging: SpotifyPaging<TSource> | undefined,
  mapper: (item: TSource) => TMapped,
  limit: number,
  offset: number,
): SearchSection<TMapped> {
  return {
    items: (paging?.items ?? []).filter(Boolean).map(mapper),
    pagination: paginationFromPaging(paging, limit, offset),
  };
}

export async function searchSpotifyCatalogWithToken(
  query: string,
  accessToken: string,
  options: SpotifySearchOptions,
) {
  const data = await spotifySearchRequest(query, accessToken, options);
  const limit = options.limit;
  const offset = options.offset ?? 0;
  const tracks = sectionFromPaging(data.tracks, mapSpotifyTrackToSong, limit, offset);

  tracks.items = await Promise.all(
    tracks.items.map(async (song) => {
      try {
        return await upsertSong(song);
      } catch {
        return song;
      }
    }),
  );

  return {
    tracks,
    artists: sectionFromPaging(data.artists, mapSpotifyArtist, limit, offset),
    albums: sectionFromPaging(data.albums, mapSpotifyAlbum, limit, offset),
    playlists: sectionFromPaging(
      data.playlists as SpotifyPaging<SpotifyPlaylist> | undefined,
      mapSpotifyPlaylist,
      limit,
      offset,
    ),
  };
}

export async function searchSpotifyCatalogForUser(
  userId: string,
  query: string,
  options: SpotifySearchOptions,
) {
  const { accessToken } = await getFreshSpotifyAccessToken(userId);
  return searchSpotifyCatalogWithToken(query, accessToken, options);
}

export async function searchSpotifyCatalogWithClientCredentials(
  query: string,
  options: SpotifySearchOptions,
) {
  const accessToken = await getClientCredentialsAccessToken();
  return searchSpotifyCatalogWithToken(query, accessToken, options);
}

// Spotify endpoints return many shapes; route handlers narrow the payload they use.
export async function spotifyFetchForUser(
  userId: string,
  path: string,
  init: RequestInit = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { accessToken } = await getFreshSpotifyAccessToken(userId);
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 204) return null;

  const text = await response.text();
  const body = parseSpotifyJson<{
    error?: { message?: string };
    error_description?: string;
  }>(text, "Spotify playback response was not valid JSON.");

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.error_description ??
      "Spotify request failed.";
    throw new Error(message);
  }

  return body;
}

export function formatSpotifyPlaybackError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const normalized = message.toLowerCase();

  if (normalized.includes("premium") || normalized.includes("restricted")) {
    return "Spotify Premium is required to play full tracks in Maiabeat.";
  }

  if (
    normalized.includes("server error") ||
    normalized.includes("no active device") ||
    normalized.includes("device not found") ||
    normalized.includes("device_id") ||
    normalized.includes("device id")
  ) {
    return "Spotify connected. Pick a song in Maiabeat or open Spotify once to wake the player.";
  }

  return message || fallback;
}
