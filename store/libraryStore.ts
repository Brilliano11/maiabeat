"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { makeId } from "@/lib/utils";
import type { Playlist, Song } from "@/lib/types";

type LibraryState = {
  likedSongs: Song[];
  playlists: Playlist[];
  savedSongs: Record<string, Song>;
  recentlyPlayed: Song[];
  theme: "sunny" | "night";
  likeSong: (song: Song) => void;
  unlikeSong: (songId: string) => void;
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;
  createPlaylist: (name: string, description?: string, visibility?: "private" | "shared") => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  addRecentlyPlayed: (song: Song) => void;
  clearRecentlyPlayed: () => void;
  syncFromServer: () => Promise<void>;
  clearAll: () => void;
  toggleTheme: () => void;
};

const demoUserId = "local-user";
const songKey = (song: Song) => song.id ?? song.spotifyTrackId;
const uniqueSongs = (songs: Song[]) => {
  const seen = new Set<string>();
  return songs.filter((song) => {
    const key = songKey(song);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

async function postJson<T>(path: string, body?: unknown, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedSongs: [],
      playlists: [
        {
          id: "playlist-anggitunes",
          userId: demoUserId,
          name: "Anggitunes",
          description: "A loud little starter pack.",
          coverUrl: "/icons/cover-pink.svg",
          songIds: ["demo-1", "demo-2", "demo-3"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      savedSongs: {},
      recentlyPlayed: [],
      theme: "sunny",
      likeSong: (song) =>
        set((state) => {
          if (state.likedSongs.some((item) => songKey(item) === songKey(song))) return state;
          void postJson("/api/library/liked", { song }).catch(() => undefined);
          return {
            likedSongs: [song, ...state.likedSongs],
            savedSongs: { ...state.savedSongs, [songKey(song)]: song },
          };
        }),
      unlikeSong: (songId) =>
        set((state) => {
          const song = state.likedSongs.find((item) => songKey(item) === songId);
          if (song) void postJson("/api/library/liked", { song }).catch(() => undefined);
          return {
            likedSongs: state.likedSongs.filter((item) => songKey(item) !== songId),
          };
        }),
      toggleLike: (song) => {
        if (get().isLiked(songKey(song))) get().unlikeSong(songKey(song));
        else get().likeSong(song);
      },
      isLiked: (songId) => get().likedSongs.some((song) => songKey(song) === songId),
      createPlaylist: (name, description, visibility = "shared") => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = new Date().toISOString();
        set((state) => ({
          playlists: [
            {
              id: makeId("playlist"),
              userId: demoUserId,
              name: trimmed,
              description,
              visibility,
              coverUrl: "/icons/default-cover.svg",
              songIds: [],
              createdAt: now,
              updatedAt: now,
            },
            ...state.playlists,
          ],
        }));
        void postJson<{ playlist: Playlist }>("/api/library/playlists", {
          name: trimmed,
          description,
          visibility,
        })
          .then(({ playlist }) =>
            set((state) => ({
              playlists: [
                playlist,
                ...state.playlists.filter((item) => item.name !== trimmed),
              ],
            })),
          )
          .catch(() => undefined);
      },
      deletePlaylist: (playlistId) =>
        set((state) => {
          void fetch(`/api/library/playlists/${playlistId}`, { method: "DELETE" }).catch(
            () => undefined,
          );
          return {
            playlists: state.playlists.filter((playlist) => playlist.id !== playlistId),
          };
        }),
      renamePlaylist: (playlistId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, name: trimmed, updatedAt: new Date().toISOString() }
              : playlist,
          ),
        }));
        void postJson(`/api/library/playlists/${playlistId}`, { name: trimmed }, { method: "PATCH" }).catch(
          () => undefined,
        );
      },
      addSongToPlaylist: (playlistId, song) =>
        set((state) => {
          void postJson(`/api/library/playlists/${playlistId}/songs`, { song }).catch(
            () => undefined,
          );
          return {
            savedSongs: { ...state.savedSongs, [songKey(song)]: song },
            playlists: state.playlists.map((playlist) =>
              playlist.id === playlistId && !playlist.songIds.includes(songKey(song))
                ? {
                    ...playlist,
                    songIds: [...playlist.songIds, songKey(song)],
                    coverUrl: playlist.coverUrl || song.coverUrl,
                    updatedAt: new Date().toISOString(),
                  }
                : playlist,
            ),
          };
        }),
      removeSongFromPlaylist: (playlistId, songId) =>
        set((state) => {
          void postJson(
            `/api/library/playlists/${playlistId}/songs`,
            { songId },
            { method: "DELETE" },
          ).catch(() => undefined);
          return {
            playlists: state.playlists.map((playlist) =>
              playlist.id === playlistId
                ? {
                    ...playlist,
                    songIds: playlist.songIds.filter((id) => id !== songId),
                    updatedAt: new Date().toISOString(),
                  }
                : playlist,
            ),
          };
        }),
      addRecentlyPlayed: (song) =>
        set((state) => {
          void postJson("/api/library/recent", { song }).catch(() => undefined);
          return {
            savedSongs: { ...state.savedSongs, [songKey(song)]: song },
            recentlyPlayed: [
              song,
              ...state.recentlyPlayed.filter((item) => songKey(item) !== songKey(song)),
            ].slice(0, 20),
          };
        }),
      clearRecentlyPlayed: () => {
        void fetch("/api/library/recent", { method: "DELETE" }).catch(() => undefined);
        set({ recentlyPlayed: [] });
      },
      syncFromServer: async () => {
        const response = await fetch("/api/library");
        if (!response.ok) return;
        const data = (await response.json()) as {
          likedSongs: Song[];
          playlists: Playlist[];
          recentlyPlayed: Song[];
        };
        const savedSongs = Object.fromEntries(
          [...data.likedSongs, ...data.recentlyPlayed].map((song) => [songKey(song), song]),
        );
        set({
          likedSongs: uniqueSongs(data.likedSongs),
          playlists: data.playlists,
          recentlyPlayed: uniqueSongs(data.recentlyPlayed),
          savedSongs,
        });
      },
      clearAll: () =>
        set({
          likedSongs: [],
          playlists: [],
          savedSongs: {},
          recentlyPlayed: [],
        }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "sunny" ? "night" : "sunny" })),
    }),
    { name: "maiabeat-library" },
  ),
);
