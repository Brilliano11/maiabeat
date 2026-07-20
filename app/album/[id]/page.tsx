"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Play, Save, Shuffle } from "lucide-react";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import type { AlbumItem, Song } from "@/lib/types";
import { formatTime, shuffleSongs } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

type AlbumPayload = {
  album: AlbumItem;
  tracks: Song[];
};

export default function AlbumPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<AlbumPayload | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const setQueue = usePlayerStore((state) => state.setQueue);
  const totalDuration = useMemo(
    () => data?.tracks.reduce((sum, song) => sum + song.durationMs, 0) ?? 0,
    [data?.tracks],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const response = await fetch(`/api/album/${params.id}`);
        const payload = (await response.json()) as AlbumPayload & { error?: string };
        if (!active) return;
        if (!response.ok) throw new Error(payload.error ?? "Tidak dapat memuat musik.");
        setData(payload);
        setError("");
      } catch {
        if (active) setError("Tidak dapat memuat musik.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          {loading ? <BrutalCard className="h-48 animate-pulse bg-white" /> : null}
          {error ? <BrutalCard className="bg-[#FF3B6B] font-black text-white">{error}</BrutalCard> : null}
          {data ? (
            <>
              <header className="collection-hero album-hero grid gap-5 rounded-[2rem] border-[3px] border-black bg-[#FFD600] p-5 shadow-[6px_6px_0_#000] md:grid-cols-[170px_minmax(0,1fr)] md:items-end">
                <Image
                  src={data.album.coverUrl || "/icons/default-cover.svg"}
                  alt=""
                  width={160}
                  height={160}
                  sizes="160px"
                  className="aspect-square w-40 rounded-3xl border-[3px] border-black object-cover"
                />
                <div className="min-w-0">
                  <p className="page-kicker">{data.album.albumType ?? "Album"}</p>
                  <h1 className="page-title text-ellipsis">{data.album.title}</h1>
                  <p className="font-bold">
                    {data.album.artist} - {data.album.releaseDate?.slice(0, 4) ?? "Spotify"} - {data.tracks.length} tracks - {formatTime(totalDuration / 1000)}
                  </p>
                </div>
              </header>
              <div className="action-grid">
                <BrutalButton tone="green" icon={<Play size={17} />} disabled={!data.tracks.length} onClick={() => setQueue(data.tracks, 0)}>
                  Play All
                </BrutalButton>
                <BrutalButton tone="yellow" icon={<Shuffle size={17} />} disabled={!data.tracks.length} onClick={() => setQueue(shuffleSongs(data.tracks), 0)}>
                  Shuffle
                </BrutalButton>
                <BrutalButton tone="cyan" icon={<Save size={17} />} disabled={!data.tracks[0]} onClick={() => setSelectedSong(data.tracks[0] ?? null)}>
                  Add to Playlist
                </BrutalButton>
              </div>
              <section className="grid gap-3">
                <h2 className="section-title">Track List</h2>
                <div className="song-grid">
                  {data.tracks.map((song) => (
                    <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={data.tracks} onAddToPlaylist={setSelectedSong} />
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
        <AddToPlaylistModal song={selectedSong} onClose={() => setSelectedSong(null)} />
      </AppShell>
    </AuthGuard>
  );
}
