"use client";

import { X } from "lucide-react";
import { BrutalButton } from "@/components/BrutalButton";
import { useLibraryStore } from "@/store/libraryStore";
import type { Song } from "@/lib/types";
import { notify } from "@/lib/utils";

type AddToPlaylistModalProps = {
  song: Song | null;
  onClose: () => void;
};

export function AddToPlaylistModal({ song, onClose }: AddToPlaylistModalProps) {
  const playlists = useLibraryStore((state) => state.playlists);
  const addSongToPlaylist = useLibraryStore((state) => state.addSongToPlaylist);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);

  if (!song) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-3 sm:place-items-center">
      <div className="responsive-modal-panel rounded-t-3xl border-[3px] border-black bg-[#FFF7D6] p-4 shadow-[5px_5px_0_#000] sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase">Add track</p>
            <h2 className="text-ellipsis text-xl font-black">{song.title}</h2>
          </div>
          <button
            aria-label="Close modal"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => {
                addSongToPlaylist(playlist.id, song);
                notify("Added to playlist");
                onClose();
              }}
              className="min-w-0 rounded-2xl border-[3px] border-black bg-white p-3 text-left font-black shadow-[5px_5px_0_#000]"
            >
              <span className="text-ellipsis block">{playlist.name}</span>
              <span className="block text-xs font-bold text-black/60">
                {playlist.songIds.length} songs
              </span>
            </button>
          ))}
          {!playlists.length ? (
            <p className="rounded-2xl border-[3px] border-black bg-white p-3 text-sm font-bold">
              No playlist yet. Create one below.
            </p>
          ) : null}
          <BrutalButton
            tone="cyan"
            onClick={() => {
              createPlaylist("New Brutal Mix");
              notify("Playlist created");
            }}
          >
            Create quick playlist
          </BrutalButton>
        </div>
      </div>
    </div>
  );
}
