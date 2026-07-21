"use client";

import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useListeningStore } from "@/store/listeningStore";

export function PlaybackControls() {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const shuffle = usePlayerStore((state) => state.shuffleEnabled);
  const repeat = usePlayerStore((state) => state.repeatMode);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeatMode = usePlayerStore((state) => state.cycleRepeatMode);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const controlsLocked = useListeningStore(
    (state) => Boolean(state.activeRoomId && state.role === "listener"),
  );

  return (
    <div className="playback-controls grid gap-3">
      <div className="playback-controls-main grid grid-cols-5 items-center gap-2">
        <button
          aria-label="Toggle shuffle"
          disabled={controlsLocked}
          onClick={toggleShuffle}
          className={`grid h-12 place-items-center rounded-2xl border-[3px] border-black ${shuffle ? "bg-[#29FF87]" : "bg-white"}`}
        >
          <Shuffle size={20} />
        </button>
        <button
          aria-label="Previous"
          disabled={controlsLocked}
          onClick={() => void previous()}
          className="grid h-12 place-items-center rounded-2xl border-[3px] border-black bg-white"
        >
          <SkipBack size={20} fill="black" />
        </button>
        <button
          aria-label="Play or pause"
          disabled={controlsLocked}
          onClick={() => void togglePlay()}
          className="grid h-16 place-items-center rounded-2xl border-[3px] border-black bg-[#FF4D00] text-white shadow-[5px_5px_0_#000]"
        >
          {isPlaying ? <Pause size={30} fill="white" /> : <Play size={30} fill="white" />}
        </button>
        <button
          aria-label="Next"
          disabled={controlsLocked}
          onClick={() => void next()}
          className="grid h-12 place-items-center rounded-2xl border-[3px] border-black bg-white"
        >
          <SkipForward size={20} fill="black" />
        </button>
        <button
          aria-label={`Repeat ${repeat}`}
          disabled={controlsLocked}
          onClick={cycleRepeatMode}
          className={`grid h-12 place-items-center rounded-2xl border-[3px] border-black ${repeat !== "off" ? "bg-[#FFD600]" : "bg-white"}`}
        >
          <Repeat size={20} />
          <span className="text-[10px] font-black">{repeat}</span>
        </button>
      </div>
      <div className="playback-volume grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-2">
        <button
          aria-label={isMuted ? "Unmute" : "Mute"}
          onClick={() => void toggleMute()}
          className="grid h-10 w-10 place-items-center rounded-xl border-[3px] border-black bg-[#FFD600]"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => void setVolume(Number(event.target.value) / 100)}
          className="w-full"
        />
      </div>
    </div>
  );
}
