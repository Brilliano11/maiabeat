"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { BrutalCard } from "@/components/BrutalCard";
import { useLibraryStore } from "@/store/libraryStore";
import type { Playlist } from "@/lib/types";

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);

  return (
    <BrutalCard className="p-3 md:p-4">
      <div className="playlist-card md:flex md:flex-col md:items-stretch">
        <Link href={`/playlists/${playlist.id}`} className="contents md:flex md:min-w-0 md:flex-col md:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={playlist.coverUrl || "/icons/default-cover.svg"}
            alt=""
            className="h-14 w-14 rounded-xl border-[3px] border-black object-cover md:aspect-square md:h-auto md:w-full"
          />
          <div className="min-w-0">
            <p className="text-ellipsis card-title">{playlist.name}</p>
            <p className="text-xs font-bold text-black/70 md:text-sm">
              {playlist.songIds.length} songs
            </p>
          </div>
        </Link>
        <button
          aria-label={`Delete ${playlist.name}`}
          onClick={() => deletePlaylist(playlist.id)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-[#FF3B6B] text-white md:mt-3 md:w-full"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </BrutalCard>
  );
}
