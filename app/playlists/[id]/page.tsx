"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Compass,
  Lock,
  Music2,
  Pencil,
  Play,
  Search,
  Shuffle,
  Trash2,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { PlaylistEditModal } from "@/components/PlaylistEditModal";
import { PlaylistTrackRow } from "@/components/PlaylistTrackRow";
import { dummySongs } from "@/data/dummySongs";
import type { Song } from "@/lib/types";
import { notify, shuffleSongs } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";

type PlaylistEntry = {
  songId: string;
  originalIndex: number;
  song: Song;
};

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const playlists = useLibraryStore((state) => state.playlists);
  const savedSongs = useLibraryStore((state) => state.savedSongs);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const removeSongFromPlaylist = useLibraryStore((state) => state.removeSongFromPlaylist);
  const reorderPlaylistSongs = useLibraryStore((state) => state.reorderPlaylistSongs);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const playlist = playlists.find((item) => item.id === params.id);

  const entries = useMemo(
    () =>
      (playlist?.songIds ?? [])
        .map((songId, originalIndex) => ({
          songId,
          originalIndex,
          song:
            savedSongs[songId] ??
            dummySongs.find((song) => song.id === songId || song.spotifyTrackId === songId),
        }))
        .filter((entry): entry is PlaylistEntry => Boolean(entry.song)),
    [playlist?.songIds, savedSongs],
  );
  const songs = useMemo(() => entries.map((entry) => entry.song), [entries]);

  if (!playlist) {
    return (
      <AuthGuard>
        <AppShell>
          <BrutalCard className="grid gap-3 bg-[#FFD600]">
            <h1 className="text-3xl font-black">Playlist not found</h1>
            <BrutalButton onClick={() => router.push("/playlists")}>Back</BrutalButton>
          </BrutalCard>
        </AppShell>
      </AuthGuard>
    );
  }

  const canManage =
    user?.id === "local-preview" || playlist.ownerId === user?.id || playlist.userId === user?.id;
  const coverUrl = playlist.coverUrl || "/icons/default-cover.svg";
  const moveSong = (originalIndex: number, direction: "up" | "down") => {
    const target = direction === "up" ? originalIndex - 1 : originalIndex + 1;
    if (target < 0 || target >= playlist.songIds.length) return;
    const nextSongIds = [...playlist.songIds];
    [nextSongIds[originalIndex], nextSongIds[target]] = [
      nextSongIds[target],
      nextSongIds[originalIndex],
    ];
    reorderPlaylistSongs(playlist.id, nextSongIds);
    notify("Playlist order updated");
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header className="playlist-detail-header">
            <Image
              src={coverUrl}
              alt=""
              width={160}
              height={160}
              sizes="(min-width: 768px) 144px, 112px"
              unoptimized={coverUrl.startsWith("data:image/")}
              className="h-28 w-28 rounded-2xl border-[3px] border-black object-cover md:h-36 md:w-36"
            />
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase">
                {playlist.visibility === "private" ? <Lock size={15} /> : <UsersRound size={15} />}
                {playlist.visibility ?? "shared"} playlist
              </div>
              <h1 className="text-ellipsis page-title">{playlist.name}</h1>
              <p className="mt-2 line-clamp-2 font-bold">
                {playlist.description || "No description yet."}
              </p>
              <p className="mt-2 text-sm font-black">{songs.length} songs</p>
            </div>
          </header>

          <div className="action-grid">
            <BrutalButton
              tone="green"
              icon={<Play size={17} />}
              disabled={!songs.length}
              onClick={() => setQueue(songs, 0)}
            >
              Play All
            </BrutalButton>
            <BrutalButton
              tone="yellow"
              icon={<Shuffle size={17} />}
              disabled={!songs.length}
              onClick={() => setQueue(shuffleSongs(songs), 0)}
            >
              Shuffle
            </BrutalButton>
            {canManage ? (
              <>
                <BrutalButton
                  tone="cyan"
                  icon={<Pencil size={17} />}
                  onClick={() => setEditOpen(true)}
                >
                  Edit
                </BrutalButton>
                <BrutalButton
                  tone="pink"
                  icon={<Trash2 size={17} />}
                  onClick={() => {
                    if (!window.confirm(`Delete "${playlist.name}"?`)) return;
                    deletePlaylist(playlist.id);
                    router.push("/playlists");
                  }}
                >
                  Delete
                </BrutalButton>
              </>
            ) : null}
          </div>

          <section className="grid gap-3" aria-labelledby="playlist-tracks-title">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="page-kicker">Tracklist</p>
                <h2 id="playlist-tracks-title" className="section-title">
                  Songs
                </h2>
              </div>
              <span className="result-count">{songs.length}</span>
            </div>
            <div className="playlist-track-list">
              {entries.map((entry, resolvedIndex) => (
                <PlaylistTrackRow
                  key={entry.songId}
                  song={entry.song}
                  position={entry.originalIndex}
                  total={playlist.songIds.length}
                  onPlay={() => setQueue(songs, resolvedIndex)}
                  onMoveUp={() => moveSong(entry.originalIndex, "up")}
                  onMoveDown={() => moveSong(entry.originalIndex, "down")}
                  onRemove={() => {
                    if (!window.confirm(`Remove "${entry.song.title}" from this playlist?`)) return;
                    removeSongFromPlaylist(playlist.id, entry.songId);
                    notify("Song removed from playlist");
                  }}
                />
              ))}
              {!entries.length ? (
                <div className="playlist-empty-state">
                  <div className="playlist-empty-art" aria-hidden="true">
                    <div className="playlist-empty-cover-shadow" />
                    <div className="playlist-empty-cover">
                      <Image
                        src={coverUrl}
                        alt=""
                        width={180}
                        height={180}
                        sizes="(min-width: 640px) 180px, 132px"
                        unoptimized={coverUrl.startsWith("data:image/")}
                      />
                      <span className="playlist-empty-note">
                        <Music2 size={24} strokeWidth={3} />
                      </span>
                    </div>
                  </div>

                  <div className="playlist-empty-content">
                    <p className="page-kicker">Empty playlist</p>
                    <h3>{canManage ? "Start your tracklist" : "No songs here yet"}</h3>
                    <p>
                      {canManage
                        ? "Find a song you love and make this playlist yours."
                        : "The owner has not added any songs to this playlist yet."}
                    </p>
                    <div className="playlist-empty-actions">
                      {canManage ? (
                        <BrutalButton
                          tone="green"
                          icon={<Search size={17} />}
                          onClick={() => router.push("/search")}
                        >
                          Find songs
                        </BrutalButton>
                      ) : null}
                      <BrutalButton
                        tone={canManage ? "yellow" : "green"}
                        icon={<Compass size={17} />}
                        onClick={() => router.push("/explore")}
                      >
                        Explore
                      </BrutalButton>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
        {editOpen ? (
          <PlaylistEditModal
            key={`${playlist.id}-${playlist.updatedAt}`}
            playlist={playlist}
            onClose={() => setEditOpen(false)}
          />
        ) : null}
      </AppShell>
    </AuthGuard>
  );
}
