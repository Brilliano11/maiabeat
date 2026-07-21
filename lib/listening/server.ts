import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ListeningRoom,
  ListeningRoomMember,
  ListeningRoomRole,
  ListeningSyncInput,
  Song,
} from "@/lib/types";

const roomLifetimeMs = 6 * 60 * 60_000;
const onlineWindowMs = 75_000;
const maxQueueLength = 100;
const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type ListeningRoomRow = {
  id: string;
  code: string;
  host_id: string;
  status: "active" | "ended";
  current_song: Song | null;
  queue: Song[] | null;
  current_index: number;
  is_playing: boolean;
  position_ms: number;
  started_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

type ListeningMemberRow = {
  user_id: string;
  display_name: string;
  role: ListeningRoomRole;
  joined_at: string;
  last_seen: string;
};

export class ListeningRoomError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ListeningRoomError";
  }
}

function requireAdmin() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new ListeningRoomError(
      "Listening Together server setup is incomplete.",
      503,
    );
  }
  return admin;
}

export function listeningRoomErrorDetails(error: unknown, fallback: string) {
  if (error instanceof ListeningRoomError) {
    return { message: error.message, status: error.status };
  }

  const backendError = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };
  const code = typeof backendError?.code === "string" ? backendError.code : "";
  const message =
    typeof backendError?.message === "string"
      ? backendError.message.toLowerCase()
      : "";
  const status = Number(backendError?.status);

  if (
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("listening_rooms")
  ) {
    return {
      message: "Listening Together database migration has not been applied yet.",
      status: 503,
    };
  }
  if (status === 401 || message.includes("invalid api key")) {
    return {
      message: "Listening Together server key is not connected to Supabase.",
      status: 503,
    };
  }

  return { message: fallback, status: 500 };
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength ? value : undefined;
}

function normalizeSong(value: unknown): Song | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const song = value as Partial<Song>;
  const spotifyTrackId = cleanText(song.spotifyTrackId, 160);
  const spotifyUri = cleanText(song.spotifyUri, 240);
  const title = cleanText(song.title, 300);
  const artist = cleanText(song.artist, 300);
  const durationMs = song.durationMs;

  if (
    !spotifyTrackId ||
    !spotifyUri ||
    !title ||
    !artist ||
    typeof durationMs !== "number" ||
    !Number.isFinite(durationMs) ||
    durationMs < 0 ||
    durationMs > 24 * 60 * 60_000
  ) {
    return null;
  }

  const artists = Array.isArray(song.artists)
    ? song.artists
        .slice(0, 20)
        .filter(
          (item): item is { id: string; name: string } =>
            Boolean(
              item &&
                cleanText(item.id, 160) &&
                cleanText(item.name, 200),
            ),
        )
        .map((item) => ({ id: item.id, name: item.name }))
    : undefined;

  return {
    id: cleanText(song.id, 160),
    spotifyTrackId,
    spotifyUri,
    title,
    artist,
    artists,
    album: cleanText(song.album, 300),
    coverUrl:
      song.coverUrl === null ? null : cleanText(song.coverUrl, 2_048),
    durationMs: Math.round(durationMs),
    explicit: typeof song.explicit === "boolean" ? song.explicit : undefined,
    popularity:
      typeof song.popularity === "number" && Number.isFinite(song.popularity)
        ? Math.max(0, Math.min(100, Math.round(song.popularity)))
        : undefined,
    externalUrl: cleanText(song.externalUrl, 2_048),
    previewUrl:
      song.previewUrl === null ? null : cleanText(song.previewUrl, 2_048),
    mood: cleanText(song.mood, 80),
  };
}

