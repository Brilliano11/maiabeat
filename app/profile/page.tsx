"use client";

import Link from "next/link";
import { LogOut, Music2, Settings, Wifi } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { notify } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";

function ProfileContent() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const likedSongs = useLibraryStore((state) => state.likedSongs);
  const playlists = useLibraryStore((state) => state.playlists);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const sdkReady = usePlayerStore((state) => state.sdkReady);
  const deviceId = usePlayerStore((state) => state.deviceId);
  const [spotifyEmail, setSpotifyEmail] = useState("");
  const [spotifyError, setSpotifyError] = useState("");

  useEffect(() => {
    const status = params.get("spotify");
    if (status === "connected") notify("Spotify connected");
    if (status === "error") notify("Spotify connection failed. Please try again.");
    if (status === "state_error") notify("Spotify connection expired. Please reconnect.");
    if (status === "supabase_error") notify("Spotify connection is temporarily unavailable.");
  }, [params]);

  useEffect(() => {
    async function loadProfile() {
      const response = await fetch("/api/spotify/me");
      const data = await response.json();
      if (response.ok) setSpotifyEmail(data.profile?.email ?? data.profile?.display_name ?? "Connected");
      else setSpotifyError(data.error ?? "Spotify not connected");
    }
    void loadProfile();
  }, []);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header className="collection-hero profile-hero grid gap-4 rounded-[2rem] border-[3px] border-black bg-[#FF4D00] p-5 text-white shadow-[6px_6px_0_#000] md:grid-cols-[auto_minmax(0,1fr)] md:items-center lg:p-7">
            <Music2 size={40} />
            <div className="min-w-0">
              <h1 className="text-ellipsis page-title">{user?.displayName ?? "Maiabeat"}</h1>
              <p className="text-ellipsis font-bold">{user?.email}</p>
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <BrutalCard className="grid gap-3 bg-[#00C2FF]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase">Spotify</p>
                <h2 className="section-title">
                  {spotifyEmail ? "Connected" : "Not connected"}
                </h2>
                <p className="line-clamp-2 text-sm font-bold">
                  {spotifyEmail || spotifyError || "Connect to play full tracks."}
                </p>
              </div>
              <Wifi className={sdkReady ? "text-[#29FF87]" : "text-black"} size={34} />
            </div>
            {spotifyEmail ? (
              <BrutalButton tone="green" className="w-full" disabled>
                Spotify Connected
              </BrutalButton>
            ) : (
              <a href="/api/spotify/login">
                <BrutalButton tone="green" className="w-full">
                  Connect Spotify
                </BrutalButton>
              </a>
            )}
            {spotifyEmail ? (
              <a href="/api/spotify/login">
                <BrutalButton tone="white" className="w-full">
                  Reconnect Spotify
                </BrutalButton>
              </a>
            ) : null}
            <p className="text-xs font-black">
              Device: {deviceId ? "Maiabeat ready" : "Waiting for SDK"}
            </p>
          </BrutalCard>

          <div className="stats-grid">
            {[
              ["Liked", likedSongs.length],
              ["Playlists", playlists.length],
              ["Recent", recentlyPlayed.length],
            ].map(([label, value]) => (
              <BrutalCard key={label} className="bg-white text-center">
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs font-black uppercase">{label}</p>
              </BrutalCard>
            ))}
          </div>
          </div>

          <Link href="/settings">
            <BrutalButton tone="yellow" className="w-full" icon={<Settings size={18} />}>
              App Settings
            </BrutalButton>
          </Link>
          <BrutalButton
            tone="pink"
            icon={<LogOut size={18} />}
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            Logout
          </BrutalButton>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  );
}
