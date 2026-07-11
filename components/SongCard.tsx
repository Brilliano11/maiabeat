"use client";

import { Heart, ListPlus, MoreHorizontal, Play, Plus } from "lucide-react";
import { BrutalCard } from "@/components/BrutalCard";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import type { Song } from "@/lib/types";
import { notify } from "@/lib/utils";

type SongCardProps = {
  song: Song;
  songs?: Song[];
  onAddToPlaylist?: (song: Song) => void;
  onPlay?: (song: Song) => void;
  compact?: boolean;
};

export function SongCard({ song, songs, onAddToPlaylist, onPlay, compact = false }: SongCardProps) {
  const setQueue = usePlayerStore((state) => state.setQueue);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const songId = song.id ?? song.spotifyTrackId;
  const liked = useLibraryStore((state) => state.isLiked(songId));

  const play = () => {
    const list = songs?.length ? songs : [song];
    onPlay?.(song);
    setQueue(
      list,
      list.findIndex((item) => item.spotifyTrackId === song.spotifyTrackId),
    );
  };

  return (
    <BrutalCard className="p-3">
      <div className="song-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={song.coverUrl || "/icons/default-cover.svg"}
          alt=""
          className={
            compact
              ? "h-[52px] w-[52px] rounded-xl border-[3px] border-black object-cover"
              : "h-[52px] w-[52px] rounded-xl border-[3px] border-black object-cover sm:h-16 sm:w-16"
          }
        />
        <button onClick={play} className="min-w-0 flex-1 text-left">
          <p className="text-ellipsis card-title">{song.title}</p>
          <p className="text-ellipsis text-xs font-bold text-black/70 sm:text-sm">{song.artist}</p>
          {!song.spotifyUri || song.spotifyUri.includes("demo-") ? (
            <p className="text-ellipsis text-[11px] font-black text-[#FF3B6B]">
              Connect Spotify to play
            </p>
          ) : null}
        </button>
        <div className="song-actions">
          <button
            aria-label={`Play ${song.title}`}
            onClick={play}
            className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#29FF87]"
          >
            <Play size={18} fill="black" />
          </button>
          <button
            aria-label={liked ? "Unlike song" : "Like song"}
            onClick={() => toggleLike(song)}
            className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#FFD600]"
          >
            <Heart size={18} fill={liked ? "#FF3B6B" : "transparent"} />
          </button>
          {!compact ? (
            <>
              <button
                aria-label="Add to playlist"
                onClick={() => onAddToPlaylist?.(song)}
                className="hidden h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#00C2FF] sm:grid"
              >
                <Plus size={18} />
              </button>
              <button
                aria-label="Add to queue"
                onClick={() => {
                  void addToQueue(song);
                  notify("Added to queue");
                }}
                className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white"
              >
                <ListPlus size={18} />
              </button>
              <button
                aria-label="More"
                onClick={() => onAddToPlaylist?.(song)}
                className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white sm:hidden"
              >
                <MoreHorizontal size={18} />
              </button>
            </>
          ) : (
            <button
              aria-label="More"
              onClick={() => onAddToPlaylist?.(song)}
              className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white"
            >
              <MoreHorizontal size={18} />
            </button>
          )}
        </div>
      </div>
    </BrutalCard>
  );
}
