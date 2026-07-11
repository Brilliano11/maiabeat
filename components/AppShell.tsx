"use client";

import { BottomNavigation } from "@/components/BottomNavigation";
import { MiniPlayer } from "@/components/MiniPlayer";
import { SpotifyPlayerProvider } from "@/components/music/SpotifyPlayerProvider";
import { ToastHost } from "@/components/ToastHost";
import { cn, notify } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  Disc3,
  Home,
  Library,
  LogOut,
  Music2,
  Plus,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { CreatePlaylistModal } from "@/components/CreatePlaylistModal";
import { useAuthStore } from "@/store/authStore";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";

const sidebarItems = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/player", label: "Player", Icon: Disc3 },
  { href: "/library", label: "Library", Icon: Library },
];

function DesktopSidebar({ onCreatePlaylist }: { onCreatePlaylist: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const playlists = useLibraryStore((state) => state.playlists);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filteredPlaylists = useMemo(
    () => {
      if (filter !== "All" && filter !== "Playlists") return [];
      return playlists.filter((playlist) =>
        playlist.name.toLowerCase().includes(libraryQuery.trim().toLowerCase()),
      );
    },
    [filter, libraryQuery, playlists],
  );

  return (
    <aside className="desktop-sidebar">
      <Link href="/home" className="mb-8 flex min-h-12 items-center gap-3 rounded-2xl border-[3px] border-black bg-[#FF4D00] px-3 text-white shadow-[5px_5px_0_#000]">
        <Music2 size={24} strokeWidth={3} />
        <span className="text-xl font-black">Maiabeat</span>
      </Link>

      <nav className="grid gap-2">
        {sidebarItems.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl border-[3px] border-black px-3 text-sm font-black uppercase transition active:translate-x-1 active:translate-y-1",
                active ? "bg-[#FFD600] shadow-[4px_4px_0_#000]" : "bg-white",
              )}
            >
              <Icon size={20} strokeWidth={3} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black uppercase">Your Library</p>
          <button
            type="button"
            aria-label="Create playlist"
            onClick={onCreatePlaylist}
            className="grid h-10 w-10 place-items-center rounded-xl border-[3px] border-black bg-[#29FF87]"
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", "Playlists", "Artists", "Albums", "Liked"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full border-[3px] border-black px-2 py-1 text-[10px] font-black",
                filter === item ? "bg-[#FFD600]" : "bg-white",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="grid gap-1">
          <span className="sr-only">Search Library</span>
          <input
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Search Library"
            className="min-h-11 min-w-0 rounded-2xl border-[3px] border-black bg-white px-3 text-sm font-bold outline-none"
          />
        </label>
        <div className="grid max-h-[24dvh] gap-2 overflow-y-auto pr-1">
          {filteredPlaylists.slice(0, 8).map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlists/${playlist.id}`}
              className="text-ellipsis rounded-xl border-[3px] border-black bg-white px-3 py-2 text-xs font-black"
            >
              {playlist.name}
            </Link>
          ))}
          {!filteredPlaylists.length ? (
            <p className="rounded-xl border-[3px] border-black bg-[#FFF7D6] p-2 text-xs font-black">
              Belum ada playlist.
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/login");
        }}
        className="mt-auto flex min-h-11 items-center gap-3 rounded-2xl border-[3px] border-black bg-[#FF3B6B] px-3 text-sm font-black uppercase text-white shadow-[4px_4px_0_#000] transition active:translate-x-1 active:translate-y-1 active:shadow-none"
      >
        <LogOut size={20} strokeWidth={3} />
        Logout
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/profile" className="grid min-h-11 place-items-center rounded-xl border-[3px] border-black bg-white">
          <UserRound size={18} />
        </Link>
        <Link href="/settings" className="grid min-h-11 place-items-center rounded-xl border-[3px] border-black bg-white">
          <Settings size={18} />
        </Link>
      </div>
    </aside>
  );
}

function TopBar() {
  const router = useRouter();
  return (
    <div className="top-bar">
      <div className="hidden items-center gap-2 lg:flex">
        <button aria-label="Back" onClick={() => router.back()} className="top-icon-button">
          <ChevronLeft size={18} />
        </button>
        <button aria-label="Forward" onClick={() => window.history.forward()} className="top-icon-button">
          <ChevronRight size={18} />
        </button>
      </div>
      <Link href="/search" className="top-search">
        <Search size={18} />
        <span className="text-ellipsis">Global Search</span>
      </Link>
      <div className="flex items-center gap-2">
        <button
          aria-label="Notifications"
          onClick={() => notify("No new notifications")}
          className="top-icon-button"
        >
          <Bell size={18} />
        </button>
        <Link href="/profile" aria-label="Profile" className="top-icon-button">
          <UserRound size={18} />
        </Link>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  withNav = true,
  className,
}: {
  children: React.ReactNode;
  withNav?: boolean;
  className?: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const syncFromServer = useLibraryStore((state) => state.syncFromServer);
  const syncQueueFromServer = usePlayerStore((state) => state.syncQueueFromServer);

  useEffect(() => {
    if (user) {
      void syncFromServer();
      void syncQueueFromServer();
    }
  }, [syncFromServer, syncQueueFromServer, user]);

  if (!withNav) {
    return (
      <main className={cn("auth-shell", className)}>
        {children}
        <ToastHost />
      </main>
    );
  }

  return (
    <div className="app-shell">
      <div className="desktop-layout">
        <DesktopSidebar onCreatePlaylist={() => setCreateOpen(true)} />
        <main className={cn("page-content", className)}>
          <TopBar />
          <SpotifyPlayerProvider>{children}</SpotifyPlayerProvider>
        </main>
      </div>
      <ToastHost />
      <MiniPlayer />
      <BottomNavigation />
      <CreatePlaylistModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
