"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Play, Shuffle } from "lucide-react";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import type { AlbumItem, ArtistItem, SearchPagination, Song } from "@/lib/types";
import { shuffleSongs } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

type ArtistPayload = {
  artist: ArtistItem;
  tracks: Song[];
  albums: AlbumItem[];
  pagination?: SearchPagination;
};

export default function ArtistPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ArtistPayload | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const setQueue = usePlayerStore((state) => state.setQueue);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const [artistResponse, trackResponse, albumResponse] = await Promise.all([
          fetch(`/api/artist/${params.id}`),
          fetch(`/api/artist/${params.id}/tracks?limit=10`),
          fetch(`/api/artist/${params.id}/albums?limit=12`),
        ]);
        const artistData = await artistResponse.json();
        const trackData = await trackResponse.json();
        const albumData = await albumResponse.json();
        if (!active) return;
        if (!artistResponse.ok || !trackResponse.ok) throw new Error("Tidak dapat memuat musik.");
        setData({
          artist: artistData.artist,
          tracks: trackData.tracks ?? [],
          albums: albumData.albums ?? [],
          pagination: trackData.pagination,
        });
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
              <header className="grid gap-5 rounded-[2rem] border-[3px] border-black bg-[#29FF87] p-5 shadow-[6px_6px_0_#000] md:grid-cols-[160px_minmax(0,1fr)] md:items-end">
                <Image
                  src={data.artist.imageUrl || "/icons/default-cover.svg"}
                  alt=""
                  width={160}
                  height={160}
                  sizes="(min-width: 768px) 160px, 144px"
                  className="aspect-square w-36 rounded-3xl border-[3px] border-black object-cover md:w-40"
                />
                <div className="min-w-0">
                  <p className="page-kicker">Verified Artist</p>
                  <h1 className="page-title text-ellipsis">{data.artist.name}</h1>
                  <p className="font-bold">{data.artist.followers?.toLocaleString() ?? "Spotify"} followers</p>
                </div>
              </header>
              <div className="action-grid">
                <BrutalButton tone="green" icon={<Play size={17} />} disabled={!data.tracks.length} onClick={() => setQueue(data.tracks, 0)}>
                  Play
                </BrutalButton>
                <BrutalButton tone="yellow" icon={<Shuffle size={17} />} disabled={!data.tracks.length} onClick={() => setQueue(shuffleSongs(data.tracks), 0)}>
                  Shuffle
                </BrutalButton>
                {data.artist.externalUrl ? (
                  <a href={data.artist.externalUrl} target="_blank" rel="noreferrer">
                    <BrutalButton tone="pink" className="w-full">Open Spotify</BrutalButton>
                  </a>
                ) : null}
              </div>
              <section className="grid gap-3">
                <h2 className="section-title">Tracks</h2>
                <div className="search-results">
                  {data.tracks.map((song) => (
                    <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={data.tracks} onAddToPlaylist={setSelectedSong} />
                  ))}
                </div>
              </section>
              <section className="grid gap-3">
                <h2 className="section-title">Albums, Singles, Appears In</h2>
                <div className="playlist-grid">
                  {data.albums.map((album) => (
                    <Link key={album.id} href={`/album/${album.id}`}>
                      <BrutalCard className="grid gap-3 bg-white">
                        <Image
                          src={album.coverUrl || "/icons/default-cover.svg"}
                          alt=""
                          width={320}
                          height={320}
                          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                          className="aspect-square w-full rounded-2xl border-[3px] border-black object-cover"
                        />
                        <p className="text-ellipsis card-title">{album.title}</p>
                        <p className="text-xs font-bold text-black/70">{album.releaseDate ?? album.albumType}</p>
                      </BrutalCard>
                    </Link>
                  ))}
                </div>
              </section>
              <BrutalCard className="bg-white">
                <h2 className="section-title">About</h2>
                <p className="mt-2 font-bold">{data.artist.genres?.join(", ") || "Artist data from Spotify."}</p>
              </BrutalCard>
            </>
          ) : null}
        </div>
        <AddToPlaylistModal song={selectedSong} onClose={() => setSelectedSong(null)} />
      </AppShell>
    </AuthGuard>
  );
}
