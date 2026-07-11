import "server-only";

import type { Playlist, QueueItem, Song } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertSong } from "@/lib/spotify/server";

type SongRow = {
  id: string;
  spotify_track_id: string;
  spotify_uri: string;
  title: string;
  artist: string | null;
  artists: Array<{ id: string; name: string }> | null;
  album: string | null;
  cover_url: string | null;
  duration_ms: number | null;
  explicit: boolean | null;
  popularity: number | null;
  external_url: string | null;
  preview_url: string | null;
};

type PlaylistRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  visibility: "private" | "shared";
  created_at: string;
  updated_at: string;
};

export function songFromRow(row: SongRow): Song {
  return {
    id: row.id,
    spotifyTrackId: row.spotify_track_id,
    spotifyUri: row.spotify_uri,
    title: row.title,
    artist: row.artist ?? "Unknown Artist",
    artists: row.artists ?? [],
    album: row.album ?? undefined,
    coverUrl: row.cover_url,
    durationMs: row.duration_ms ?? 0,
    explicit: row.explicit ?? false,
    popularity: row.popularity ?? undefined,
    externalUrl: row.external_url ?? undefined,
    previewUrl: row.preview_url,
  };
}

export function playlistFromRow(row: PlaylistRow, songIds: string[] = []): Playlist {
  return {
    id: row.id,
    ownerId: row.owner_id,
    userId: row.owner_id,
    name: row.name,
    description: row.description ?? undefined,
    coverUrl: row.cover_url,
    visibility: row.visibility,
    songIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function uniqueSongs(songs: Song[]) {
  const seen = new Set<string>();
  return songs.filter((song) => {
    const key = song.id ?? song.spotifyTrackId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function requireAdmin() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin is not configured.");
  return admin;
}

export async function getLibrarySnapshot(userId: string) {
  const admin = requireAdmin();

  const [likedResult, playlistsResult, playlistSongsResult, recentResult, queueResult] =
    await Promise.all([
      admin
        .from("liked_songs")
        .select("song:songs(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      admin
        .from("playlists")
        .select("*")
        .or(`owner_id.eq.${userId},visibility.eq.shared`)
        .order("created_at", { ascending: false }),
      admin
        .from("playlist_songs")
        .select("playlist_id,song_id")
        .order("position", { ascending: true }),
      admin
        .from("recently_played")
        .select("song:songs(*)")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(30),
      admin
        .from("queue_items")
        .select("id,position,song:songs(*)")
        .eq("user_id", userId)
        .order("position", { ascending: true }),
    ]);

  if (likedResult.error) throw likedResult.error;
  if (playlistsResult.error) throw playlistsResult.error;
  if (playlistSongsResult.error) throw playlistSongsResult.error;
  if (recentResult.error) throw recentResult.error;
  if (queueResult.error) throw queueResult.error;

  const playlistSongMap = new Map<string, string[]>();
  (playlistSongsResult.data ?? []).forEach((item) => {
    const ids = playlistSongMap.get(item.playlist_id) ?? [];
    ids.push(item.song_id);
    playlistSongMap.set(item.playlist_id, ids);
  });

  const likedSongs = (likedResult.data ?? [])
      .map((item) => item.song as unknown as SongRow | null)
      .filter(Boolean)
      .map((song) => songFromRow(song!));

  const recentlyPlayed = (recentResult.data ?? [])
      .map((item) => item.song as unknown as SongRow | null)
      .filter(Boolean)
      .map((song) => songFromRow(song!));

  return {
    likedSongs: uniqueSongs(likedSongs),
    playlists: (playlistsResult.data ?? []).map((playlist) =>
      playlistFromRow(playlist as PlaylistRow, playlistSongMap.get(playlist.id) ?? []),
    ),
    recentlyPlayed: uniqueSongs(recentlyPlayed),
    queue: (queueResult.data ?? [])
      .map((item) => {
        const song = item.song as unknown as SongRow | null;
        if (!song) return null;
        return {
          id: item.id,
          position: item.position,
          song: songFromRow(song),
        } satisfies QueueItem;
      })
      .filter(Boolean),
  };
}

export async function toggleLikedSong(userId: string, song: Song) {
  const admin = requireAdmin();
  const savedSong = await upsertSong(song);
  if (!savedSong.id) throw new Error("Song upsert failed.");

  const { data: existing, error: readError } = await admin
    .from("liked_songs")
    .select("id")
    .eq("user_id", userId)
    .eq("song_id", savedSong.id)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const { error } = await admin
      .from("liked_songs")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return { liked: false };
  }

  const { error } = await admin
    .from("liked_songs")
    .insert({ user_id: userId, song_id: savedSong.id });
  if (error) throw error;
  return { liked: true, song: savedSong };
}

export async function createPlaylistForUser(
  userId: string,
  input: { name: string; description?: string; visibility?: "private" | "shared" },
) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("playlists")
    .insert({
      owner_id: userId,
      name: input.name,
      description: input.description,
      visibility: input.visibility ?? "shared",
    })
    .select("*")
    .single();

  if (error) throw error;
  return playlistFromRow(data as PlaylistRow);
}

export async function renamePlaylistForUser(userId: string, playlistId: string, name: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("playlists")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", playlistId)
    .eq("owner_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return playlistFromRow(data as PlaylistRow);
}

export async function deletePlaylistForUser(userId: string, playlistId: string) {
  const admin = requireAdmin();
  const { error } = await admin
    .from("playlists")
    .delete()
    .eq("id", playlistId)
    .eq("owner_id", userId);
  if (error) throw error;
}

export async function addSongToPlaylistForUser(
  userId: string,
  playlistId: string,
  song: Song,
) {
  const admin = requireAdmin();
  const savedSong = await upsertSong(song);
  if (!savedSong.id) throw new Error("Song upsert failed.");

  const { data: playlist, error: playlistError } = await admin
    .from("playlists")
    .select("id,owner_id,visibility")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) throw new Error("Playlist not found.");
  if (playlist.owner_id !== userId && playlist.visibility !== "shared") {
    throw new Error("You cannot edit this playlist.");
  }

  const { count, error: countError } = await admin
    .from("playlist_songs")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlistId);
  if (countError) throw countError;

  const { error } = await admin.from("playlist_songs").insert({
    playlist_id: playlistId,
    song_id: savedSong.id,
    position: count ?? 0,
    added_by: userId,
  });

  if (error) throw error;
  return savedSong;
}

export async function removeSongFromPlaylistForUser(
  userId: string,
  playlistId: string,
  songId: string,
) {
  const admin = requireAdmin();
  const { data: playlist, error: playlistError } = await admin
    .from("playlists")
    .select("id,owner_id,visibility")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) throw new Error("Playlist not found.");
  if (playlist.owner_id !== userId && playlist.visibility !== "shared") {
    throw new Error("You cannot edit this playlist.");
  }

  const { error } = await admin
    .from("playlist_songs")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("song_id", songId);
  if (error) throw error;
}

export async function addQueueItemForUser(userId: string, song: Song) {
  const admin = requireAdmin();
  const savedSong = await upsertSong(song);
  if (!savedSong.id) throw new Error("Song upsert failed.");

  const { count, error: countError } = await admin
    .from("queue_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw countError;

  const { data, error } = await admin
    .from("queue_items")
    .insert({
      user_id: userId,
      song_id: savedSong.id,
      position: count ?? 0,
    })
    .select("id,position")
    .single();

  if (error) throw error;
  return { id: data.id as string, position: data.position as number, song: savedSong };
}

export async function removeQueueItemForUser(userId: string, queueItemId: string) {
  const admin = requireAdmin();
  const { error } = await admin
    .from("queue_items")
    .delete()
    .eq("id", queueItemId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function clearQueueForUser(userId: string) {
  const admin = requireAdmin();
  const { error } = await admin.from("queue_items").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function addRecentlyPlayedForUser(userId: string, song: Song, progressMs = 0) {
  const admin = requireAdmin();
  const savedSong = await upsertSong(song);
  if (!savedSong.id) throw new Error("Song upsert failed.");

  const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
  const { data: duplicate, error: duplicateError } = await admin
    .from("recently_played")
    .select("id")
    .eq("user_id", userId)
    .eq("song_id", savedSong.id)
    .gte("played_at", thirtySecondsAgo)
    .maybeSingle();

  if (duplicateError) throw duplicateError;
  if (duplicate) return savedSong;

  const { error } = await admin.from("recently_played").insert({
    user_id: userId,
    song_id: savedSong.id,
    progress_ms: progressMs,
  });
  if (error) throw error;
  return savedSong;
}

export async function clearRecentlyPlayedForUser(userId: string) {
  const admin = requireAdmin();
  const { error } = await admin.from("recently_played").delete().eq("user_id", userId);
  if (error) throw error;
}
