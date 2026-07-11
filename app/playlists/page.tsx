"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { CreatePlaylistModal } from "@/components/CreatePlaylistModal";
import { PlaylistCard } from "@/components/PlaylistCard";
import { useLibraryStore } from "@/store/libraryStore";

export default function PlaylistsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const playlists = useLibraryStore((state) => state.playlists);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header className="flex items-end justify-between gap-3">
            <div>
              <p className="page-kicker">Collections</p>
              <h1 className="page-title">Playlists</h1>
            </div>
            <BrutalButton tone="green" onClick={() => setCreateOpen(true)} icon={<Plus size={16} />}>
              Create
            </BrutalButton>
          </header>
          <div className="playlist-grid">
            {playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
            {!playlists.length ? (
              <BrutalCard className="text-center font-black">
                Create your first playlist.
              </BrutalCard>
            ) : null}
          </div>
        </div>
        <CreatePlaylistModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </AppShell>
    </AuthGuard>
  );
}
