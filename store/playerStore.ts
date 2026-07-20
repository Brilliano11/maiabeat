"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlayerSnapshot, QueueItem, RepeatMode, Song } from "@/lib/types";
import { notify } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useLibraryStore } from "@/store/libraryStore";

type PlayerStore = {
  sdkReady: boolean;
  deviceId: string | null;
  activeDeviceId: string | null;
  currentSong: Song | null;
  queue: QueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  volume: number;
  lastAudibleVolume: number;
  isMuted: boolean;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  playedTrackIds: string[];
  history: Song[];
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
  initializePlayer: () => Promise<void>;
  setSdkReady: (ready: boolean) => void;
  setDeviceId: (deviceId: string | null) => void;
  setActiveDeviceId: (deviceId: string | null) => void;
  syncFromSdkState: (state: Spotify.PlaybackState | null) => void;
  setVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  playSong: (song: Song, options?: { replaceQueue?: boolean }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  addToQueue: (song: Song) => Promise<void>;
  removeFromQueue: (queueItemId: string) => Promise<void>;
  reorderQueueItem: (queueItemId: string, direction: "up" | "down") => void;
  clearQueue: () => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setQueue: (songs: Song[], startIndex?: number) => void;
  removeFromQueueBySongId: (songId: string) => void;
  cycleRepeat: () => void;
  handleTrackEnded: () => void;
  hydrateQueueFromServerSnapshot: (
    queue: QueueItem[] | undefined,
    playerState?: PlayerSnapshot | null,
  ) => void;
  syncQueueFromServer: () => Promise<void>;
};

function queueItem(song: Song, position: number): QueueItem {
  return {
    id: `${song.spotifyTrackId}-${position}-${Date.now()}`,
    song,
    position,
  };
}

async function callJson(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Spotify request failed.");
  return data;
}

let transferPromise: Promise<boolean> | null = null;
let lastTransferredDeviceId: string | null = null;
let audioStartedTrackId: string | null = null;
let playbackCommandId = 0;
let pendingPlaybackTrackId: string | null = null;
let pendingPlaybackStartedAt = 0;
let queuePersistenceChain: Promise<void> = Promise.resolve();
const pendingPlaybackTimeoutMs = 10_000;

function markPlaybackTiming(name: string) {
  if (typeof performance === "undefined") return;
  performance.mark(`maiabeat:${name}`);
}

function clampVolume(volume: number) {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
}

function spotifySdkSong(track: Spotify.Track, fallback?: Song | null): Song {
  return {
    ...fallback,
    id: fallback?.id,
    spotifyTrackId: track.id,
    spotifyUri: track.uri,
    title: track.name,
    artist: track.artists?.map((artist) => artist.name).join(", ") || fallback?.artist || "Spotify",
    album: track.album?.name ?? fallback?.album,
    coverUrl: track.album?.images?.[0]?.url ?? fallback?.coverUrl ?? null,
    durationMs: track.duration_ms,
    externalUrl: fallback?.externalUrl ?? `https://open.spotify.com/track/${track.id}`,
  };
}

function markPlaybackPending(trackId: string) {
  pendingPlaybackTrackId = trackId;
  pendingPlaybackStartedAt = Date.now();
}

function clearPlaybackPending(trackId?: string) {
  if (!trackId || pendingPlaybackTrackId === trackId) {
    pendingPlaybackTrackId = null;
    pendingPlaybackStartedAt = 0;
  }
}

function persistQueueState(state: PlayerStore) {
  const user = useAuthStore.getState().user;
  if (!user || user.id === "local-preview") return;

  const payload = {
    songs: state.queue.map((item) => item.song),
    currentTrackId: state.currentSong?.spotifyTrackId ?? null,
    currentIndex: state.currentIndex,
    isPlaying: state.isPlaying,
    progressMs: state.progressMs,
    shuffleEnabled: state.shuffleEnabled,
    repeatMode: state.repeatMode,
  };

  queuePersistenceChain = queuePersistenceChain
    .catch(() => undefined)
    .then(async () => {
      await callJson("/api/library/queue", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    })
    .catch((error) => {
      notify(error instanceof Error ? error.message : "Queue sync failed.");
    });
}

function rememberRecentlyPlayed(song: Song) {
  window.setTimeout(() => {
    useLibraryStore.getState().addRecentlyPlayed(song);
  }, 0);
}

export function markSpotifyPlaybackDeviceStale(deviceId?: string | null) {
  if (!deviceId || lastTransferredDeviceId === deviceId) {
    lastTransferredDeviceId = null;
  }
  usePlayerStore.getState().setActiveDeviceId(null);
}

export async function ensureSpotifyPlaybackDevice(deviceId: string | null, force = false) {
  if (!deviceId) return false;

  const { activeDeviceId } = usePlayerStore.getState();
  if (!force && activeDeviceId === deviceId && lastTransferredDeviceId === deviceId) {
    markPlaybackTiming("transfer-skipped-active-device");
    return true;
  }

  if (transferPromise) return transferPromise;

  transferPromise = callJson("/api/spotify/transfer", {
    method: "PUT",
    body: JSON.stringify({ device_id: deviceId }),
  })
    .then(() => {
      markPlaybackTiming("transfer-complete");
      lastTransferredDeviceId = deviceId;
      usePlayerStore.getState().setActiveDeviceId(deviceId);
      return true;
    })
    .catch((error) => {
      markPlaybackTiming("transfer-failed");
      if (force) throw error;
      return false;
    })
    .finally(() => {
      transferPromise = null;
    });

  return transferPromise;
}

async function playOnSpotify(deviceId: string | null, song: Song, positionMs = 0) {
  if (!deviceId) {
    notify("Connect Spotify and wait for the Maiabeat device first.");
    return false;
  }

  if (!song.spotifyUri || song.spotifyUri.includes("demo-")) {
    notify("Connect Spotify to play full tracks.");
    return false;
  }

  await window.maiabeatActivateSpotifyPlayer?.().catch(() => undefined);
  markPlaybackTiming("transfer-start");
  await ensureSpotifyPlaybackDevice(deviceId).catch(() => false);

  try {
    markPlaybackTiming("play-request-start");
    await callJson("/api/spotify/play", {
      method: "PUT",
      body: JSON.stringify({ device_id: deviceId, spotifyUri: song.spotifyUri, positionMs }),
    });
    markPlaybackTiming("play-request-complete");
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("device") && !message.includes("active")) throw error;
    markSpotifyPlaybackDeviceStale(deviceId);
    markPlaybackTiming("transfer-start");
    await ensureSpotifyPlaybackDevice(deviceId, true);
    markPlaybackTiming("play-request-start");
    await callJson("/api/spotify/play", {
      method: "PUT",
      body: JSON.stringify({ device_id: deviceId, spotifyUri: song.spotifyUri, positionMs }),
    });
    markPlaybackTiming("play-request-complete");
  }
  return true;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      sdkReady: false,
      deviceId: null,
      activeDeviceId: null,
      currentSong: null,
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      progressMs: 0,
      durationMs: 0,
      volume: 0.8,
      lastAudibleVolume: 0.8,
      isMuted: false,
      shuffleEnabled: false,
      repeatMode: "off",
      playedTrackIds: [],
      history: [],
      currentTime: 0,
      duration: 0,
      shuffle: false,
      repeat: "off",
      error: null,
      initializePlayer: async () => {},
      setSdkReady: (ready) => set({ sdkReady: ready }),
      setDeviceId: (deviceId) => set({ deviceId }),
      setActiveDeviceId: (deviceId) => set({ activeDeviceId: deviceId }),
      setVolume: async (volume) => {
        const nextVolume = clampVolume(volume);
        set((state) => ({
          volume: nextVolume,
          isMuted: nextVolume === 0,
          lastAudibleVolume:
            nextVolume > 0 ? nextVolume : state.lastAudibleVolume || 0.8,
        }));

        try {
          await window.maiabeatSetSpotifyVolume?.(nextVolume);
        } catch (error) {
          notify(error instanceof Error ? error.message : "Volume update failed.");
        }
      },
      toggleMute: async () => {
        const { isMuted, lastAudibleVolume, setVolume } = get();
        await setVolume(isMuted ? lastAudibleVolume || 0.8 : 0);
      },
      syncFromSdkState: (state) => {
        if (!state) return;
        markPlaybackTiming("player-state-changed");
        const currentTrack = state.track_window?.current_track;
        const trackId = currentTrack?.id ?? null;

        if (
          trackId &&
          pendingPlaybackTrackId &&
          trackId !== pendingPlaybackTrackId &&
          Date.now() - pendingPlaybackStartedAt < pendingPlaybackTimeoutMs
        ) {
          return;
        }

        if (trackId && pendingPlaybackTrackId === trackId) {
          clearPlaybackPending(trackId);
        } else if (
          pendingPlaybackTrackId &&
          Date.now() - pendingPlaybackStartedAt >= pendingPlaybackTimeoutMs
        ) {
          clearPlaybackPending();
        }

        if (!state.paused && trackId && audioStartedTrackId !== trackId) {
          audioStartedTrackId = trackId;
          markPlaybackTiming("audio-started");
        }

        const previous = get();
        const previousTrackId = previous.currentSong?.spotifyTrackId ?? null;
        const trackChanged = Boolean(currentTrack && trackId !== previousTrackId);
        let currentSong = previous.currentSong;
        let queue = previous.queue;
        let currentIndex = previous.currentIndex;

        if (currentTrack) {
          const knownIndex = previous.queue.findIndex(
            (item) => item.song.spotifyTrackId === currentTrack.id,
          );
          const knownSong =
            knownIndex >= 0 ? previous.queue[knownIndex]?.song : previous.currentSong;
          currentSong = spotifySdkSong(currentTrack, knownSong);

          if (knownIndex >= 0) {
            currentIndex = knownIndex;
            queue = previous.queue.map((item, position) =>
              position === knownIndex ? { ...item, song: currentSong! } : item,
            );
          } else {
            const sdkTracks = [
              currentTrack,
              ...(state.track_window?.next_tracks ?? []),
            ].filter(
              (track, index, tracks) =>
                tracks.findIndex((candidate) => candidate.id === track.id) === index,
            );
            queue = sdkTracks.map((track, position) => ({
              id: `spotify-sdk-${track.id}-${position}`,
              position,
              song: spotifySdkSong(track, position === 0 ? currentSong : null),
            }));
            currentIndex = 0;
          }
        }

        set({
          currentSong,
          queue,
          currentIndex,
          isPlaying: !state.paused,
          progressMs: state.position,
          durationMs: state.duration,
          currentTime: Math.round(state.position / 1000),
          duration: Math.round(state.duration / 1000),
        });

        if (trackChanged) {
          persistQueueState(get());
        }
      },
      playSong: async (song, options = {}) => {
        markPlaybackTiming("play-song-start");
        audioStartedTrackId = null;
        markPlaybackPending(song.spotifyTrackId);
        const { currentSong, queue, deviceId } = get();
        const replaceQueue = options.replaceQueue ?? queue.length === 0;
        const nextQueue = replaceQueue ? [queueItem(song, 0)] : queue;
        const nextIndex = replaceQueue
          ? 0
          : Math.max(0, queue.findIndex((item) => item.song.spotifyTrackId === song.spotifyTrackId));
        const history =
          currentSong && currentSong.spotifyTrackId !== song.spotifyTrackId
            ? [currentSong, ...get().history].slice(0, 30)
            : get().history;

        set({
          currentSong: song,
          queue: nextQueue,
          currentIndex: nextIndex === -1 ? 0 : nextIndex,
          history,
          isPlaying: true,
          progressMs: 0,
          durationMs: song.durationMs,
          currentTime: 0,
          duration: Math.round(song.durationMs / 1000),
          error: null,
        });
        persistQueueState(get());

        const commandId = ++playbackCommandId;
        try {
          const started = await playOnSpotify(deviceId, song);
          if (commandId !== playbackCommandId) return;
          if (!started) {
            clearPlaybackPending(song.spotifyTrackId);
            set({ isPlaying: false });
            persistQueueState(get());
            return;
          }
          rememberRecentlyPlayed(song);
        } catch (error) {
          if (commandId !== playbackCommandId) return;
          clearPlaybackPending(song.spotifyTrackId);
          const message =
            error instanceof Error
              ? error.message
              : "Spotify Premium is required to play full tracks in Maiabeat.";
          set({ error: message, isPlaying: false });
          persistQueueState(get());
          notify(message);
        }
      },
      pause: async () => {
        markPlaybackTiming("pause-click");
        set({ isPlaying: false });
        const pauseWithFallback = async () => {
          try {
            if (window.maiabeatPauseSpotifyPlayer) {
              await window.maiabeatPauseSpotifyPlayer();
            } else {
              await callJson("/api/spotify/pause", { method: "PUT" });
            }
            markPlaybackTiming("pause-command-complete");
          } catch (error) {
            if (!window.maiabeatPauseSpotifyPlayer) {
              notify(error instanceof Error ? error.message : "Pause failed.");
              return;
            }

            try {
              await callJson("/api/spotify/pause", { method: "PUT" });
              markPlaybackTiming("pause-command-complete");
            } catch (fallbackError) {
              notify(fallbackError instanceof Error ? fallbackError.message : "Pause failed.");
            }
          }
        };

        markPlaybackTiming("pause-command-start");
        void pauseWithFallback();
      },
      resume: async () => {
        markPlaybackTiming("resume-click");
        const { currentSong, deviceId, activeDeviceId, progressMs } = get();
        if (!currentSong) return;
        set({ isPlaying: true });

        const resumeWithFallback = async () => {
          try {
            if (window.maiabeatResumeSpotifyPlayer && activeDeviceId === deviceId) {
              await window.maiabeatResumeSpotifyPlayer();
            } else if (deviceId) {
              await playOnSpotify(deviceId, currentSong, progressMs);
            } else {
              await callJson("/api/spotify/resume", { method: "PUT" });
            }
            markPlaybackTiming("resume-command-complete");
          } catch (error) {
            set({ isPlaying: false });
            notify(error instanceof Error ? error.message : "Resume failed.");
          }
        };

        markPlaybackTiming("resume-command-start");
        void resumeWithFallback();
      },
      togglePlay: async () => {
        if (get().isPlaying) await get().pause();
        else await get().resume();
      },
      next: async () => {
        const {
          currentSong,
          currentIndex,
          deviceId,
          playedTrackIds,
          queue,
          repeatMode,
          shuffleEnabled,
        } = get();
        if (!currentSong || !queue.length) return;

        let nextIndex = currentIndex + 1;
        let nextSong: Song | null = queue[nextIndex]?.song ?? null;
        let nextPlayed = [...playedTrackIds, currentSong.spotifyTrackId];

        if (shuffleEnabled) {
          const unplayed = queue.filter(
            (item) =>
              item.song.spotifyTrackId !== currentSong.spotifyTrackId &&
              !playedTrackIds.includes(item.song.spotifyTrackId),
          );

          if (unplayed.length) {
            const picked = unplayed[Math.floor(Math.random() * unplayed.length)];
            nextIndex = queue.findIndex((item) => item.id === picked.id);
            nextSong = picked.song;
          } else if (repeatMode === "all") {
            nextPlayed = [];
            const picked = queue[Math.floor(Math.random() * queue.length)];
            nextIndex = queue.findIndex((item) => item.id === picked.id);
            nextSong = picked.song;
          } else {
            set({ isPlaying: false });
            return;
          }
        } else if (!nextSong && repeatMode === "all") {
          nextIndex = 0;
          nextSong = queue[0]?.song ?? null;
        }

        if (!nextSong) {
          set({ isPlaying: false });
          return;
        }

        markPlaybackPending(nextSong.spotifyTrackId);

        set({
          currentIndex: nextIndex,
          currentSong: nextSong,
          history: currentSong ? [currentSong, ...get().history].slice(0, 30) : get().history,
          playedTrackIds: nextPlayed,
          isPlaying: true,
          progressMs: 0,
          currentTime: 0,
          durationMs: nextSong.durationMs,
          duration: Math.round(nextSong.durationMs / 1000),
        });
        persistQueueState(get());

        const commandId = ++playbackCommandId;
        try {
          const started = await playOnSpotify(deviceId, nextSong);
          if (commandId !== playbackCommandId) return;
          if (!started) {
            clearPlaybackPending(nextSong.spotifyTrackId);
            set({ isPlaying: false });
            persistQueueState(get());
            return;
          }
          rememberRecentlyPlayed(nextSong);
        } catch (error) {
          if (commandId !== playbackCommandId) return;
          clearPlaybackPending(nextSong.spotifyTrackId);
          set({ isPlaying: false });
          persistQueueState(get());
          notify(error instanceof Error ? error.message : "Next failed.");
        }
      },
      previous: async () => {
        const { progressMs, history, deviceId } = get();
        if (progressMs > 3000 && get().currentSong) {
          await get().seek(0);
          return;
        }

        const [previous, ...rest] = history;
        if (!previous) {
          await get().seek(0);
          return;
        }

        markPlaybackPending(previous.spotifyTrackId);

        const queueIndex = get().queue.findIndex(
          (item) => item.song.spotifyTrackId === previous.spotifyTrackId,
        );

        set({
          currentSong: previous,
          currentIndex: queueIndex === -1 ? get().currentIndex : queueIndex,
          history: rest,
          isPlaying: true,
          progressMs: 0,
          currentTime: 0,
          durationMs: previous.durationMs,
          duration: Math.round(previous.durationMs / 1000),
        });
        persistQueueState(get());

        const commandId = ++playbackCommandId;
        try {
          const started = await playOnSpotify(deviceId, previous);
          if (commandId !== playbackCommandId) return;
          if (!started) {
            clearPlaybackPending(previous.spotifyTrackId);
            set({ isPlaying: false });
            persistQueueState(get());
            return;
          }
          rememberRecentlyPlayed(previous);
        } catch (error) {
          if (commandId !== playbackCommandId) return;
          clearPlaybackPending(previous.spotifyTrackId);
          set({ isPlaying: false });
          persistQueueState(get());
          notify(error instanceof Error ? error.message : "Previous failed.");
        }
      },
      seek: async (positionMs) => {
        const safePosition = Math.max(0, Math.round(positionMs));
        set({
          progressMs: safePosition,
          currentTime: Math.round(safePosition / 1000),
        });

        try {
          await callJson("/api/spotify/seek", {
            method: "PUT",
            body: JSON.stringify({ positionMs: safePosition }),
          });
        } catch (error) {
          notify(error instanceof Error ? error.message : "Seek failed.");
        }
      },
      addToQueue: async (song) => {
        set((state) => ({
          queue: [
            ...state.queue,
            queueItem(song, state.queue.length),
          ],
        }));
        persistQueueState(get());
      },
      removeFromQueue: async (queueItemId) => {
        const removedSong = get().queue.find(
          (item) => item.id === queueItemId || item.song.spotifyTrackId === queueItemId,
        )?.song;
        const removedCurrent =
          removedSong?.spotifyTrackId === get().currentSong?.spotifyTrackId;
        set((state) => {
          const removedIndex = state.queue.findIndex(
            (item) => item.id === queueItemId || item.song.spotifyTrackId === queueItemId,
          );
          if (removedIndex < 0) return state;

          const nextQueue = state.queue
            .filter((item) => item.id !== queueItemId && item.song.spotifyTrackId !== queueItemId)
            .map((item, position) => ({ ...item, position }));
          const removedCurrent =
            state.currentSong?.spotifyTrackId === state.queue[removedIndex]?.song.spotifyTrackId;
          const nextIndex = removedCurrent
            ? Math.min(removedIndex, Math.max(0, nextQueue.length - 1))
            : removedIndex < state.currentIndex
              ? Math.max(0, state.currentIndex - 1)
              : state.currentIndex;
          const currentSong = removedCurrent
            ? (nextQueue[nextIndex]?.song ?? null)
            : state.currentSong;

          return {
            queue: nextQueue,
            currentIndex: currentSong ? nextIndex : 0,
            currentSong,
            isPlaying: currentSong ? state.isPlaying : false,
            progressMs: removedCurrent ? 0 : state.progressMs,
            currentTime: removedCurrent ? 0 : state.currentTime,
            durationMs: removedCurrent ? (currentSong?.durationMs ?? 0) : state.durationMs,
            duration: removedCurrent
              ? currentSong
                ? Math.round(currentSong.durationMs / 1000)
                : 0
              : state.duration,
          };
        });
        persistQueueState(get());
        const nextSong = get().currentSong;
        if (removedCurrent && nextSong) {
          await get().playSong(nextSong, { replaceQueue: false });
        }
      },
      reorderQueueItem: (queueItemId, direction) => {
        set((state) => {
          const index = state.queue.findIndex((item) => item.id === queueItemId);
          const target = direction === "up" ? index - 1 : index + 1;
          if (index < 0 || target < 0 || target >= state.queue.length) return state;
          const nextQueue = [...state.queue];
          const [item] = nextQueue.splice(index, 1);
          nextQueue.splice(target, 0, item);
          return {
            queue: nextQueue.map((queueItem, position) => ({ ...queueItem, position })),
            currentIndex:
              state.currentIndex === index
                ? target
                : state.currentIndex === target
                  ? index
                  : state.currentIndex,
          };
        });
        persistQueueState(get());
      },
      clearQueue: async () => {
        set({
          queue: [],
          currentIndex: 0,
          currentSong: null,
          isPlaying: false,
          progressMs: 0,
          currentTime: 0,
        });
        persistQueueState(get());
      },
      toggleShuffle: () => {
        set((state) => ({
          shuffleEnabled: !state.shuffleEnabled,
          shuffle: !state.shuffleEnabled,
          playedTrackIds: [],
        }));
        persistQueueState(get());
      },
      cycleRepeatMode: () => {
        set((state) => {
          const repeatMode: RepeatMode =
            state.repeatMode === "off"
              ? "all"
              : state.repeatMode === "all"
                ? "one"
                : "off";
          return { repeatMode, repeat: repeatMode };
        });
        persistQueueState(get());
      },
      setDuration: (duration) =>
        set({ duration, durationMs: Math.round(duration * 1000) }),
      setCurrentTime: (time) =>
        set({ currentTime: time, progressMs: Math.round(time * 1000) }),
      nextTrack: () => {
        void get().next();
      },
      previousTrack: () => {
        void get().previous();
      },
      setQueue: (songs, startIndex = 0) => {
        const nextQueue = songs.map(queueItem);
        const safeStartIndex =
          Number.isInteger(startIndex) && startIndex >= 0 && startIndex < nextQueue.length
            ? startIndex
            : 0;
        const current = nextQueue[safeStartIndex]?.song ?? null;
        set({
          queue: nextQueue,
          currentIndex: current ? safeStartIndex : 0,
          currentSong: current,
          isPlaying: Boolean(current),
          progressMs: 0,
          currentTime: 0,
          durationMs: current?.durationMs ?? 0,
          duration: current ? Math.round(current.durationMs / 1000) : 0,
        });
        if (current) {
          void get().playSong(current, { replaceQueue: false });
        } else {
          persistQueueState(get());
        }
      },
      removeFromQueueBySongId: (songId) => {
        void get().removeFromQueue(songId);
      },
      cycleRepeat: () => get().cycleRepeatMode(),
      handleTrackEnded: () => {
        const { currentSong, deviceId, repeatMode } = get();
        if (repeatMode === "one" && currentSong) {
          set({ isPlaying: true, progressMs: 0, currentTime: 0 });
          const commandId = ++playbackCommandId;
          void playOnSpotify(deviceId, currentSong, 0)
            .then(() => {
              if (commandId === playbackCommandId) rememberRecentlyPlayed(currentSong);
            })
            .catch((error) => {
              if (commandId === playbackCommandId) {
                notify(error instanceof Error ? error.message : "Repeat failed.");
              }
            });
          return;
        }
        void get().next();
      },
      hydrateQueueFromServerSnapshot: (queue, playerState) => {
        if (!queue) return;
        const preferredTrackId =
          playerState?.currentSong?.spotifyTrackId ?? get().currentSong?.spotifyTrackId;
        const matchedIndex = preferredTrackId
          ? queue.findIndex((item) => item.song.spotifyTrackId === preferredTrackId)
          : -1;
        const snapshotIndex = playerState?.currentIndex ?? get().currentIndex;
        const safeIndex =
          matchedIndex >= 0
            ? matchedIndex
            : snapshotIndex >= 0 && snapshotIndex < queue.length
              ? snapshotIndex
              : 0;
        const currentSong = queue[safeIndex]?.song ?? playerState?.currentSong ?? get().currentSong;
        const progressMs = Math.max(0, playerState?.progressMs ?? 0);
        set({
          queue,
          currentIndex: currentSong ? safeIndex : 0,
          currentSong,
          isPlaying: playerState?.isPlaying ?? false,
          progressMs,
          currentTime: Math.round(progressMs / 1000),
          durationMs: currentSong?.durationMs ?? 0,
          duration: currentSong ? Math.round(currentSong.durationMs / 1000) : 0,
          shuffleEnabled: playerState?.shuffleEnabled ?? get().shuffleEnabled,
          shuffle: playerState?.shuffleEnabled ?? get().shuffleEnabled,
          repeatMode: playerState?.repeatMode ?? get().repeatMode,
          repeat: playerState?.repeatMode ?? get().repeatMode,
        });
      },
      syncQueueFromServer: async () => {
        const response = await fetch("/api/library");
        if (!response.ok) return;
        const data = (await response.json()) as {
          queue?: QueueItem[];
          playerState?: PlayerSnapshot | null;
        };
        get().hydrateQueueFromServerSnapshot(data.queue, data.playerState);
      },
    }),
    {
      name: "maiabeat-player",
      partialize: (state) => ({
        currentSong: state.currentSong,
        queue: state.queue,
        currentIndex: state.currentIndex,
        shuffleEnabled: state.shuffleEnabled,
        repeatMode: state.repeatMode,
        volume: state.volume,
        lastAudibleVolume: state.lastAudibleVolume,
        isMuted: state.isMuted,
        history: state.history,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setDeviceId(null);
        state?.setSdkReady(false);
      },
    },
  ),
);
