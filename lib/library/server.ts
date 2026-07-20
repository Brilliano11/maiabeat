import "server-only";

import type {
  PlayerSnapshot,
  Playlist,
  PlaylistUpdate,
  QueueItem,
  RepeatMode,
  Song,
} from "@/lib/types";
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

async function nextPlaylistSongPosition(playlistId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("playlist_songs")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const position = typeof data?.position === "number" ? data.position : -1;
  return position + 1;
}

async function nextQueuePosition(userId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("queue_items")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const position = typeof data?.position === "number" ? data.position : -1;
  return position + 1;
}

export async function getLibrarySnapshot(userId: string) {
  const admin = requireAdmin();

  const [
    likedResult,
    playlistsResult,
    playlistSongsResult,
    recentResult,
    queueResult,
    playerStateResult,
  ] = await Promise.all([
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
        .select("playlist_id,song_id,song:songs(*)")
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
      admin
        .from("player_states")
        .select(
          "current_index,is_playing,progress_ms,shuffle_enabled,repeat_mode,current_song:songs(*)",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (likedResult.error) throw likedResult.error;
  if (playlistsResult.error) throw playlistsResult.error;
  if (playlistSongsResult.error) throw playlistSongsResult.error;
  if (recentResult.error) throw recentResult.error;
  if (queueResult.error) throw queueResult.error;
  if (playerStateResult.error) throw playerStateResult.error;

  const playlistSongMap = new Map<string, string[]>();
  const playlistSongs: Song[] = [];
  (playlistSongsResult.data ?? []).forEach((item) => {
    const ids = playlistSongMap.get(item.playlist_id) ?? [];
    ids.push(item.song_id);
    playlistSongMap.set(item.playlist_id, ids);
    const song = item.song as unknown as SongRow | null;
    if (song) playlistSongs.push(songFromRow(song));
  });

  const likedSongs = (likedResult.data ?? [])
      .map((item) => item.song as unknown as SongRow | null)
      .filter(Boolean)
      .map((song) => songFromRow(song!));

  const recentlyPlayed = (recentResult.data ?? [])
      .map((item) => item.song as unknown as SongRow | null)
      .filter(Boolean)
      .map((song) => songFromRow(song!));

  const rawPlayerState = playerStateResult.data as
    | {
        current_index: number | null;
        is_playing: boolean | null;
        progress_ms: number | null;
        shuffle_enabled: boolean | null;
        repeat_mode: RepeatMode | null;
        current_song: SongRow | SongRow[] | null;
      }
    | null;
  const currentSongRow = Array.isArray(rawPlayerState?.current_song)
    ? rawPlayerState.current_song[0]
    : rawPlayerState?.current_song;
  const playerState: PlayerSnapshot | null = rawPlayerState
    ? {
        currentSong: currentSongRow ? songFromRow(currentSongRow) : null,
        currentIndex: rawPlayerState.current_index ?? 0,
        isPlaying: rawPlayerState.is_playing ?? false,
        progressMs: rawPlayerState.progress_ms ?? 0,
        shuffleEnabled: rawPlayerState.shuffle_enabled ?? false,
        repeatMode: rawPlayerState.repeat_mode ?? "off",
      }
    : null;

  return {
    likedSongs: uniqueSongs(likedSongs),
    playlists: (playlistsResult.data ?? []).map((playlist) =>
      playlistFromRow(playlist as PlaylistRow, playlistSongMap.get(playlist.id) ?? []),
    ),
    recentlyPlayed: uniqueSongs(recentlyPlayed),
    playlistSongs: uniqueSongs(playlistSongs),
    playerState,
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

export async function updatePlaylistForUser(
  userId: string,
  playlistId: string,
  input: PlaylistUpdate,
) {
  const admin = requireAdmin();
  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description || null;
  if (input.coverUrl !== undefined) update.cover_url = input.coverUrl;
  if (input.visibility !== undefined) update.visibility = input.visibility;

  const { data, error } = await admin
    .from("playlists")
    .update(update)
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
  if (playlist.owner_id !== userId) {
    throw new Error("You cannot edit this playlist.");
  }

  const { data: existing, error: existingError } = await admin
    .from("playlist_songs")
    .select("id")
    .eq("playlist_id", playlistId)
    .eq("song_id", savedSong.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return savedSong;

  const { error } = await admin.from("playlist_songs").insert({
    playlist_id: playlistId,
    song_id: savedSong.id,
    position: await nextPlaylistSongPosition(playlistId),
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
  if (playlist.owner_id !== userId) {
    throw new Error("You cannot edit this playlist.");
  }

  const { error } = await admin
    .from("playlist_songs")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("song_id", songId);
  if (error) throw error;
}

export async function reorderPlaylistSongsForUser(
  userId: string,
  playlistId: string,
  songIds: string[],
) {
  const admin = requireAdmin();
  const { data: playlist, error: playlistError } = await admin
    .from("playlists")
    .select("id,owner_id")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) throw new Error("Playlist not found.");
  if (playlist.owner_id !== userId) throw new Error("You cannot edit this playlist.");

  const { data: rows, error: rowsError } = await admin
    .from("playlist_songs")
    .select("id,song_id")
    .eq("playlist_id", playlistId);
  if (rowsError) throw rowsError;

  const currentIds = new Set((rows ?? []).map((row) => row.song_id as string));
  const uniqueRequestedIds = new Set(songIds);
  if (
    songIds.length !== currentIds.size ||
    uniqueRequestedIds.size !== songIds.length ||
    songIds.some((songId) => !currentIds.has(songId))
  ) {
    throw new Error("Playlist order does not match its songs.");
  }

  const rowBySongId = new Map(
    (rows ?? []).map((row) => [row.song_id as string, row.id as string]),
  );
  const temporaryOffset = 100_000;
  for (const [index, songId] of songIds.entries()) {
    const { error } = await admin
      .from("playlist_songs")
      .update({ position: temporaryOffset + index })
      .eq("id", rowBySongId.get(songId));
    if (error) throw error;
  }
  for (const [position, songId] of songIds.entries()) {
    const { error } = await admin
      .from("playlist_songs")
      .update({ position })
      .eq("id", rowBySongId.get(songId));
    if (error) throw error;
  }

  return songIds;
}

type QueuePlayerStateInput = {
  currentTrackId?: string | null;
  currentIndex?: number;
  isPlaying?: boolean;
  progressMs?: number;
  shuffleEnabled?: boolean;
  repeatMode?: RepeatMode;
};

export async function replaceQueueForUser(
  userId: string,
  songs: Song[],
  state: QueuePlayerStateInput = {},
) {
  const admin = requireAdmin();
  const savedSongs = await Promise.all(songs.map((song) => upsertSong(song)));

  if (savedSongs.some((song) => !song.id)) {
    throw new Error("Queue song upsert failed.");
  }

  const requestedIndex = state.currentTrackId
    ? savedSongs.findIndex((song) => song.spotifyTrackId === state.currentTrackId)
    : (state.currentIndex ?? 0);
  const currentIndex = savedSongs.length
    ? Math.min(Math.max(requestedIndex, 0), savedSongs.length - 1)
    : 0;
  const currentSongId = savedSongs[currentIndex]?.id ?? null;

  const { error: deleteError } = await admin
    .from("queue_items")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  let queue: QueueItem[] = [];
  if (savedSongs.length) {
    const { data, error } = await admin
      .from("queue_items")
      .insert(
        savedSongs.map((song, position) => ({
          user_id: userId,
          song_id: song.id,
          position,
          source: "player",
        })),
      )
      .select("id,position");
    if (error) throw error;

    const rowByPosition = new Map(
      (data ?? []).map((row) => [row.position as number, row.id as string]),
    );
    queue = savedSongs.map((song, position) => ({
      id: rowByPosition.get(position) ?? `${song.spotifyTrackId}-${position}`,
      position,
      song,
    }));
  }

  const { error: stateError } = await admin.from("player_states").upsert(
    {
      user_id: userId,
      current_song_id: currentSongId,
      current_index: currentIndex,
      is_playing: state.isPlaying ?? false,
      progress_ms: Math.max(0, Math.round(state.progressMs ?? 0)),
      shuffle_enabled: state.shuffleEnabled ?? false,
      repeat_mode: state.repeatMode ?? "off",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (stateError) throw stateError;

  return { queue, currentIndex };
}

export async function addQueueItemForUser(userId: string, song: Song) {
  const admin = requireAdmin();
  const savedSong = await upsertSong(song);
  if (!savedSong.id) throw new Error("Song upsert failed.");

  const { data, error } = await admin
    .from("queue_items")
    .insert({
      user_id: userId,
      song_id: savedSong.id,
      position: await nextQueuePosition(userId),
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
