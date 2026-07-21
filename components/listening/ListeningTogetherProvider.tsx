"use client";

import { useEffect, useRef } from "react";
import { createListeningSnapshot } from "@/lib/listening/snapshot";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AppUser,
  ListeningRoom,
  ListeningRoomMember,
  ListeningRoomRole,
  ListeningSyncInput,
  Song,
} from "@/lib/types";
import { notify } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useListeningStore } from "@/store/listeningStore";
import { usePlayerStore } from "@/store/playerStore";

const hostCheckpointMs = 4_000;
const roomPollMs = 12_000;
const heartbeatMs = 25_000;
const meaningfulSeekMs = 1_800;
const broadcastConnectTimeoutMs = 12_000;
const broadcastStateTimeoutMs = 12_000;
const broadcastStaleMs = 16_000;
const broadcastEndedMs = 40_000;

type MutableValue<T> = { current: T };
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function validDateText(value: unknown): value is string {
  return validText(value, 80) && Number.isFinite(Date.parse(value));
}

function isValidSong(value: unknown): value is Song {
  if (!isRecord(value)) return false;
  return (
    validText(value.spotifyTrackId, 160) &&
    validText(value.spotifyUri, 240) &&
    validText(value.title, 300) &&
    validText(value.artist, 300) &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 0 &&
    value.durationMs <= 24 * 60 * 60_000
  );
}

function sanitizeMembers(value: unknown, hostId: string) {
  if (!Array.isArray(value)) return [];
  const members = new Map<string, ListeningRoomMember>();
  for (const candidate of value.slice(0, 100)) {
    if (!isRecord(candidate)) continue;
    if (!validText(candidate.userId, 160) || !validText(candidate.displayName, 160)) {
      continue;
    }
    const joinedAt = validText(candidate.joinedAt, 80)
      ? candidate.joinedAt
      : new Date().toISOString();
    const lastSeen = validText(candidate.lastSeen, 80)
      ? candidate.lastSeen
      : joinedAt;
    members.set(candidate.userId, {
      userId: candidate.userId,
      displayName: candidate.displayName,
      role: candidate.userId === hostId ? "host" : "listener",
      joinedAt,
      lastSeen,
      online: candidate.online !== false,
    });
  }
  return Array.from(members.values());
}

function parseBroadcastRoom(
  payload: unknown,
  expectedId: string,
  expectedCode: string,
): ListeningRoom | null {
  if (!isRecord(payload) || !isRecord(payload.room)) return null;
  const room = payload.room;
  if (
    room.id !== expectedId ||
    room.code !== expectedCode ||
    room.transport !== "broadcast" ||
    room.status !== "active" ||
    !validText(room.hostId, 160) ||
    !validDateText(room.createdAt) ||
    !validDateText(room.expiresAt) ||
    !isRecord(room.playback)
  ) {
    return null;
  }

  const playback = room.playback;
  if (
    (playback.currentSong !== null && !isValidSong(playback.currentSong)) ||
    !Array.isArray(playback.queue) ||
    playback.queue.length > 100 ||
    !playback.queue.every(isValidSong) ||
    typeof playback.currentIndex !== "number" ||
    !Number.isInteger(playback.currentIndex) ||
    playback.currentIndex < 0 ||
    (playback.queue.length === 0
      ? playback.currentIndex !== 0
      : playback.currentIndex >= playback.queue.length) ||
    typeof playback.isPlaying !== "boolean" ||
    typeof playback.positionMs !== "number" ||
    !Number.isFinite(playback.positionMs) ||
    playback.positionMs < 0 ||
    playback.positionMs > (playback.currentSong?.durationMs ?? 0) ||
    typeof playback.version !== "number" ||
    !Number.isSafeInteger(playback.version) ||
    playback.version < 1 ||
    !validDateText(playback.updatedAt) ||
    (playback.startedAt !== null && !validDateText(playback.startedAt))
  ) {
    return null;
  }

  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    transport: "broadcast",
    status: "active",
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    playback: {
      currentSong: playback.currentSong,
      queue: playback.queue,
      currentIndex: playback.currentIndex,
      isPlaying: playback.isPlaying,
      positionMs: playback.positionMs,
      startedAt: playback.startedAt,
      version: playback.version,
      updatedAt: playback.updatedAt,
    },
    members: sanitizeMembers(room.members, room.hostId),
  };
}