export function normalizeListeningSync(value: unknown): ListeningSyncInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ListeningRoomError("Valid playback state required.");
  }

  const input = value as Partial<ListeningSyncInput>;
  if (!Array.isArray(input.queue) || input.queue.length > maxQueueLength) {
    throw new ListeningRoomError("Room queue must contain at most 100 songs.");
  }

  const queue: Song[] = [];
  for (const candidate of input.queue) {
    const song = normalizeSong(candidate);
    if (!song) throw new ListeningRoomError("Room queue contains an invalid song.");
    queue.push(song);
  }

  const currentSong = input.currentSong === null ? null : normalizeSong(input.currentSong);
  if (input.currentSong !== null && !currentSong) {
    throw new ListeningRoomError("Current room song is invalid.");
  }

  const requestedIndex =
    typeof input.currentIndex === "number" && Number.isInteger(input.currentIndex)
      ? input.currentIndex
      : 0;
  let currentIndex =
    requestedIndex >= 0 && requestedIndex < queue.length ? requestedIndex : 0;
  if (currentSong) {
    if (queue[currentIndex]?.spotifyTrackId !== currentSong.spotifyTrackId) {
      currentIndex = queue.findIndex(
        (song) => song.spotifyTrackId === currentSong.spotifyTrackId,
      );
    }
    if (currentIndex < 0) {
      queue.unshift(currentSong);
      if (queue.length > maxQueueLength) queue.pop();
      currentIndex = 0;
    }
  }
  const maxPosition = currentSong?.durationMs ?? 0;
  const positionMs =
    typeof input.positionMs === "number" && Number.isFinite(input.positionMs)
      ? Math.max(0, Math.min(maxPosition, Math.round(input.positionMs)))
      : 0;

  return {
    currentSong,
    queue,
    currentIndex,
    isPlaying: Boolean(currentSong && input.isPlaying === true),
    positionMs: currentSong ? positionMs : 0,
  };
}

function generateRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => roomCodeAlphabet[byte % roomCodeAlphabet.length]).join("");
}

function memberFromRow(row: ListeningMemberRow): ListeningRoomMember {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    joinedAt: row.joined_at,
    lastSeen: row.last_seen,
    online: Date.now() - new Date(row.last_seen).getTime() <= onlineWindowMs,
  };
}

async function membersForRoom(roomId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("listening_room_members")
    .select("user_id,display_name,role,joined_at,last_seen")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ListeningMemberRow[]).map(memberFromRow);
}

async function roomFromRow(row: ListeningRoomRow): Promise<ListeningRoom> {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    playback: {
      currentSong: row.current_song,
      queue: row.queue ?? [],
      currentIndex: row.current_index,
      isPlaying: row.is_playing,
      positionMs: row.position_ms,
      startedAt: row.started_at,
      version: row.version,
      updatedAt: row.updated_at,
    },
    members: await membersForRoom(row.id),
  };
}

async function expireRoomIfNeeded(row: ListeningRoomRow) {
  if (row.status !== "active" || new Date(row.expires_at).getTime() > Date.now()) {
    return;
  }

  const admin = requireAdmin();
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("listening_rooms")
    .update({
      status: "ended",
      is_playing: false,
      updated_at: nowIso,
    })
    .eq("id", row.id)
    .eq("status", "active")
    .lte("expires_at", nowIso);
  if (error) throw error;
  throw new ListeningRoomError("Listening room has expired.", 410);
}

