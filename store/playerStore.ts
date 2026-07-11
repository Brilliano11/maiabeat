"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueueItem, RepeatMode, Song } from "@/lib/types";
import { notify } from "@/lib/utils";
import { useLibraryStore } from "@/store/libraryStore";

type PlayerStore = {
  sdkReady: boolean;
  deviceId: string | null;
  currentSong: Song | null;
  queue: QueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
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
  syncFromSdkState: (state: Spotify.PlaybackState | null) => void;
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
  await callJson("/api/spotify/transfer", {
    method: "PUT",
    body: JSON.stringify({ device_id: deviceId }),
  }).catch(() => undefined);
  await callJson("/api/spotify/play", {
    method: "PUT",
    body: JSON.stringify({ device_id: deviceId, spotifyUri: song.spotifyUri, positionMs }),
  });
  return true;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      sdkReady: false,
      deviceId: null,
      currentSong: null,
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      progressMs: 0,
      durationMs: 0,
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
      syncFromSdkState: (state) => {
        if (!state) return;
        set({
          isPlaying: !state.paused,
          progressMs: state.position,
          durationMs: state.duration,
          currentTime: Math.round(state.position / 1000),
          duration: Math.round(state.duration / 1000),
        });
      },
      playSong: async (song, options = {}) => {
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

        useLibraryStore.getState().addRecentlyPlayed(song);

        try {
          await playOnSpotify(deviceId, song);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Spotify Premium is required to play full tracks in Maiabeat.";
          set({ error: message, isPlaying: false });
          notify(message);
        }
      },
      pause: async () => {
        set({ isPlaying: false });
        try {
          await callJson("/api/spotify/pause", { method: "PUT" });
        } catch (error) {
          notify(error instanceof Error ? error.message : "Pause failed.");
        }
      },
      resume: async () => {
        const { currentSong, deviceId, progressMs } = get();
        if (!currentSong) return;
        set({ isPlaying: true });
        try {
          if (deviceId) await playOnSpotify(deviceId, currentSong, progressMs);
          else await callJson("/api/spotify/resume", { method: "PUT" });
        } catch (error) {
          set({ isPlaying: false });
          notify(error instanceof Error ? error.message : "Resume failed.");
        }
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

        if (repeatMode === "one") {
          set({ progressMs: 0, currentTime: 0 });
          try {
            await playOnSpotify(deviceId, currentSong, 0);
          } catch (error) {
            notify(error instanceof Error ? error.message : "Repeat failed.");
          }
          return;
        }

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
        useLibraryStore.getState().addRecentlyPlayed(nextSong);

        try {
          await playOnSpotify(deviceId, nextSong);
        } catch (error) {
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

        try {
          await playOnSpotify(deviceId, previous);
        } catch (error) {
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
        void callJson("/api/library/queue", {
          method: "POST",
          body: JSON.stringify({ song }),
        }).catch(() => undefined);
        set((state) => ({
          queue: [
            ...state.queue,
            queueItem(song, state.queue.length),
          ],
        }));
      },
      removeFromQueue: async (queueItemId) => {
        void fetch(`/api/library/queue/${queueItemId}`, { method: "DELETE" }).catch(
          () => undefined,
        );
        set((state) => ({
          queue: state.queue
            .filter((item) => item.id !== queueItemId && item.song.spotifyTrackId !== queueItemId)
            .map((item, position) => ({ ...item, position })),
        }));
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
      },
      clearQueue: async () => {
        void fetch("/api/library/queue", { method: "DELETE" }).catch(() => undefined);
        set({
          queue: [],
          currentIndex: 0,
          currentSong: null,
          isPlaying: false,
          progressMs: 0,
          currentTime: 0,
        });
      },
      toggleShuffle: () =>
        set((state) => ({
          shuffleEnabled: !state.shuffleEnabled,
          shuffle: !state.shuffleEnabled,
          playedTrackIds: [],
        })),
      cycleRepeatMode: () =>
        set((state) => {
          const repeatMode: RepeatMode =
            state.repeatMode === "off"
              ? "all"
              : state.repeatMode === "all"
                ? "one"
                : "off";
          return { repeatMode, repeat: repeatMode };
        }),
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
        const current = nextQueue[startIndex]?.song ?? nextQueue[0]?.song ?? null;
        set({
          queue: nextQueue,
          currentIndex: current ? Math.max(0, startIndex) : 0,
          currentSong: current,
          isPlaying: Boolean(current),
          progressMs: 0,
          currentTime: 0,
          durationMs: current?.durationMs ?? 0,
          duration: current ? Math.round(current.durationMs / 1000) : 0,
        });
        if (current) {
          void get().playSong(current, { replaceQueue: false });
        }
      },
      removeFromQueueBySongId: (songId) => {
        void get().removeFromQueue(songId);
      },
      cycleRepeat: () => get().cycleRepeatMode(),
      handleTrackEnded: () => {
        void get().next();
      },
      syncQueueFromServer: async () => {
        const response = await fetch("/api/library");
        if (!response.ok) return;
        const data = (await response.json()) as { queue?: QueueItem[] };
        if (!data.queue) return;
        set({
          queue: data.queue,
          currentIndex: 0,
          currentSong: data.queue[0]?.song ?? get().currentSong,
        });
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
        history: state.history,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setDeviceId(null);
        state?.setSdkReady(false);
      },
    },
  ),
);