function presenceMembers(
  state: UnknownRecord,
  hostId: string,
  user: AppUser,
  role: ListeningRoomRole,
) {
  const nowIso = new Date().toISOString();
  const members = new Map<string, ListeningRoomMember>();
  for (const entries of Object.values(state)) {
    if (!Array.isArray(entries)) continue;
    for (const candidate of entries) {
      if (!isRecord(candidate)) continue;
      if (!validText(candidate.userId, 160) || !validText(candidate.displayName, 160)) {
        continue;
      }
      const joinedAt = validText(candidate.joinedAt, 80)
        ? candidate.joinedAt
        : nowIso;
      members.set(candidate.userId, {
        userId: candidate.userId,
        displayName: candidate.displayName,
        role: candidate.userId === hostId ? "host" : "listener",
        joinedAt,
        lastSeen: nowIso,
        online: true,
      });
    }
  }

  if (!members.has(user.id)) {
    members.set(user.id, {
      userId: user.id,
      displayName: user.displayName,
      role,
      joinedAt: nowIso,
      lastSeen: nowIso,
      online: true,
    });
  }

  return Array.from(members.values()).sort((left, right) => {
    if (left.userId === hostId) return -1;
    if (right.userId === hostId) return 1;
    return left.joinedAt.localeCompare(right.joinedAt);
  });
}

function mergeLiveMembers(
  roomMembers: ListeningRoomMember[],
  liveMembers: ListeningRoomMember[],
  hostId: string,
) {
  const merged = new Map(liveMembers.map((member) => [member.userId, member]));
  const host = roomMembers.find((member) => member.userId === hostId);
  if (host && !merged.has(hostId)) merged.set(hostId, { ...host, online: true });
  return Array.from(merged.values()).sort((left, right) => {
    if (left.userId === hostId) return -1;
    if (right.userId === hostId) return 1;
    return left.joinedAt.localeCompare(right.joinedAt);
  });
}

function effectiveRoomPosition(room: ListeningRoom) {
  const { playback } = room;
  const elapsed =
    playback.isPlaying && playback.startedAt
      ? Math.max(0, Date.now() - new Date(playback.startedAt).getTime())
      : 0;
  const duration = playback.currentSong?.durationMs ?? 0;
  return Math.min(duration, Math.max(0, playback.positionMs + elapsed));
}

async function applyListenerPlayback(
  room: ListeningRoom,
  lastAppliedVersion: MutableValue<number | null>,
  applyingRemote: MutableValue<boolean>,
  force = false,
) {
  if (room.status !== "active") return;
  if (!force && lastAppliedVersion.current === room.playback.version) return;
  applyingRemote.current = true;
  try {
    const applied = await usePlayerStore.getState().syncFromListeningRoom({
      currentSong: room.playback.currentSong,
      queue: room.playback.queue,
      currentIndex: room.playback.currentIndex,
      isPlaying: room.playback.isPlaying,
      positionMs: effectiveRoomPosition(room),
    });
    if (applied) lastAppliedVersion.current = room.playback.version;
  } finally {
    applyingRemote.current = false;
  }
}

function playbackChanged(
  state: ReturnType<typeof usePlayerStore.getState>,
  previous: ReturnType<typeof usePlayerStore.getState>,
) {
  const trackChanged =
    state.currentSong?.spotifyTrackId !== previous.currentSong?.spotifyTrackId;
  const playingChanged = state.isPlaying !== previous.isPlaying;
  const indexChanged = state.currentIndex !== previous.currentIndex;
  const queueChanged =
    state.queue.length !== previous.queue.length ||
    state.queue.some(
      (item, index) =>
        item.song.spotifyTrackId !== previous.queue[index]?.song.spotifyTrackId,
    );
  const positionJumped = Math.abs(state.progressMs - previous.progressMs) > meaningfulSeekMs;
  return trackChanged || playingChanged || indexChanged || queueChanged || positionJumped;
}

function roomWithPlayback(
  room: ListeningRoom,
  playback: ListeningSyncInput,
  version: number,
  members: ListeningRoomMember[],
) {
  const nowIso = new Date().toISOString();
  return {
    ...room,
    hostId: room.hostId,
    transport: "broadcast" as const,
    status: "active" as const,
    playback: {
      ...playback,
      isPlaying: Boolean(playback.currentSong && playback.isPlaying),
      positionMs: playback.currentSong ? playback.positionMs : 0,
      startedAt: playback.currentSong && playback.isPlaying ? nowIso : null,
      version,
      updatedAt: nowIso,
    },
    members,
  } satisfies ListeningRoom;
}

