"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ImagePlus, Lock, Save, Trash2, UsersRound, X } from "lucide-react";
import { BrutalButton } from "@/components/BrutalButton";
import {
  PlaylistCoverCropper,
  type PlaylistCoverCropSource,
} from "@/components/PlaylistCoverCropper";
import type { Playlist } from "@/lib/types";
import { cn, notify } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useLibraryStore } from "@/store/libraryStore";

const coverOptions = [
  { src: "/icons/default-cover.svg", label: "Default" },
  { src: "/icons/cover-orange.svg", label: "Orange" },
  { src: "/icons/cover-yellow.svg", label: "Yellow" },
  { src: "/icons/cover-cyan.svg", label: "Cyan" },
  { src: "/icons/cover-green.svg", label: "Green" },
  { src: "/icons/cover-pink.svg", label: "Pink" },
];

const maxCoverFileSizeBytes = 6 * 1024 * 1024;

function isCustomCover(src: string | null | undefined) {
  return Boolean(src && !coverOptions.some((cover) => cover.src === src));
}

function shouldSkipImageOptimization(src: string) {
  return src.startsWith("data:image/") || src.startsWith("blob:");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement("img");
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

async function fileToCropSource(file: File): Promise<PlaylistCoverCropSource> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pilih file gambar.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Cover harus JPG, PNG, atau WebP.");
  }
  if (file.size > maxCoverFileSizeBytes) {
    throw new Error("Ukuran gambar maksimal 6 MB.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return {
      fileName: file.name,
      height: image.naturalHeight,
      url,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

type PlaylistEditModalProps = {
  playlist: Playlist;
  onClose: () => void;
};

export function PlaylistEditModal({ playlist, onClose }: PlaylistEditModalProps) {
  const coverInputId = useId();
  const dialogRef = useRef<HTMLFormElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const cropSourceUrlRef = useRef<string | null>(null);
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [coverUrl, setCoverUrl] = useState(playlist.coverUrl || coverOptions[0].src);
  const [coverLoading, setCoverLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropSource, setCropSource] = useState<PlaylistCoverCropSource | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"private" | "shared">(
    playlist.visibility ?? "shared",
  );
  const user = useAuthStore((state) => state.user);
  const updatePlaylist = useLibraryStore((state) => state.updatePlaylist);

  const closeCropper = useCallback(() => {
    if (cropSourceUrlRef.current) URL.revokeObjectURL(cropSourceUrlRef.current);
    cropSourceUrlRef.current = null;
    setCropSource(null);
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (cropSourceUrlRef.current) closeCropper();
        else onClose();
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
  }, [closeCropper, onClose]);

  useEffect(
    () => () => {
      if (cropSourceUrlRef.current) URL.revokeObjectURL(cropSourceUrlRef.current);
    },
    [],
  );

  const selectPresetCover = (src: string) => {
    closeCropper();
    setPendingCoverFile(null);
    setCoverUrl(src);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || cropSource) return;

    try {
      setSaving(true);
      let savedCoverUrl = coverUrl;
      if (pendingCoverFile && user?.id !== "local-preview") {
        const formData = new FormData();
        formData.set("cover", pendingCoverFile);
        const response = await fetch(`/api/library/playlists/${playlist.id}/cover`, {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => ({}))) as {
          coverUrl?: string;
          error?: string;
        };
        if (!response.ok || !data.coverUrl) {
          throw new Error(data.error ?? "Cover upload failed.");
        }
        savedCoverUrl = data.coverUrl;
      }

      updatePlaylist(playlist.id, {
        name,
        description,
        coverUrl: savedCoverUrl,
        visibility,
      });
      notify(pendingCoverFile ? "Cover and playlist updated" : "Playlist updated");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Playlist update failed.");
    } finally {
      setSaving(false);
    }
  };

  const onCoverFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      setCoverLoading(true);
      closeCropper();
      const source = await fileToCropSource(file);
      cropSourceUrlRef.current = source.url;
      setCropSource(source);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Cover tidak bisa dipakai.");
    } finally {
      setCoverLoading(false);
    }
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
            <p className="page-kicker">{cropSource ? "Playlist cover" : "Playlist"}</p>
            <h2 id="playlist-editor-title" className="text-2xl font-black">
              {cropSource ? "Adjust cover" : "Edit details"}
            </h2>
          </div>
          <button
            type="button"
            aria-label={cropSource ? "Close crop editor" : "Close playlist editor"}
            onClick={cropSource ? closeCropper : onClose}
            className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white text-black"
          >
            <X size={19} strokeWidth={3} />
          </button>
        </header>

        {cropSource ? (
          <PlaylistCoverCropper
            source={cropSource}
            onCancel={closeCropper}
            onApply={(file, previewUrl) => {
              setPendingCoverFile(file);
              setCoverUrl(previewUrl);
              closeCropper();
              notify("Custom cover ready");
            }}
          />
        ) : (
          <>
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
                <div className="playlist-cover-custom-panel">
                  <div className="playlist-cover-preview">
                    <Image
                      src={coverUrl}
                      alt=""
                      width={180}
                      height={180}
                      unoptimized={shouldSkipImageOptimization(coverUrl)}
                    />
                  </div>
                  <div className="playlist-cover-custom-actions">
                    <p className="playlist-cover-custom-title">Custom cover</p>
                    <label htmlFor={coverInputId} className="playlist-cover-upload">
                      <ImagePlus size={22} />
                      {coverLoading ? "Processing..." : "Gallery cover"}
                    </label>
                    {isCustomCover(coverUrl) ? (
                      <button
                        type="button"
                        className="playlist-cover-remove"
                        onClick={() => selectPresetCover(coverOptions[0].src)}
                      >
                        <Trash2 size={18} />
                        Remove custom
                      </button>
                    ) : null}
                  </div>
                  <input
                    id={coverInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    disabled={coverLoading || saving}
                    onChange={onCoverFileChange}
                  />
                </div>
                <p className="playlist-cover-preset-label">Preset covers</p>
                <div className="playlist-cover-options">
                  {isCustomCover(coverUrl) ? (
                    <button
                      type="button"
                      aria-label="Custom playlist cover"
                      aria-pressed
                      className="playlist-cover-option playlist-cover-option-active"
                    >
                      <Image
                        src={coverUrl}
                        alt=""
                        width={72}
                        height={72}
                        unoptimized={shouldSkipImageOptimization(coverUrl)}
                      />
                    </button>
                  ) : null}
                  {coverOptions.map((cover) => (
                    <button
                      key={cover.src}
                      type="button"
                      aria-label={`${cover.label} playlist cover`}
                      aria-pressed={coverUrl === cover.src}
                      onClick={() => selectPresetCover(cover.src)}
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

            <BrutalButton
              type="submit"
              tone="green"
              icon={<Save size={17} />}
              disabled={saving || coverLoading}
            >
              {saving ? "Saving..." : "Save changes"}
            </BrutalButton>
          </>
        )}
      </form>
    </div>
  );
}
