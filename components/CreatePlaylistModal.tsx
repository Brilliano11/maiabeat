"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { BrutalButton } from "@/components/BrutalButton";
import { useLibraryStore } from "@/store/libraryStore";
import { notify } from "@/lib/utils";

export function CreatePlaylistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "shared">("shared");
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);

  if (!open) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createPlaylist(name, description, visibility);
    setName("");
    setDescription("");
    notify("Playlist created");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-3 sm:place-items-center">
      <form
        onSubmit={submit}
        className="responsive-modal-panel grid gap-3 rounded-t-3xl border-[3px] border-black bg-[#FFF7D6] p-4 shadow-[5px_5px_0_#000] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Create playlist</h2>
          <button
            aria-label="Close modal"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-white"
          >
            <X size={18} />
          </button>
        </div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="Playlist name"
          className="h-12 rounded-2xl border-[3px] border-black bg-white px-3 font-bold outline-none shadow-[5px_5px_0_#000]"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          className="min-h-24 rounded-2xl border-[3px] border-black bg-white p-3 font-bold outline-none shadow-[5px_5px_0_#000]"
        />
        <select
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as "private" | "shared")}
          className="h-12 rounded-2xl border-[3px] border-black bg-white px-3 font-bold outline-none shadow-[5px_5px_0_#000]"
        >
          <option value="shared">Shared</option>
          <option value="private">Private</option>
        </select>
        <BrutalButton type="submit" tone="green">
          Save playlist
        </BrutalButton>
      </form>
    </div>
  );
}
