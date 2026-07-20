"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ListPlus, Play, Shuffle } from "lucide-react";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import type { Playlist, PlaylistItem, SearchPagination, Song } from "@/lib/types";
import { notify, shuffleSongs } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

type PlaylistPayload = {
  source: "maiabeat" | "spotify";
  playlist: Playlist | PlaylistItem;
  tracks: Song[];
  pagination: SearchPagination;
};

function playlistTitle(playlist: Playlist | PlaylistItem) {
  return "name" in playlist ? playlist.name : "Playlist";
}

function playlistCover(playlist: Playlist | PlaylistItem) {
  return "coverUrl" in playlist ? playlist.coverUrl : null;
}

export default function PlaylistDetailAliasPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PlaylistPayload | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const setQueue = usePlayerStore((state) => state.setQueue);
  const addToQueue = usePlayerStore((state) => state.addToQueue);

  const load = useCallback(
    async (offset = 0, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const response = await fetch(`/api/playlist/${params.id}?limit=50&offset=${offset}`);
        const payload = (await response.json()) as PlaylistPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Tidak dapat memuat musik.");
        setData((current) =>
          append && current
            ? {
                ...payload,
                tracks: [
                  ...current.tracks,
                  ...payload.tracks.filter(
                    (song) =>
                      !current.tracks.some((item) => item.spotifyTrackId === song.spotifyTrackId),
                  ),
                ],
              }
            : payload,
        );
        setError("");
      } catch {
        setError("Tidak dapat memuat musik.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [params.id],
  );

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          {loading ? <BrutalCard className="h-48 animate-pulse bg-white" /> : null}
          {error ? <BrutalCard className="bg-[#FF3B6B] font-black text-white">{error}</BrutalCard> : null}
          {data ? (
            <>
              <header className="collection-hero spotify-playlist-hero grid gap-5 rounded-[2rem] border-[3px] border-black bg-[#00C2FF] p-5 shadow-[6px_6px_0_#000] md:grid-cols-[170px_minmax(0,1fr)] md:items-end">
                <Image
                  src={playlistCover(data.playlist) || "/icons/default-cover.svg"}
                  alt=""
                  width={160}
                  height={160}
                  sizes="160px"
                  className="aspect-square w-40 rounded-3xl border-[3px] border-black object-cover"
                />
                <div className="min-w-0">
                  <p className="page-kicker">{data.source === "spotify" ? "Spotify Playlist" : "Maiabeat Playlist"}</p>
                  <h1 className="page-title text-ellipsis">{playlistTitle(data.playlist)}</h1>
                  <p className="font-bold">{data.pagination.total || data.tracks.length} tracks</p>
                </div>
              </header>
              <div className="action-grid">
                <BrutalButton tone="green" icon={<Play size={17} />} disabled={!data.tracks.length} onClick={() => setQueue(data.tracks, 0)}>
                  Play All
                </BrutalButton>
                <BrutalButton tone="yellow" icon={<Shuffle size={17} />} disabled={!data.tracks.length} onClick={() => setQueue(shuffleSongs(data.tracks), 0)}>
                  Shuffle
                </BrutalButton>
                <BrutalButton
                  tone="cyan"
                  icon={<ListPlus size={17} />}
                  disabled={!data.tracks.length}
                  onClick={() => {
                    data.tracks.forEach((song) => void addToQueue(song));
                    notify("Ditambahkan ke antrean");
                  }}
                >
                  Add to Queue
                </BrutalButton>
              </div>
              <section className="grid gap-3">
                <h2 className="section-title">Tracks</h2>
                <div className="song-grid">
                  {data.tracks.map((song) => (
                    <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={data.tracks} onAddToPlaylist={setSelectedSong} />
                  ))}
                </div>
                {data.pagination.hasMore && data.pagination.nextOffset !== null ? (
                  <BrutalButton tone="yellow" disabled={loadingMore} onClick={() => void load(data.pagination.nextOffset ?? 0, true)}>
                    {loadingMore ? "Loading..." : "Load More"}
                  </BrutalButton>
                ) : null}
                {!data.tracks.length ? (
                  <BrutalCard className="bg-white text-center font-black">
                    Belum ada playlist. Buat playlist pertamamu dari Library.
                  </BrutalCard>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
        <AddToPlaylistModal song={selectedSong} onClose={() => setSelectedSong(null)} />
      </AppShell>
    </AuthGuard>
  );
}
