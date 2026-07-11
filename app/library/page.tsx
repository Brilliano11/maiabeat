"use client";

import Link from "next/link";
import { Heart, ListMusic, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { CreatePlaylistModal } from "@/components/CreatePlaylistModal";
import { PlaylistCard } from "@/components/PlaylistCard";
import { SongCard } from "@/components/SongCard";
import { useLibraryStore } from "@/store/libraryStore";

export default function LibraryPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recently-added");
  const likedSongs = useLibraryStore((state) => state.likedSongs);
  const playlists = useLibraryStore((state) => state.playlists);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const filteredPlaylists = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return playlists
      .filter((playlist) => playlist.name.toLowerCase().includes(normalized))
      .sort((a, b) => {
        if (sort === "alphabetical") return a.name.localeCompare(b.name);
        if (sort === "recently-played") return b.updatedAt.localeCompare(a.updatedAt);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [playlists, query, sort]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header>
            <p className="page-kicker">Saved noise</p>
            <h1 className="page-title">Library</h1>
          </header>
          <div className="shortcut-grid">
            <Link href="/liked">
              <BrutalCard className="min-h-28 bg-[#FF3B6B] text-white">
                <Heart />
                <p className="mt-4 card-title">Liked Songs</p>
                <p className="text-sm font-bold">{likedSongs.length} tracks</p>
              </BrutalCard>
            </Link>
            <Link href="/queue">
              <BrutalCard className="min-h-28 bg-[#00C2FF]">
                <ListMusic />
                <p className="mt-4 card-title">Queue</p>
                <p className="text-sm font-bold">Open queue</p>
              </BrutalCard>
            </Link>
          </div>
          {(filter === "All" || filter === "Playlists") ? (
          <section className="grid gap-3">
            <div className="filter-strip">
              {["All", "Playlists", "Artists", "Albums", "Liked"].map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full border-[3px] border-black px-4 py-2 text-sm font-black shadow-[4px_4px_0_#000] ${
                    filter === item ? "bg-[#FFD600]" : "bg-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search library"
                className="min-h-12 min-w-0 rounded-2xl border-[3px] border-black bg-white px-3 font-bold shadow-[5px_5px_0_#000] outline-none"
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="min-h-12 rounded-2xl border-[3px] border-black bg-white px-3 font-black shadow-[5px_5px_0_#000] outline-none"
              >
                <option value="recently-added">Recently added</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="recently-played">Recently played</option>
              </select>
            </div>
          </section>
          ) : null}
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Your Playlists</h2>
              <BrutalButton tone="green" onClick={() => setCreateOpen(true)} icon={<Plus size={16} />}>
                Create
              </BrutalButton>
            </div>
            <div className="playlist-grid">
              {filteredPlaylists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
            {!filteredPlaylists.length ? (
              <BrutalCard className="grid gap-3 bg-white text-center font-black">
                <p>Belum ada playlist.</p>
                <p className="text-sm font-bold text-black/70">Buat playlist pertamamu.</p>
                <BrutalButton tone="green" onClick={() => setCreateOpen(true)} icon={<Plus size={16} />}>
                  Create Playlist
                </BrutalButton>
              </BrutalCard>
            ) : null}
          </section>
          {(filter === "All" || filter === "Liked") && likedSongs.length ? (
            <section className="grid gap-3">
              <h2 className="section-title">Liked Songs</h2>
              <div className="recent-grid">
                {likedSongs.slice(0, 8).map((song) => (
                  <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={likedSongs} compact />
                ))}
              </div>
            </section>
          ) : null}
          {filter !== "All" && filter !== "Playlists" && filter !== "Liked" ? (
            <BrutalCard className="bg-white text-center font-black">
              {filter} tersimpan akan muncul di sini setelah Spotify menyediakan data.
            </BrutalCard>
          ) : null}
          <section className="grid gap-3">
            <h2 className="flex items-center gap-2 section-title">
              <RotateCcw size={20} /> Recently Played
            </h2>
            <div className="recent-grid">
              {recentlyPlayed.slice(0, 5).map((song) => (
                <SongCard
                  key={song.id ?? song.spotifyTrackId}
                  song={song}
                  songs={recentlyPlayed}
                  compact
                />
              ))}
            </div>
            {!recentlyPlayed.length ? (
              <BrutalCard className="font-black">Play a song and it will show here.</BrutalCard>
            ) : null}
          </section>
        </div>
        <CreatePlaylistModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </AppShell>
    </AuthGuard>
  );
}
