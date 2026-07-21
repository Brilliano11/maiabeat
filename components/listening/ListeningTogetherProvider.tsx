"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createListeningSnapshot } from "@/lib/listening/snapshot";
import type { ListeningRoom } from "@/lib/types";
import { notify } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useListeningStore } from "@/store/listeningStore";
import { usePlayerStore } from "@/store/playerStore";

const hostCheckpointMs = 4_000;
const roomPollMs = 12_000;
const heartbeatMs = 25_000;
const meaningfulSeekMs = 1_800;

function effectiveRoomPosition(room: ListeningRoom) {
  const { playback } = room;
  const elapsed =
    playback.isPlaying && playback.startedAt
      ? Math.max(0, Date.now() - new Date(playback.startedAt).getTime())
      : 0;
  const duration = playback.currentSong?.durationMs ?? 0;
  return Math.min(duration, Math.max(0, playback.positionMs + elapsed));
}

export function ListeningTogetherProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const activeRoomId = useListeningStore((state) => state.activeRoomId);
  const role = useListeningStore((state) => state.role);
  const spotifyDeviceId = usePlayerStore((state) => state.deviceId);
  const lastAppliedVersionRef = useRef<number | null>(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!activeRoomId || !user || user.id === "local-preview") return;
    let active = true;
    let refreshInFlight = false;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      useListeningStore.getState().setConnectionStatus("error");
      return;
    }

    const applyListenerRoom = async (room: ListeningRoom, force = false) => {
      if (!active || room.hostId === user.id || room.status !== "active") return;
      if (!force && lastAppliedVersionRef.current === room.playback.version) return;
      applyingRemoteRef.current = true;
      try {
        const applied = await usePlayerStore.getState().syncFromListeningRoom({
          currentSong: room.playback.currentSong,
          queue: room.playback.queue,
          currentIndex: room.playback.currentIndex,
          isPlaying: room.playback.isPlaying,
          positionMs: effectiveRoomPosition(room),
        });
        if (applied) lastAppliedVersionRef.current = room.playback.version;
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const refreshRoom = async (forcePlayback = false) => {
      if (!active || refreshInFlight) return null;
      refreshInFlight = true;
      try {
        const room = await useListeningStore.getState().restoreRoom(activeRoomId);
        if (room) await applyListenerRoom(room, forcePlayback);
        return room;
      } finally {
        refreshInFlight = false;
      }
    };

    useListeningStore.getState().setConnectionStatus("connecting");
    void refreshRoom(true);

    const channel = supabase
      .channel(`listening-room:${activeRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listening_rooms",
          filter: `id=eq.${activeRoomId}`,
        },
        () => void refreshRoom(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listening_room_members",
          filter: `room_id=eq.${activeRoomId}`,
        },
        () => void refreshRoom(),
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          useListeningStore.getState().setConnectionStatus("connected");
          void refreshRoom(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          useListeningStore.getState().setConnectionStatus("reconnecting");
        } else if (status === "CLOSED") {
          useListeningStore.getState().setConnectionStatus("reconnecting");
        }
      });

    const poll = window.setInterval(() => void refreshRoom(true), roomPollMs);
    const heartbeat = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/listening/rooms/${activeRoomId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat" }),
        });
        if (!response.ok) {
          if ([401, 403, 404, 409, 410].includes(response.status)) {
            useListeningStore.getState().clearRoom();
          } else {
            useListeningStore.getState().setConnectionStatus("reconnecting");
          }
          return;
        }
        const data = (await response.json()) as { room?: ListeningRoom };
        if (data.room) {
          useListeningStore.getState().receiveRoom(data.room);
          await applyListenerRoom(data.room, true);
        }
      } catch {
        useListeningStore.getState().setConnectionStatus("reconnecting");
      }
    }, heartbeatMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshRoom(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(poll);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [activeRoomId, spotifyDeviceId, user]);

  useEffect(() => {
    if (!activeRoomId || role !== "host" || !user || user.id === "local-preview") return;
    let active = true;
    let inFlight = false;
    let queued = false;

    const sendSnapshot = async () => {
      if (!active || applyingRemoteRef.current) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        const response = await fetch(`/api/listening/rooms/${activeRoomId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync",
            playback: createListeningSnapshot(usePlayerStore.getState()),
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          room?: ListeningRoom;
          error?: string;
        };
        if (!response.ok || !data.room) {
          if (response.status === 403 || response.status === 409) {
            useListeningStore.getState().clearRoom();
            notify(data.error ?? "Listening room ended.");
          } else {
            useListeningStore.getState().setConnectionStatus("reconnecting");
          }
          return;
        }
        useListeningStore.getState().receiveRoom(data.room);
        useListeningStore.getState().setConnectionStatus("connected");
      } catch {
        useListeningStore.getState().setConnectionStatus("reconnecting");
      } finally {
        inFlight = false;
        if (queued) {
          queued = false;
          void sendSnapshot();
        }
      }
    };

    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      const trackChanged =
        state.currentSong?.spotifyTrackId !== previous.currentSong?.spotifyTrackId;
      const playbackChanged = state.isPlaying !== previous.isPlaying;
      const indexChanged = state.currentIndex !== previous.currentIndex;
      const queueChanged =
        state.queue.length !== previous.queue.length ||
        state.queue.some(
          (item, index) =>
            item.song.spotifyTrackId !== previous.queue[index]?.song.spotifyTrackId,
        );
      const positionJumped =
        Math.abs(state.progressMs - previous.progressMs) > meaningfulSeekMs;
      if (trackChanged || playbackChanged || indexChanged || queueChanged || positionJumped) {
        void sendSnapshot();
      }
    });
    void sendSnapshot();
    const checkpoint = window.setInterval(() => void sendSnapshot(), hostCheckpointMs);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(checkpoint);
    };
  }, [activeRoomId, role, user]);

  return <>{children}</>;
}
