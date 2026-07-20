"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { BrutalCard } from "@/components/BrutalCard";
import { useLibraryStore } from "@/store/libraryStore";
import { useAuthStore } from "@/store/authStore";
import type { Playlist } from "@/lib/types";

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const user = useAuthStore((state) => state.user);
  const canManage =
    user?.id === "local-preview" || playlist.ownerId === user?.id || playlist.userId === user?.id;

  return (
    <BrutalCard className="p-3">
      <div className="playlist-card">
        <Link
          href={`/playlists/${playlist.id}`}
          prefetch={false}
          className="grid min-w-0 grid-cols-[54px_minmax(0,1fr)] items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-[#FFD600]"
        >
          <Image
            src={playlist.coverUrl || "/icons/default-cover.svg"}
            alt=""
            width={320}
            height={320}
            sizes="56px"
            className="h-14 w-14 rounded-xl border-[3px] border-black object-cover"
          />
          <div className="min-w-0">
            <p className="text-ellipsis card-title">{playlist.name}</p>
            <p className="text-xs font-bold text-black/70 md:text-sm">
              {playlist.songIds.length} songs
            </p>
          </div>
        </Link>
        {canManage ? (
          <button
            aria-label={`Delete ${playlist.name}`}
            onClick={() => {
              if (window.confirm(`Delete "${playlist.name}"?`)) {
                deletePlaylist(playlist.id);
              }
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-[#FF3B6B] text-white transition active:translate-x-0.5 active:translate-y-0.5"
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <span aria-label="View only" className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#FFD600]">
            <Eye size={18} />
          </span>
        )}
      </div>
    </BrutalCard>
  );
}
