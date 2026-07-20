"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { makeId, notify } from "@/lib/utils";
import type { Playlist, PlaylistUpdate, Song } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

export type AppTheme = "sunny" | "night" | "maria";

type LibraryState = {
  likedSongs: Song[];
  playlists: Playlist[];
  savedSongs: Record<string, Song>;
  recentlyPlayed: Song[];
  theme: AppTheme;
  likeSong: (song: Song) => void;
  unlikeSong: (songId: string) => void;
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;
  createPlaylist: (name: string, description?: string, visibility?: "private" | "shared") => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  updatePlaylist: (playlistId: string, input: PlaylistUpdate) => void;
  reorderPlaylistSongs: (playlistId: string, songIds: string[]) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  addRecentlyPlayed: (song: Song) => void;
  clearRecentlyPlayed: () => void;
  hydrateFromServerSnapshot: (data: {
    likedSongs: Song[];
    playlists: Playlist[];
    recentlyPlayed: Song[];
    playlistSongs?: Song[];
  }) => void;
  syncFromServer: () => Promise<{
    likedSongs: Song[];
    playlists: Playlist[];
    recentlyPlayed: Song[];
    queue?: unknown[];
  } | null>;
  clearAll: () => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const demoUserId = "local-user";
const songKey = (song: Song) => song.id ?? song.spotifyTrackId;
const isDemoSong = (song?: Song) => Boolean(song?.spotifyUri?.includes("demo-"));
const shouldPersistToServer = (song?: Song) => {
  const userId = useAuthStore.getState().user?.id;
  return Boolean(userId && userId !== "local-preview" && !isDemoSong(song));
};
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
          if (shouldPersistToServer(song)) {
            void postJson("/api/library/liked", { song }).catch(() => undefined);
          }
          return {
            likedSongs: [song, ...state.likedSongs],
            savedSongs: { ...state.savedSongs, [songKey(song)]: song },
          };
        }),
      unlikeSong: (songId) =>
        set((state) => {
          const song = state.likedSongs.find((item) => songKey(item) === songId);
          if (song && shouldPersistToServer(song)) {
            void postJson("/api/library/liked", { song }).catch(() => undefined);
          }
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
        const ownerId = useAuthStore.getState().user?.id ?? demoUserId;
        set((state) => ({
          playlists: [
            {
              id: makeId("playlist"),
              ownerId,
              userId: ownerId,
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
        if (shouldPersistToServer()) {
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
        }
      },
      deletePlaylist: (playlistId) =>
        set((state) => {
          if (shouldPersistToServer()) {
            void fetch(`/api/library/playlists/${playlistId}`, { method: "DELETE" }).catch(
              () => undefined,
            );
          }
          return {
            playlists: state.playlists.filter((playlist) => playlist.id !== playlistId),
          };
        }),
      renamePlaylist: (playlistId, name) => get().updatePlaylist(playlistId, { name }),
      updatePlaylist: (playlistId, input) => {
        const name = input.name?.trim();
        if (input.name !== undefined && !name) return;
        const normalized: PlaylistUpdate = {
          ...input,
          name,
          description: input.description?.trim(),
        };
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, ...normalized, updatedAt: new Date().toISOString() }
              : playlist,
            ),
        }));
        if (shouldPersistToServer()) {
          void postJson(`/api/library/playlists/${playlistId}`, normalized, {
            method: "PATCH",
          }).catch((error) => {
            notify(error instanceof Error ? error.message : "Playlist update failed.");
          });
        }
      },
      reorderPlaylistSongs: (playlistId, songIds) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, songIds, updatedAt: new Date().toISOString() }
              : playlist,
          ),
        }));
        if (shouldPersistToServer()) {
          void postJson(
            `/api/library/playlists/${playlistId}/songs`,
            { songIds },
            { method: "PUT" },
          ).catch((error) => {
            notify(error instanceof Error ? error.message : "Playlist reorder failed.");
          });
        }
      },
      addSongToPlaylist: (playlistId, song) =>
        set((state) => {
          if (shouldPersistToServer(song)) {
            void postJson(`/api/library/playlists/${playlistId}/songs`, { song }).catch(
              () => undefined,
            );
          }
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
          if (shouldPersistToServer()) {
            void postJson(
              `/api/library/playlists/${playlistId}/songs`,
              { songId },
              { method: "DELETE" },
            ).catch(() => undefined);
          }
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
          if (shouldPersistToServer(song)) {
            void postJson("/api/library/recent", { song }).catch(() => undefined);
          }
          return {
            savedSongs: { ...state.savedSongs, [songKey(song)]: song },
            recentlyPlayed: [
              song,
              ...state.recentlyPlayed.filter((item) => songKey(item) !== songKey(song)),
            ].slice(0, 20),
          };
        }),
      clearRecentlyPlayed: () => {
        if (shouldPersistToServer()) {
          void fetch("/api/library/recent", { method: "DELETE" }).catch(() => undefined);
        }
        set({ recentlyPlayed: [] });
      },
      hydrateFromServerSnapshot: (data) => {
        const savedSongs = Object.fromEntries(
          [...data.likedSongs, ...data.recentlyPlayed, ...(data.playlistSongs ?? [])].map(
            (song) => [songKey(song), song],
          ),
        );
        set({
          likedSongs: uniqueSongs(data.likedSongs),
          playlists: data.playlists,
          recentlyPlayed: uniqueSongs(data.recentlyPlayed),
          savedSongs,
        });
      },
      syncFromServer: async () => {
        const response = await fetch("/api/library");
        if (!response.ok) return null;
        const data = (await response.json()) as {
          likedSongs: Song[];
          playlists: Playlist[];
          recentlyPlayed: Song[];
          queue?: unknown[];
        };
        get().hydrateFromServerSnapshot(data);
        return data;
      },
      clearAll: () =>
        set({
          likedSongs: [],
          playlists: [],
          savedSongs: {},
          recentlyPlayed: [],
        }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "sunny" ? "night" : state.theme === "night" ? "maria" : "sunny",
        })),
    }),
    { name: "maiabeat-library" },
  ),
);
