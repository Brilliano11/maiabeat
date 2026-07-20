"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ListMusic, Pause, Play, SkipForward } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useLibraryStore } from "@/store/libraryStore";
import { formatTime } from "@/lib/utils";

export function MiniPlayer({ onOpenQueue }: { onOpenQueue: () => void }) {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progressMs = usePlayerStore((state) => state.progressMs);
  const durationMs = usePlayerStore((state) => state.durationMs);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextTrack = usePlayerStore((state) => state.nextTrack);
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const isLiked = useLibraryStore((state) =>
    currentSong ? state.isLiked(currentSong.id ?? currentSong.spotifyTrackId) : false,
  );

  if (!currentSong || currentSong.spotifyUri.includes("demo-")) return null;

  return (
    <>
      <div className="mini-player rounded-2xl border-[3px] border-black bg-[#FF4D00] p-2 text-white shadow-[5px_5px_0_#000]">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/player" className="flex min-w-0 flex-1 items-center gap-3">
            <Image
              src={currentSong.coverUrl || "/icons/default-cover.svg"}
              alt=""
              width={48}
              height={48}
              sizes="48px"
              className="h-12 w-12 shrink-0 rounded-xl border-[3px] border-black object-cover"
            />
            <div className="min-w-0">
              <p className="text-ellipsis text-sm font-black">{currentSong.title}</p>
              <p className="text-ellipsis text-xs font-bold">{currentSong.artist}</p>
            </div>
          </Link>
          <button
            aria-label="Like current song"
            onClick={() => toggleLike(currentSong)}
            className="mini-player-like grid h-10 w-10 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-white text-black sm:h-11 sm:w-11"
          >
            <Heart size={18} fill={isLiked ? "#FF3B6B" : "transparent"} />
          </button>
          <button
            aria-label="Play or pause"
            onClick={() => void togglePlay()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-[#FFD600] text-black sm:h-11 sm:w-11"
          >
            {isPlaying ? <Pause size={18} fill="black" /> : <Play size={18} fill="black" />}
          </button>
          <button
            aria-label="Next track"
            onClick={nextTrack}
            className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-white text-black sm:grid"
          >
            <SkipForward size={18} fill="black" />
          </button>
          <button
            type="button"
            aria-label="Open queue"
            onClick={onOpenQueue}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-[#00C2FF] text-black sm:h-11 sm:w-11"
          >
            <ListMusic size={18} />
          </button>
        </div>
      </div>

      <div className="desktop-player-content">
        <div className="grid h-full min-h-[88px] grid-cols-[minmax(0,1.2fr)_auto_minmax(220px,1fr)] items-center gap-5 px-5">
          <Link href="/player" className="flex min-w-0 items-center gap-3">
            <Image
              src={currentSong.coverUrl || "/icons/default-cover.svg"}
              alt=""
              width={56}
              height={56}
              sizes="56px"
              className="h-14 w-14 shrink-0 rounded-xl border-[3px] border-black object-cover"
            />
            <div className="min-w-0">
              <p className="text-ellipsis text-base font-black">{currentSong.title}</p>
              <p className="text-ellipsis text-sm font-bold text-white/85">{currentSong.artist}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              aria-label="Like current song"
              onClick={() => toggleLike(currentSong)}
              className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white text-black"
            >
              <Heart size={18} fill={isLiked ? "#FF3B6B" : "transparent"} />
            </button>
            <button
              aria-label="Play or pause"
              onClick={() => void togglePlay()}
              className="grid h-12 w-12 place-items-center rounded-xl border-[3px] border-black bg-[#FFD600] text-black shadow-[4px_4px_0_#000]"
            >
              {isPlaying ? <Pause size={22} fill="black" /> : <Play size={22} fill="black" />}
            </button>
            <button
              aria-label="Next track"
              onClick={nextTrack}
              className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white text-black"
            >
              <SkipForward size={18} fill="black" />
            </button>
            <button
              type="button"
              aria-label="Open queue"
              onClick={onOpenQueue}
              className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#00C2FF] text-black"
            >
              <ListMusic size={18} />
            </button>
          </div>

          <div className="grid min-w-0 gap-2">
            <input
              aria-label="Playback progress"
              type="range"
              min={0}
              max={durationMs || currentSong.durationMs}
              value={Math.min(progressMs, durationMs || progressMs)}
              onChange={() => undefined}
              className="w-full"
            />
            <div className="flex justify-between text-xs font-black">
              <span>{formatTime(progressMs / 1000)}</span>
              <span>{formatTime((durationMs || currentSong.durationMs) / 1000)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
