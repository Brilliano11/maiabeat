"use client";

import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";

export function PlaybackControls() {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const shuffle = usePlayerStore((state) => state.shuffleEnabled);
  const repeat = usePlayerStore((state) => state.repeatMode);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeatMode = usePlayerStore((state) => state.cycleRepeatMode);

  return (
    <div className="grid grid-cols-5 items-center gap-2">
      <button
        aria-label="Toggle shuffle"
        onClick={toggleShuffle}
        className={`grid h-12 place-items-center rounded-2xl border-[3px] border-black ${shuffle ? "bg-[#29FF87]" : "bg-white"}`}
      >
        <Shuffle size={20} />
      </button>
      <button
        aria-label="Previous"
        onClick={() => void previous()}
        className="grid h-12 place-items-center rounded-2xl border-[3px] border-black bg-white"
      >
        <SkipBack size={20} fill="black" />
      </button>
      <button
        aria-label="Play or pause"
        onClick={() => void togglePlay()}
        className="grid h-16 place-items-center rounded-2xl border-[3px] border-black bg-[#FF4D00] text-white shadow-[5px_5px_0_#000]"
      >
        {isPlaying ? <Pause size={30} fill="white" /> : <Play size={30} fill="white" />}
      </button>
      <button
        aria-label="Next"
        onClick={() => void next()}
        className="grid h-12 place-items-center rounded-2xl border-[3px] border-black bg-white"
      >
        <SkipForward size={20} fill="black" />
      </button>
      <button
        aria-label={`Repeat ${repeat}`}
        onClick={cycleRepeatMode}
        className={`grid h-12 place-items-center rounded-2xl border-[3px] border-black ${repeat !== "off" ? "bg-[#FFD600]" : "bg-white"}`}
      >
        <Repeat size={20} />
        <span className="text-[10px] font-black">{repeat}</span>
      </button>
    </div>
  );
}