export function ListeningTogetherProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const activeRoomId = useListeningStore((state) => state.activeRoomId);
  const role = useListeningStore((state) => state.role);
  const roomTransport = useListeningStore(
    (state) => state.room?.transport ?? (state.activeRoomId ? "database" : null),
  );
  const spotifyDeviceId = usePlayerStore((state) => state.deviceId);
  const lastAppliedVersionRef = useRef<number | null>(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    if (
      !activeRoomId ||
      roomTransport === "broadcast" ||
      !user ||
      user.id === "local-preview"
    ) {
      return;
    }
    let active = true;
    let refreshInFlight = false;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      useListeningStore.getState().setConnectionStatus("error");
      return;
    }

    const applyRoom = async (room: ListeningRoom, force = false) => {
      if (!active || room.hostId === user.id || room.status !== "active") return;
      await applyListenerPlayback(
        room,
        lastAppliedVersionRef,
        applyingRemoteRef,
        force,
      );
    };

    const refreshRoom = async (forcePlayback = false) => {
      if (!active || refreshInFlight) return null;
      refreshInFlight = true;
      try {
        const room = await useListeningStore.getState().restoreRoom(activeRoomId);
        if (room) await applyRoom(room, forcePlayback);
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
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
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
          await applyRoom(data.room, true);
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
  }, [activeRoomId, roomTransport, user]);

  useEffect(() => {
    if (
      !activeRoomId ||
      roomTransport === "broadcast" ||
      role !== "host" ||
      !user ||
      user.id === "local-preview"
    ) {
      return;
    }
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
      if (playbackChanged(state, previous)) void sendSnapshot();
    });
    void sendSnapshot();
    const checkpoint = window.setInterval(() => void sendSnapshot(), hostCheckpointMs);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(checkpoint);
    };
  }, [activeRoomId, role, roomTransport, user]);

  useEffect(() => {
    if (
      !activeRoomId ||
      roomTransport !== "broadcast" ||
      !role ||
      !user ||
      user.id === "local-preview"
    ) {
      return;
    }

    const initialRoom = useListeningStore.getState().room;
    if (!initialRoom || initialRoom.id !== activeRoomId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      useListeningStore
        .getState()
        .failRoom("Realtime connection is not configured for Listening Together.");
      return;
    }

    let active = true;
    let subscribed = false;
    let subscribedAt = 0;
    let lastStateAt = role === "host" ? Date.now() : 0;
    let expectedHostId = role === "host" ? user.id : initialRoom.hostId || null;
    let version = initialRoom.playback.version;
    let sendInFlight = false;
    let sendQueued = false;
    const roomId = initialRoom.id;
    const roomCode = initialRoom.code;

    const channel = supabase.channel(`maiabeat-listening:${roomCode}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: user.id },
      },
    });

    const currentPresenceMembers = (hostId = expectedHostId ?? "") =>
      presenceMembers(
        channel.presenceState() as UnknownRecord,
        hostId,
        user,
        role,
      );

    const updatePresence = () => {
      const current = useListeningStore.getState().room;
      if (!active || !current || current.id !== roomId) return;
      const hostId = expectedHostId ?? current.hostId;
      const members = mergeLiveMembers(
        current.members,
        currentPresenceMembers(hostId),
        hostId,
      );
      useListeningStore.getState().receiveRoom({ ...current, hostId, members });
    };

    const sendHostState = async () => {
      if (!active || !subscribed || role !== "host" || applyingRemoteRef.current) return;
      if (sendInFlight) {
        sendQueued = true;
        return;
      }
      sendInFlight = true;
      try {
        const current = useListeningStore.getState().room;
        if (!current || current.id !== roomId) return;
        expectedHostId = user.id;
        version = Math.max(version, current.playback.version) + 1;
        const nextRoom = roomWithPlayback(
          { ...current, hostId: user.id },
          createListeningSnapshot(usePlayerStore.getState()),
          version,
          currentPresenceMembers(user.id),
        );
        useListeningStore.getState().receiveRoom(nextRoom);
        const result = await channel.send({
          type: "broadcast",
          event: "room-state",
          payload: { room: nextRoom },
        });
        if (!active) return;
        useListeningStore
          .getState()
          .setConnectionStatus(result === "ok" ? "connected" : "reconnecting");
      } catch {
        if (active) useListeningStore.getState().setConnectionStatus("reconnecting");
      } finally {
        sendInFlight = false;
        if (sendQueued) {
          sendQueued = false;
          void sendHostState();
        }
      }
    };

    const requestHostState = async () => {
      if (!active || !subscribed || role !== "listener") return;
      try {
        await channel.send({
          type: "broadcast",
          event: "request-state",
          payload: { userId: user.id },
        });
      } catch {
        if (active) useListeningStore.getState().setConnectionStatus("reconnecting");
      }
    };

    channel
      .on("broadcast", { event: "room-state" }, ({ payload }) => {
        if (!active || role !== "listener") return;
        const incoming = parseBroadcastRoom(payload, roomId, roomCode);
        if (!incoming) return;
        if (expectedHostId && incoming.hostId !== expectedHostId) return;
        expectedHostId = incoming.hostId;
        const firstState = lastStateAt === 0;
        lastStateAt = Date.now();
        const members = mergeLiveMembers(
          incoming.members,
          currentPresenceMembers(incoming.hostId),
          incoming.hostId,
        );
        const nextRoom = { ...incoming, members };
        useListeningStore.getState().receiveRoom(nextRoom);
        useListeningStore.getState().setConnectionStatus("connected");
        void applyListenerPlayback(
          nextRoom,
          lastAppliedVersionRef,
          applyingRemoteRef,
          firstState,
        );
      })
      .on("broadcast", { event: "request-state" }, () => {
        if (role === "host") void sendHostState();
      })
      .on("broadcast", { event: "room-ended" }, ({ payload }) => {
        if (!active || role !== "listener" || !isRecord(payload)) return;
        if (
          payload.code === roomCode &&
          (!expectedHostId || payload.hostId === expectedHostId)
        ) {
          useListeningStore.getState().failRoom("The host ended this listening room.");
        }
      })
      .on("presence", { event: "sync" }, updatePresence)
      .subscribe(async (status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          subscribed = true;
          subscribedAt = Date.now();
          try {
            const tracked = await channel.track({
              userId: user.id,
              displayName: user.displayName,
              role,
              joinedAt: new Date().toISOString(),
            });
            if (tracked !== "ok") {
              useListeningStore.getState().setConnectionStatus("reconnecting");
            }
          } catch {
            useListeningStore.getState().setConnectionStatus("reconnecting");
          }
          if (!active) return;
          updatePresence();
          if (role === "host") {
            useListeningStore.getState().setConnectionStatus("connected");
            void sendHostState();
          } else {
            useListeningStore.getState().setConnectionStatus("connecting");
            void requestHostState();
          }
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          subscribed = false;
          useListeningStore.getState().setConnectionStatus("reconnecting");
        }
      });

    useListeningStore.getState().setConnectionStatus("connecting");

    const unsubscribePlayer =
      role === "host"
        ? usePlayerStore.subscribe((state, previous) => {
            if (playbackChanged(state, previous)) void sendHostState();
          })
        : () => undefined;
    const checkpoint =
      role === "host"
        ? window.setInterval(() => void sendHostState(), hostCheckpointMs)
        : null;
    const requestTimer =
      role === "listener"
        ? window.setInterval(() => {
            if (!lastStateAt || Date.now() - lastStateAt > broadcastStaleMs) {
              void requestHostState();
            }
          }, 2_500)
        : null;
    const livenessTimer = window.setInterval(() => {
      if (!active) return;
      if (!subscribed) return;
      if (role === "listener" && !lastStateAt) {
        if (Date.now() - subscribedAt > broadcastStateTimeoutMs) {
          useListeningStore
            .getState()
            .failRoom("Room not found, or the host is currently offline.");
        }
        return;
      }
      if (role === "listener" && Date.now() - lastStateAt > broadcastEndedMs) {
        useListeningStore
          .getState()
          .failRoom("Connection to the host was lost. Ask the host for a new room code.");
      } else if (role === "listener" && Date.now() - lastStateAt > broadcastStaleMs) {
        useListeningStore.getState().setConnectionStatus("reconnecting");
      }
    }, 1_000);
    const connectTimer = window.setTimeout(() => {
      if (!active || subscribed) return;
      useListeningStore
        .getState()
        .failRoom("Could not connect to Listening Together. Check your internet and try again.");
    }, broadcastConnectTimeoutMs);

    return () => {
      active = false;
      unsubscribePlayer();
      if (checkpoint !== null) window.clearInterval(checkpoint);
      if (requestTimer !== null) window.clearInterval(requestTimer);
      window.clearInterval(livenessTimer);
      window.clearTimeout(connectTimer);
      const explicitlyLeft = useListeningStore.getState().activeRoomId !== roomId;
      if (role === "host" && subscribed && explicitlyLeft) {
        void channel
          .send({
            type: "broadcast",
            event: "room-ended",
            payload: { code: roomCode, hostId: user.id },
          })
          .catch(() => undefined)
          .then(() => supabase.removeChannel(channel))
          .catch(() => undefined);
      } else {
        void supabase.removeChannel(channel).catch(() => undefined);
      }
    };
  }, [activeRoomId, role, roomTransport, user]);

  useEffect(() => {
    if (
      !spotifyDeviceId ||
      !activeRoomId ||
      role !== "listener" ||
      !user ||
      user.id === "local-preview"
    ) {
      return;
    }
    const room = useListeningStore.getState().room;
    if (!room || room.id !== activeRoomId || room.status !== "active") return;
    void applyListenerPlayback(
      room,
      lastAppliedVersionRef,
      applyingRemoteRef,
      true,
    );
  }, [activeRoomId, role, roomTransport, spotifyDeviceId, user]);

  return <>{children}</>;
}
