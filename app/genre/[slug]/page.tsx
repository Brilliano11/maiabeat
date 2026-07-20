"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import type { AlbumItem, ArtistItem, MoodItem, PlaylistItem, SearchSection, Song } from "@/lib/types";

type GenrePayload = {
  genre: MoodItem;
  tracks: SearchSection<Song>;
  artists: SearchSection<ArtistItem>;
  albums: SearchSection<AlbumItem>;
  playlists: SearchSection<PlaylistItem>;
};

export default function GenrePage() {
  const params = useParams<{ slug: string }>();
  const [data, setData] = useState<GenrePayload | null>(null);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (offset = 0, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const response = await fetch(`/api/genre/${params.slug}?limit=10&offset=${offset}`);
        const payload = (await response.json()) as GenrePayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Tidak dapat memuat musik.");
        setData(payload);
        setTracks((current) =>
          append
            ? [
                ...current,
                ...payload.tracks.items.filter(
                  (song) => !current.some((item) => item.spotifyTrackId === song.spotifyTrackId),
                ),
              ]
            : payload.tracks.items,
        );
        setError("");
      } catch {
        setError("Tidak dapat memuat musik.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [params.slug],
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
              <header className="collection-hero genre-hero rounded-[2rem] border-[3px] border-black p-5 shadow-[6px_6px_0_#000]" style={{ backgroundColor: data.genre.color }}>
                <p className="page-kicker">Genre and Mood</p>
                <h1 className="page-title">{data.genre.name}</h1>
                <p className="mt-3 max-w-2xl font-bold">{data.genre.description}</p>
              </header>
              <section className="grid gap-3">
                <h2 className="section-title">Popular Tracks</h2>
                <div className="search-results">
                  {tracks.map((song) => (
                    <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={tracks} />
                  ))}
                </div>
                {data.tracks.pagination.hasMore && data.tracks.pagination.nextOffset !== null ? (
                  <BrutalButton tone="yellow" disabled={loadingMore} onClick={() => void load(data.tracks.pagination.nextOffset ?? 0, true)}>
                    {loadingMore ? "Loading..." : "Load More"}
                  </BrutalButton>
                ) : null}
              </section>
              <section className="grid gap-3">
                <h2 className="section-title">Playlists</h2>
                <div className="playlist-grid">
                  {data.playlists.items.map((playlist) => (
                    <Link key={playlist.id} href={`/playlist/${playlist.id}`}>
                      <BrutalCard className="grid gap-3 bg-white">
                        <Image
                          src={playlist.coverUrl || "/icons/default-cover.svg"}
                          alt=""
                          width={320}
                          height={320}
                          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                          className="aspect-square w-full rounded-2xl border-[3px] border-black object-cover"
                        />
                        <p className="text-ellipsis card-title">{playlist.name}</p>
                      </BrutalCard>
                    </Link>
                  ))}
                </div>
              </section>
              <section className="grid gap-3">
                <h2 className="section-title">Artists and Albums</h2>
                <div className="playlist-grid">
                  {data.artists.items.slice(0, 6).map((artist) => (
                    <Link key={artist.id} href={`/artist/${artist.id}`}>
                      <BrutalCard className="bg-white font-black">{artist.name}</BrutalCard>
                    </Link>
                  ))}
                  {data.albums.items.slice(0, 6).map((album) => (
                    <Link key={album.id} href={`/album/${album.id}`}>
                      <BrutalCard className="bg-[#FFD600] font-black">{album.title}</BrutalCard>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
