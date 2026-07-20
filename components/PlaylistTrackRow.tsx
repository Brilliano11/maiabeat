"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Play, Trash2 } from "lucide-react";
import type { Song } from "@/lib/types";
import { formatTime } from "@/lib/utils";

type PlaylistTrackRowProps = {
  song: Song;
  position: number;
  total: number;
  onPlay: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function PlaylistTrackRow({
  song,
  position,
  total,
  onPlay,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PlaylistTrackRowProps) {
  return (
    <article className="playlist-track-row">
      <span className="playlist-track-position">{position + 1}</span>
      <Image
        src={song.coverUrl || "/icons/default-cover.svg"}
        alt=""
        width={56}
        height={56}
        sizes="56px"
        className="h-14 w-14 shrink-0 rounded-xl border-[3px] border-black object-cover"
      />
      <button type="button" onClick={onPlay} className="min-w-0 text-left">
        <span className="text-ellipsis block font-black">{song.title}</span>
        <span className="text-ellipsis block text-xs font-bold text-black/65">
          {song.artist} · {formatTime(song.durationMs / 1000)}
        </span>
      </button>
      <div className="playlist-track-actions">
        <button
          type="button"
          aria-label={`Play ${song.title}`}
          onClick={onPlay}
          className="playlist-track-action bg-[#29FF87]"
        >
          <Play size={16} fill="black" />
        </button>
        <button
          type="button"
          aria-label={`Move ${song.title} up`}
          disabled={position === 0}
          onClick={onMoveUp}
          className="playlist-track-action bg-[#FFD600] disabled:opacity-35"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          aria-label={`Move ${song.title} down`}
          disabled={position === total - 1}
          onClick={onMoveDown}
          className="playlist-track-action bg-[#FFD600] disabled:opacity-35"
        >
          <ArrowDown size={16} />
        </button>
        <button
          type="button"
          aria-label={`Remove ${song.title} from playlist`}
          onClick={onRemove}
          className="playlist-track-action bg-[#FF3B6B] text-white"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
