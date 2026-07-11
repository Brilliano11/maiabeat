"use client";

import { Heart, Play, Shuffle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import { shuffleSongs } from "@/lib/utils";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";

export default function LikedPage() {
  const likedSongs = useLibraryStore((state) => state.likedSongs);
  const setQueue = usePlayerStore((state) => state.setQueue);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header className="rounded-[2rem] border-[3px] border-black bg-[#FF3B6B] p-5 text-white shadow-[6px_6px_0_#000] lg:p-7">
            <Heart size={34} />
            <h1 className="page-title mt-5">Liked Songs</h1>
            <p className="font-bold">{likedSongs.length} songs you saved</p>
          </header>
          <div className="two-col-grid">
            <BrutalButton tone="green" icon={<Play size={17} />} disabled={!likedSongs.length} onClick={() => setQueue(likedSongs, 0)}>
              Play All
            </BrutalButton>
            <BrutalButton
              tone="yellow"
              icon={<Shuffle size={17} />}
              disabled={!likedSongs.length}
              onClick={() => setQueue(shuffleSongs(likedSongs), 0)}
            >
              Shuffle
            </BrutalButton>
          </div>
          <div className="song-grid">
            {likedSongs.map((song) => (
              <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={likedSongs} compact />
            ))}
            {!likedSongs.length ? (
              <BrutalCard className="text-center font-black">
                Like some songs from Home or Search.
              </BrutalCard>
            ) : null}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
