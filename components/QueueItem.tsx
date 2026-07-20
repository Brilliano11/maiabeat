"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Play, X } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import type { QueueItem as QueueItemType } from "@/lib/types";

export function QueueItem({ item }: { item: QueueItemType }) {
  const queue = usePlayerStore((state) => state.queue);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const reorderQueueItem = usePlayerStore((state) => state.reorderQueueItem);
  const song = item.song;

  const playNow = () => {
    setQueue(
      queue.map((queueItem) => queueItem.song),
      queue.findIndex((queueItem) => queueItem.id === item.id),
    );
  };

  return (
    <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border-[3px] border-black bg-white p-3 shadow-[5px_5px_0_#000] sm:grid-cols-[auto_52px_minmax(0,1fr)_auto] sm:gap-3">
      <div className="hidden gap-1 sm:grid">
        <button
          aria-label={`Move ${song.title} up`}
          onClick={() => reorderQueueItem(item.id, "up")}
          className="grid h-6 w-6 place-items-center rounded-lg border-[2px] border-black bg-[#FFD600]"
        >
          <ArrowUp size={14} />
        </button>
        <button
          aria-label={`Move ${song.title} down`}
          onClick={() => reorderQueueItem(item.id, "down")}
          className="grid h-6 w-6 place-items-center rounded-lg border-[2px] border-black bg-[#FFD600]"
        >
          <ArrowDown size={14} />
        </button>
      </div>
      <Image
        src={song.coverUrl || "/icons/default-cover.svg"}
        alt=""
        width={52}
        height={52}
        sizes="52px"
        className="h-[52px] w-[52px] rounded-xl border-[3px] border-black object-cover"
      />
      <button className="min-w-0 flex-1 text-left" onClick={playNow}>
        <p className="text-ellipsis card-title">{song.title}</p>
        <p className="text-ellipsis text-xs font-bold text-black/70 sm:text-sm">{song.artist}</p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <button
          aria-label={`Play ${song.title}`}
          onClick={playNow}
          className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#29FF87]"
        >
          <Play size={18} fill="black" />
        </button>
        <button
          aria-label={`Remove ${song.title}`}
          onClick={() => void removeFromQueue(item.id)}
          className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#FF3B6B] text-white"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