async function requireMembership(userId: string, roomId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("listening_room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ListeningRoomError("You are no longer in this room.", 403);
  return data.role as ListeningRoomRole;
}

export async function getListeningRoomForUser(userId: string, roomId: string) {
  await requireMembership(userId, roomId);
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("listening_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ListeningRoomError("Listening room not found.", 404);
  const roomRow = data as ListeningRoomRow;
  await expireRoomIfNeeded(roomRow);
  return roomFromRow(roomRow);
}

export async function createListeningRoom(
  userId: string,
  displayName: string,
  sync: ListeningSyncInput,
) {
  const admin = requireAdmin();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + roomLifetimeMs).toISOString();

  const { error: endError } = await admin
    .from("listening_rooms")
    .update({ status: "ended", updated_at: nowIso })
    .eq("host_id", userId)
    .eq("status", "active");
  if (endError) throw endError;

  let roomRow: ListeningRoomRow | null = null;
  for (let attempt = 0; attempt < 6 && !roomRow; attempt += 1) {
    const { data, error } = await admin
      .from("listening_rooms")
      .insert({
        code: generateRoomCode(),
        host_id: userId,
        status: "active",
        current_song: sync.currentSong,
        queue: sync.queue,
        current_index: sync.currentIndex,
        is_playing: sync.isPlaying,
        position_ms: sync.positionMs,
        started_at: sync.isPlaying ? nowIso : null,
        version: 1,
        created_at: nowIso,
        updated_at: nowIso,
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (!error && data) roomRow = data as ListeningRoomRow;
    else if (error?.code !== "23505") throw error;
  }
  if (!roomRow) throw new Error("Could not allocate a listening room code.");

  const { error: memberError } = await admin.from("listening_room_members").insert({
    room_id: roomRow.id,
    user_id: userId,
    display_name: displayName,
    role: "host",
    joined_at: nowIso,
    last_seen: nowIso,
  });
  if (memberError) {
    await admin.from("listening_rooms").delete().eq("id", roomRow.id);
    throw memberError;
  }

  return roomFromRow(roomRow);
}

export async function joinListeningRoom(userId: string, displayName: string, code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(normalizedCode)) {
    throw new ListeningRoomError("Enter a valid 6-character room code.");
  }

  const admin = requireAdmin();
  const { data, error } = await admin
    .from("listening_rooms")
    .select("*")
    .eq("code", normalizedCode)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ListeningRoomError("Room not found or already ended.", 404);
  const roomRow = data as ListeningRoomRow;
  const role: ListeningRoomRole = roomRow.host_id === userId ? "host" : "listener";
  const nowIso = new Date().toISOString();
  const { error: memberError } = await admin.from("listening_room_members").upsert(
    {
      room_id: roomRow.id,
      user_id: userId,
      display_name: displayName,
      role,
      last_seen: nowIso,
    },
    { onConflict: "room_id,user_id" },
  );
  if (memberError) throw memberError;
  return roomFromRow(roomRow);
}

export async function syncListeningRoom(
  userId: string,
  roomId: string,
  sync: ListeningSyncInput,
) {
  const role = await requireMembership(userId, roomId);
  if (role !== "host") {
    throw new ListeningRoomError("Only the host can control room playback.", 403);
  }

  const admin = requireAdmin();
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: current, error: currentError } = await admin
    .from("listening_rooms")
    .select("version")
    .eq("id", roomId)
    .eq("host_id", userId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) {
    const { error: expireError } = await admin
      .from("listening_rooms")
      .update({ status: "ended", is_playing: false, updated_at: nowIso })
      .eq("id", roomId)
      .eq("status", "active")
      .lte("expires_at", nowIso);
    if (expireError) throw expireError;
    throw new ListeningRoomError("Listening room has ended or expired.", 409);
  }

  const { data, error } = await admin
    .from("listening_rooms")
    .update({
      current_song: sync.currentSong,
      queue: sync.queue,
      current_index: sync.currentIndex,
      is_playing: sync.isPlaying,
      position_ms: sync.positionMs,
      started_at: sync.isPlaying ? nowIso : null,
      version: Number(current.version ?? 0) + 1,
      updated_at: nowIso,
      expires_at: new Date(now.getTime() + roomLifetimeMs).toISOString(),
    })
    .eq("id", roomId)
    .eq("host_id", userId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .select("*")
    .single();
  if (error) throw error;
  return roomFromRow(data as ListeningRoomRow);
}

export async function heartbeatListeningRoom(userId: string, roomId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("listening_room_members")
    .update({ last_seen: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ListeningRoomError("You are no longer in this room.", 403);
  return getListeningRoomForUser(userId, roomId);
}

export async function leaveListeningRoom(userId: string, roomId: string) {
  const role = await requireMembership(userId, roomId);
  const admin = requireAdmin();
  if (role === "host") {
    const { error } = await admin
      .from("listening_rooms")
      .update({ status: "ended", is_playing: false, updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .eq("host_id", userId);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("listening_room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (error) throw error;
  }
}
