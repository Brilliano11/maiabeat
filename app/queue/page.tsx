"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { QueueItem } from "@/components/QueueItem";
import { usePlayerStore } from "@/store/playerStore";

export default function QueuePage() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const queue = usePlayerStore((state) => state.queue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header>
            <p className="page-kicker">Antrean lagu</p>
            <h1 className="page-title">Queue</h1>
          </header>
          <BrutalCard className="bg-[#FFD600]">
            <p className="page-kicker">Now Playing</p>
            <h2 className="text-ellipsis section-title">{currentSong?.title ?? "Nothing yet"}</h2>
            <p className="text-ellipsis font-bold">{currentSong?.artist ?? "Pick something from Search"}</p>
          </BrutalCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Up Next</h2>
            <BrutalButton
              tone="pink"
              onClick={() => {
                if (window.confirm("Clear queue?")) void clearQueue();
              }}
              icon={<Trash2 size={16} />}
            >
              Clear Queue
            </BrutalButton>
          </div>
          <div className="recent-grid">
            {queue.map((item) => (
              <QueueItem key={item.id} item={item} />
            ))}
            {!queue.length ? (
              <Link href="/search">
                <BrutalCard className="bg-white text-center font-black">
                  Queue empty. Search tracks.
                </BrutalCard>
              </Link>
            ) : null}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
