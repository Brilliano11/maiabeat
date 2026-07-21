"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ListeningRoom,
  ListeningRoomRole,
  ListeningSyncInput,
} from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

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
  setConnectionStatus: (status: ListeningConnectionStatus) => void;
  clearError: () => void;
  clearRoom: () => void;
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Listening room request failed.");
  return data;
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
          const response = await fetch("/api/listening/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playback }),
          });
          const { room } = await readResponse<{ room: ListeningRoom }>(response);
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
        set({
          loading: true,
          pendingAction: "join",
          error: null,
          connectionStatus: "connecting",
        });
        try {
          const response = await fetch("/api/listening/rooms/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: code.trim().toUpperCase() }),
          });
          const { room } = await readResponse<{ room: ListeningRoom }>(response);
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
        try {
          const response = await fetch(`/api/listening/rooms/${roomId}`, {
            cache: "no-store",
          });
          const { room } = await readResponse<{ room: ListeningRoom }>(response);
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
        try {
          const response = await fetch(`/api/listening/rooms/${roomId}`, {
            method: "DELETE",
          });
          await readResponse<{ ok: boolean }>(response);
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
          role: roleForRoom(room),
          error: null,
        });
      },
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
      partialize: (state) => ({ activeRoomId: state.activeRoomId }),
    },
  ),
);
