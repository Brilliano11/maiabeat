"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ListMusic,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

type QueueDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function QueueDrawer({ open, onClose }: QueueDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const playSong = usePlayerStore((state) => state.playSong);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const reorderQueueItem = usePlayerStore((state) => state.reorderQueueItem);
  const clearQueue = usePlayerStore((state) => state.clearQueue);

  const matchedCurrentIndex = currentSong
    ? queue[currentIndex]?.song.spotifyTrackId === currentSong.spotifyTrackId
      ? currentIndex
      : queue.findIndex((item) => item.song.spotifyTrackId === currentSong.spotifyTrackId)
    : -1;
  const firstUpcomingIndex = matchedCurrentIndex >= 0 ? matchedCurrentIndex + 1 : 0;
  const upcomingItems = queue.slice(firstUpcomingIndex);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="queue-drawer-layer">
      <button
        type="button"
        aria-label="Close queue backdrop"
        className="queue-drawer-backdrop"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-drawer-title"
        className="queue-drawer"
      >
        <header className="queue-drawer-header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-[#FFD600] text-black">
              <ListMusic size={21} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="page-kicker">Playback</p>
              <h2 id="queue-drawer-title" className="text-xl font-black leading-none">
                Queue
              </h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close queue"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-white text-black"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </header>

        <div className="queue-drawer-scroll">
          <section className="grid gap-2" aria-labelledby="queue-now-playing">
            <p id="queue-now-playing" className="page-kicker">
              Now Playing
            </p>
            {currentSong ? (
              <div className="queue-now-playing">
                <Image
                  src={currentSong.coverUrl || "/icons/default-cover.svg"}
                  alt=""
                  width={64}
                  height={64}
                  sizes="64px"
                  className="h-16 w-16 shrink-0 rounded-xl border-[3px] border-black object-cover"
                />
                <div className="min-w-0">
                  <p className="text-ellipsis card-title">{currentSong.title}</p>
                  <p className="text-ellipsis text-sm font-bold text-black/70">
                    {currentSong.artist}
                  </p>
                  <p className="mt-1 text-xs font-black">
                    {formatTime(currentSong.durationMs / 1000)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="queue-empty-state">Belum ada lagu yang diputar.</div>
            )}
          </section>

          <section className="grid gap-3" aria-labelledby="queue-up-next">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p id="queue-up-next" className="font-black">
                  Up Next
                </p>
                <p className="text-xs font-bold text-black/60">
                  {upcomingItems.length} lagu
                </p>
              </div>
              {queue.length ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Hapus semua lagu dari queue?")) void clearQueue();
                  }}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border-[3px] border-black bg-[#FF3B6B] px-3 text-xs font-black uppercase text-white"
                >
                  <Trash2 size={16} />
                  Clear
                </button>
              ) : null}
            </div>

            <div className="grid gap-2">
              {upcomingItems.map((item, upcomingIndex) => {
                const queueIndex = firstUpcomingIndex + upcomingIndex;
                return (
                  <div key={item.id} className="queue-drawer-item">
                    <Image
                      src={item.song.coverUrl || "/icons/default-cover.svg"}
                      alt=""
                      width={48}
                      height={48}
                      sizes="48px"
                      className="h-12 w-12 shrink-0 rounded-lg border-[3px] border-black object-cover"
                    />
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => void playSong(item.song, { replaceQueue: false })}
                    >
                      <span className="text-ellipsis block text-sm font-black">
                        {item.song.title}
                      </span>
                      <span className="text-ellipsis block text-xs font-bold text-black/65">
                        {item.song.artist}
                      </span>
                    </button>
                    <div className="queue-drawer-actions">
                      <button
                        type="button"
                        aria-label={`Play ${item.song.title}`}
                        onClick={() => void playSong(item.song, { replaceQueue: false })}
                        className="queue-drawer-icon bg-[#29FF87]"
                      >
                        <Play size={15} fill="black" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${item.song.title} up`}
                        disabled={queueIndex <= firstUpcomingIndex}
                        onClick={() => reorderQueueItem(item.id, "up")}
                        className="queue-drawer-icon bg-[#FFD600] disabled:opacity-35"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${item.song.title} down`}
                        disabled={queueIndex >= queue.length - 1}
                        onClick={() => reorderQueueItem(item.id, "down")}
                        className="queue-drawer-icon bg-[#FFD600] disabled:opacity-35"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item.song.title}`}
                        onClick={() => void removeFromQueue(item.id)}
                        className="queue-drawer-icon bg-white"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!upcomingItems.length ? (
                <Link href="/search" onClick={onClose} className="queue-empty-state">
                  Queue kosong. Cari lagu untuk ditambahkan.
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
