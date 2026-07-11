"use client";

import Link from "next/link";
import { ExternalLink, Heart, ListMusic, Save, Share2 } from "lucide-react";
import { useState } from "react";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { PlaybackControls } from "@/components/music/PlaybackControls";
import { formatTime, notify } from "@/lib/utils";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";

export default function PlayerPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const queue = usePlayerStore((state) => state.queue);
  const progressMs = usePlayerStore((state) => state.progressMs);
  const durationMs = usePlayerStore((state) => state.durationMs);
  const seek = usePlayerStore((state) => state.seek);
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const isLiked = useLibraryStore((state) =>
    currentSong && !currentSong.spotifyUri.includes("demo-")
      ? state.isLiked(currentSong.id ?? currentSong.spotifyTrackId)
      : false,
  );
  const displaySong =
    currentSong && !currentSong.spotifyUri.includes("demo-") ? currentSong : null;

  const upNext = displaySong
    ? queue.find((item) => item.song.spotifyTrackId !== displaySong.spotifyTrackId)?.song ??
      queue[0]?.song
    : null;

  return (
    <AuthGuard>
      <AppShell>
        {!displaySong ? (
          <BrutalCard className="grid gap-4 bg-[#FFD600]">
            <h1 className="section-title">No song playing</h1>
            <Link href="/search">
              <BrutalButton tone="orange">Search a song</BrutalButton>
            </Link>
          </BrutalCard>
        ) : (
          <div className="player-layout">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySong.coverUrl || "/icons/default-cover.svg"}
              alt=""
              className="player-cover rounded-[2rem] border-[3px] border-black shadow-[8px_8px_0_#000]"
            />
            <div className="grid min-w-0 gap-5">
              <div className="min-w-0">
                <h1 className="page-title text-ellipsis">{displaySong.title}</h1>
                <p className="text-ellipsis mt-2 text-lg font-bold">{displaySong.artist}</p>
                <p className="mt-2 font-black text-[#FF3B6B]">
                  Full playback requires Spotify Premium.
                </p>
              </div>
              <div className="grid gap-2">
                <input
                  aria-label="Seek progress"
                  type="range"
                  min={0}
                  max={durationMs || displaySong.durationMs}
                  value={Math.min(progressMs, durationMs || progressMs)}
                  onChange={(event) => void seek(Number(event.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs font-black">
                  <span>{formatTime(progressMs / 1000)}</span>
                  <span>{formatTime((durationMs || displaySong.durationMs) / 1000)}</span>
                </div>
              </div>
              <PlaybackControls />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <BrutalButton
                  tone={isLiked ? "pink" : "white"}
                  onClick={() => toggleLike(displaySong)}
                  icon={<Heart size={17} />}
                >
                  Like
                </BrutalButton>
                <BrutalButton tone="cyan" onClick={() => setModalOpen(true)} icon={<Save size={17} />}>
                  Save
                </BrutalButton>
                <BrutalButton
                  tone="yellow"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(window.location.href);
                    notify("Link copied");
                  }}
                  icon={<Share2 size={17} />}
                >
                  Share
                </BrutalButton>
                <BrutalButton
                  tone="black"
                  onClick={() => {
                    if (displaySong.externalUrl) window.open(displaySong.externalUrl, "_blank");
                    else notify("Spotify link unavailable");
                  }}
                  icon={<ExternalLink size={17} />}
                  className="col-span-2 sm:col-span-3"
                >
                  Open in Spotify
                </BrutalButton>
              </div>
            </div>
            <Link href="/queue" className="min-w-0 xl:self-stretch">
              <BrutalCard className="flex h-full min-w-0 items-center gap-3 bg-[#29FF87] xl:items-start">
                <ListMusic size={24} />
                <div className="min-w-0">
                  <p className="font-black">Up Next</p>
                  <p className="text-ellipsis text-sm font-bold">
                    {upNext?.title ?? "Queue is empty"}
                  </p>
                </div>
              </BrutalCard>
            </Link>
          </div>
        )}
        <AddToPlaylistModal song={modalOpen ? displaySong : null} onClose={() => setModalOpen(false)} />
      </AppShell>
    </AuthGuard>
  );
}
