"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Lock, Save, UsersRound, X } from "lucide-react";
import { BrutalButton } from "@/components/BrutalButton";
import type { Playlist } from "@/lib/types";
import { cn, notify } from "@/lib/utils";
import { useLibraryStore } from "@/store/libraryStore";

const coverOptions = [
  { src: "/icons/default-cover.svg", label: "Default" },
  { src: "/icons/cover-orange.svg", label: "Orange" },
  { src: "/icons/cover-yellow.svg", label: "Yellow" },
  { src: "/icons/cover-cyan.svg", label: "Cyan" },
  { src: "/icons/cover-green.svg", label: "Green" },
  { src: "/icons/cover-pink.svg", label: "Pink" },
];

type PlaylistEditModalProps = {
  playlist: Playlist;
  onClose: () => void;
};

export function PlaylistEditModal({ playlist, onClose }: PlaylistEditModalProps) {
  const dialogRef = useRef<HTMLFormElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [coverUrl, setCoverUrl] = useState(
    coverOptions.some((cover) => cover.src === playlist.coverUrl)
      ? playlist.coverUrl
      : coverOptions[0].src,
  );
  const [visibility, setVisibility] = useState<"private" | "shared">(
    playlist.visibility ?? "shared",
  );
  const updatePlaylist = useLibraryStore((state) => state.updatePlaylist);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    updatePlaylist(playlist.id, {
      name,
      description,
      coverUrl,
      visibility,
    });
    notify("Playlist updated");
    onClose();
  };

  return (
    <div className="playlist-edit-layer">
      <button
        type="button"
        aria-label="Close playlist editor backdrop"
        className="playlist-edit-backdrop"
        onClick={onClose}
      />
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-editor-title"
        onSubmit={submit}
        className="playlist-edit-dialog"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="page-kicker">Playlist</p>
            <h2 id="playlist-editor-title" className="text-2xl font-black">
              Edit details
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close playlist editor"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white text-black"
          >
            <X size={19} strokeWidth={3} />
          </button>
        </header>

        <div className="playlist-edit-fields">
          <label className="grid gap-1 text-xs font-black uppercase">
            Name
            <input
              ref={nameInputRef}
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="playlist-edit-control"
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase">
            Description
            <textarea
              maxLength={300}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="playlist-edit-control resize-none py-3"
            />
            <span className="text-right text-[10px] text-black/55">
              {description.length}/300
            </span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-xs font-black uppercase">Cover</legend>
            <div className="playlist-cover-options">
              {coverOptions.map((cover) => (
                <button
                  key={cover.src}
                  type="button"
                  aria-label={`${cover.label} playlist cover`}
                  aria-pressed={coverUrl === cover.src}
                  onClick={() => setCoverUrl(cover.src)}
                  className={cn(
                    "playlist-cover-option",
                    coverUrl === cover.src && "playlist-cover-option-active",
                  )}
                >
                  <Image src={cover.src} alt="" width={72} height={72} />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-xs font-black uppercase">Visibility</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={visibility === "private"}
                onClick={() => setVisibility("private")}
                className={cn(
                  "playlist-visibility-option",
                  visibility === "private" && "bg-[#FFD600]",
                )}
              >
                <Lock size={17} /> Private
              </button>
              <button
                type="button"
                aria-pressed={visibility === "shared"}
                onClick={() => setVisibility("shared")}
                className={cn(
                  "playlist-visibility-option",
                  visibility === "shared" && "bg-[#29FF87]",
                )}
              >
                <UsersRound size={17} /> Shared
              </button>
            </div>
          </fieldset>
        </div>

        <BrutalButton type="submit" tone="green" icon={<Save size={17} />}>
          Save changes
        </BrutalButton>
      </form>
    </div>
  );
}
