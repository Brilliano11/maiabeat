"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Pencil, Play, Shuffle, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import { dummySongs } from "@/data/dummySongs";
import { shuffleSongs } from "@/lib/utils";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const playlists = useLibraryStore((state) => state.playlists);
  const savedSongs = useLibraryStore((state) => state.savedSongs);
  const renamePlaylist = useLibraryStore((state) => state.renamePlaylist);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const removeSongFromPlaylist = useLibraryStore((state) => state.removeSongFromPlaylist);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const playlist = playlists.find((item) => item.id === params.id);
  const [name, setName] = useState(playlist?.name ?? "");

  const songs = useMemo(
    () =>
      playlist?.songIds
        .map((id) => savedSongs[id] ?? dummySongs.find((song) => song.id === id || song.spotifyTrackId === id))
        .filter(Boolean) ?? [],
    [playlist, savedSongs],
  );

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

  const submitRename = (event: FormEvent) => {
    event.preventDefault();
    renamePlaylist(playlist.id, name);
    setEditing(false);
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header className="grid gap-5 rounded-[2rem] border-[3px] border-black bg-[#00C2FF] p-5 shadow-[6px_6px_0_#000] md:grid-cols-[140px_minmax(0,1fr)] md:items-end lg:p-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={playlist.coverUrl || "/icons/default-cover.svg"}
              alt=""
              className="h-28 w-28 rounded-2xl border-[3px] border-black object-cover md:h-32 md:w-32"
            />
            <div className="min-w-0">
              {editing ? (
                <form onSubmit={submitRename} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="min-w-0 rounded-2xl border-[3px] border-black bg-white px-3 py-3 font-black outline-none"
                  />
                  <BrutalButton type="submit" tone="green">
                    Save
                  </BrutalButton>
                </form>
              ) : (
                <h1 className="text-ellipsis page-title">{playlist.name}</h1>
              )}
              <p className="font-bold">{songs.length} songs</p>
            </div>
          </header>
          <div className="action-grid">
            <BrutalButton tone="green" icon={<Play size={17} />} disabled={!songs.length} onClick={() => setQueue(songs, 0)}>
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
            <BrutalButton tone="cyan" icon={<Pencil size={17} />} onClick={() => setEditing((value) => !value)}>
              Rename
            </BrutalButton>
            <BrutalButton
              tone="pink"
              icon={<Trash2 size={17} />}
              onClick={() => {
                deletePlaylist(playlist.id);
                router.push("/playlists");
              }}
            >
              Delete
            </BrutalButton>
          </div>
          <div className="song-grid">
            {songs.map((song) => (
              <div key={song.id ?? song.spotifyTrackId} className="grid gap-2">
                <SongCard song={song} songs={songs} compact />
                <button
                  onClick={() => removeSongFromPlaylist(playlist.id, song.id ?? song.spotifyTrackId)}
                  className="rounded-2xl border-[3px] border-black bg-[#FF3B6B] px-3 py-2 text-sm font-black text-white shadow-[4px_4px_0_#000]"
                >
                  Remove from playlist
                </button>
              </div>
            ))}
            {!songs.length ? (
              <BrutalCard className="text-center font-black">
                Add songs from Search or Home.
              </BrutalCard>
            ) : null}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
