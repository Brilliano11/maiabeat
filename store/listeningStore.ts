"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ListeningRoom,
  ListeningRoomRole,
  ListeningSyncInput,
} from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

const roomRequestTimeoutMs = 8_000;
const broadcastRoomLifetimeMs = 6 * 60 * 60_000;
const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

class ListeningRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ListeningRequestError";
  }
}

export type ListeningConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type ListeningPendingAction = "create" | "join" | "leave" | null;

type ListeningState = {
  activeRoomId: string | null;
  room: ListeningRoom | null;
  role: ListeningRoomRole | null;
  connectionStatus: ListeningConnectionStatus;
  pendingAction: ListeningPendingAction;
  loading: boolean;
  error: string | null;
  createRoom: (playback: ListeningSyncInput) => Promise<ListeningRoom | null>;
  joinRoom: (code: string) => Promise<ListeningRoom | null>;
  restoreRoom: (roomId?: string) => Promise<ListeningRoom | null>;
  leaveRoom: () => Promise<boolean>;
  receiveRoom: (room: ListeningRoom) => void;
  failRoom: (message: string) => void;
  setConnectionStatus: (status: ListeningConnectionStatus) => void;
  clearError: () => void;
  clearRoom: () => void;
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new ListeningRequestError(
      data.error ?? "Listening room request failed.",
      response.status,
    );
  }
  return data;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), roomRequestTimeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return await readResponse<T>(response);
  } catch (error) {
    if (error instanceof ListeningRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ListeningRequestError("Listening room server timed out.");
    }
    throw new ListeningRequestError(
      error instanceof Error ? error.message : "Could not reach the listening room server.",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

function canUseBroadcastFallback(error: unknown, includeNotFound = false) {
  if (!(error instanceof ListeningRequestError)) return false;
  return (
    error.status === null ||
    error.status >= 500 ||
    (includeNotFound && error.status === 404)
  );
}

function generateRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(
    bytes,
    (byte) => roomCodeAlphabet[byte % roomCodeAlphabet.length],
  ).join("");
}

function createBroadcastRoom(
  code: string,
  role: ListeningRoomRole,
  playback?: ListeningSyncInput,
): ListeningRoom | null {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const now = new Date();
  const nowIso = now.toISOString();
  const normalizedCode = code.trim().toUpperCase();
  const isHost = role === "host";
  return {
    id: `broadcast:${normalizedCode}`,
    code: normalizedCode,
    hostId: isHost ? user.id : "",
    transport: "broadcast",
    status: "active",
    createdAt: nowIso,
    expiresAt: new Date(now.getTime() + broadcastRoomLifetimeMs).toISOString(),
    playback: {
      currentSong: playback?.currentSong ?? null,
      queue: playback?.queue ?? [],
      currentIndex: playback?.currentIndex ?? 0,
      isPlaying: Boolean(playback?.currentSong && playback.isPlaying),
      positionMs: playback?.currentSong ? playback.positionMs : 0,
      startedAt: playback?.currentSong && playback.isPlaying ? nowIso : null,
      version: isHost ? 1 : 0,
      updatedAt: nowIso,
    },
    members: [
      {
        userId: user.id,
        displayName: user.displayName,
        role,
        joinedAt: nowIso,
        lastSeen: nowIso,
        online: true,
      },
    ],
  };
}

function roleForRoom(room: ListeningRoom) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  if (room.hostId === userId) return "host" as const;
  return room.members.some((member) => member.userId === userId)
    ? ("listener" as const)
    : null;
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set, get) => ({
      activeRoomId: null,
      room: null,
      role: null,
      connectionStatus: "idle",
      pendingAction: null,
      loading: false,
      error: null,
      createRoom: async (playback) => {
        set({
          loading: true,
          pendingAction: "create",
          error: null,
          connectionStatus: "connecting",
        });
        try {
          const { room } = await requestJson<{ room: ListeningRoom }>(
            "/api/listening/rooms",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playback }),
            },
          );
          set({
            activeRoomId: room.id,
            room,
            role: roleForRoom(room),
            connectionStatus: "connecting",
            pendingAction: null,
            loading: false,
          });
          return room;
        } catch (error) {
          if (canUseBroadcastFallback(error)) {
            const room = createBroadcastRoom(generateRoomCode(), "host", playback);
            if (room) {
              set({
                activeRoomId: room.id,
                room,
                role: "host",
                connectionStatus: "connecting",
                pendingAction: null,
                loading: false,
                error: null,
              });
              return room;
            }
          }
          set({
            loading: false,
            pendingAction: null,
            connectionStatus: "error",
            error: error instanceof Error ? error.message : "Room creation failed.",
          });
          return null;
        }
      },
      joinRoom: async (code) => {
        const normalizedCode = code.trim().toUpperCase();
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(normalizedCode)) {
          set({
            loading: false,
            pendingAction: null,
            connectionStatus: "error",
            error: "Enter a valid 6-character room code.",
          });
          return null;
        }
        set({
          loading: true,
          pendingAction: "join",
          error: null,
          connectionStatus: "connecting",
        });
        try {
          const { room } = await requestJson<{ room: ListeningRoom }>(
            "/api/listening/rooms/join",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: normalizedCode }),
            },
          );
          set({
            activeRoomId: room.id,
            room,
            role: roleForRoom(room),
            connectionStatus: "connecting",
            pendingAction: null,
            loading: false,
          });
          return room;
        } catch (error) {
          if (canUseBroadcastFallback(error, true)) {
            const room = createBroadcastRoom(normalizedCode, "listener");
            if (room) {
              set({
                activeRoomId: room.id,
                room,
                role: "listener",
                connectionStatus: "connecting",
                pendingAction: null,
                loading: false,
                error: null,
              });
              return room;
            }
          }
          set({
            loading: false,
            pendingAction: null,
            connectionStatus: "error",
            error: error instanceof Error ? error.message : "Could not join room.",
          });
          return null;
        }
      },
      restoreRoom: async (requestedRoomId) => {
        const roomId = requestedRoomId ?? get().activeRoomId;
        if (!roomId) return null;
        const localRoom = get().room;
        if (
          localRoom?.transport === "broadcast" &&
          localRoom.id === roomId &&
          localRoom.status === "active"
        ) {
          set({ connectionStatus: "connecting", error: null });
          return localRoom;
        }
        try {
          const { room } = await requestJson<{ room: ListeningRoom }>(
            `/api/listening/rooms/${roomId}`,
            {
              cache: "no-store",
            },
          );
          if (get().activeRoomId !== roomId) return null;
          if (room.status !== "active") {
            get().clearRoom();
            return null;
          }
          set({
            activeRoomId: room.id,
            room,
            role: roleForRoom(room),
            error: null,
          });
          return room;
        } catch (error) {
          if (get().activeRoomId !== roomId) return null;
          const message = error instanceof Error ? error.message : "Room reconnect failed.";
          if (/not found|no longer|ended|expired/i.test(message)) get().clearRoom();
          else set({ connectionStatus: "reconnecting", error: message });
          return null;
        }
      },
      leaveRoom: async () => {
        const roomId = get().activeRoomId;
        if (!roomId) {
          get().clearRoom();
          return true;
        }
        set({ loading: true, pendingAction: "leave", error: null });
        if (get().room?.transport === "broadcast") {
          get().clearRoom();
          return true;
        }
        try {
          await requestJson<{ ok: boolean }>(`/api/listening/rooms/${roomId}`, {
            method: "DELETE",
          });
          if (get().activeRoomId === roomId) get().clearRoom();
          return true;
        } catch (error) {
          if (get().activeRoomId !== roomId) return false;
          set({
            loading: false,
            pendingAction: null,
            error: error instanceof Error ? error.message : "Could not leave room.",
          });
          return false;
        }
      },
      receiveRoom: (room) => {
        if (get().activeRoomId !== room.id) return;
        if (room.status !== "active") {
          get().clearRoom();
          return;
        }
        set({
          activeRoomId: room.id,
          room,
          role:
            roleForRoom(room) ??
            (room.transport === "broadcast" ? get().role : null),
          error: null,
        });
      },
      failRoom: (error) =>
        set({
          activeRoomId: null,
          room: null,
          role: null,
          connectionStatus: "error",
          pendingAction: null,
          loading: false,
          error,
        }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      clearError: () => set({ error: null }),
      clearRoom: () =>
        set({
          activeRoomId: null,
          room: null,
          role: null,
          connectionStatus: "idle",
          pendingAction: null,
          loading: false,
          error: null,
        }),
    }),
    {
      name: "maiabeat-listening-room",
      partialize: (state) => ({
        activeRoomId: state.activeRoomId,
        room: state.room?.transport === "broadcast" ? state.room : null,
        role: state.room?.transport === "broadcast" ? state.role : null,
      }),
    },
  ),
);
