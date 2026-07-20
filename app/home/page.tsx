"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Disc3, Headphones, Heart, Library, ListMusic, PlugZap, Search, Wifi } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import { MoodTile } from "@/components/MoodTile";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { useAuthStore } from "@/store/authStore";
import { useLibraryStore } from "@/store/libraryStore";
import type { AlbumItem, ArtistItem, MoodItem, PlaylistItem, Song } from "@/lib/types";

type HomePayload = {
  greeting: string;
  quickAccess: Array<{ title: string; route: string; color: string }>;
  recentlyPlayed: Song[];
  madeForUs: PlaylistItem[];
  topTracks: Song[];
  topArtists: ArtistItem[];
  newReleases: AlbumItem[];
  moods: MoodItem[];
  popularWithYou: Song[];
  likedSongs: Song[];
  continueListening?: Song | null;
};

export default function HomePage() {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [spotifyStatus, setSpotifyStatus] = useState<"checking" | "connected" | "disconnected">(
    "checking",
  );
  const [spotifyLabel, setSpotifyLabel] = useState("");
  const [homeData, setHomeData] = useState<HomePayload | null>(null);
  const [homeError, setHomeError] = useState("");
  const user = useAuthStore((state) => state.user);
  const recentlyPlayed = useLibraryStore((state) => state.recentlyPlayed);
  const likedSongs = useLibraryStore((state) => state.likedSongs);
  const playlists = useLibraryStore((state) => state.playlists);
  const userId = user?.id;
  const name = user?.displayName || "Anggita";
  const recent = recentlyPlayed
    .filter((song) => song.spotifyUri && !song.spotifyUri.includes("demo-"))
    .slice(0, 6);
  const recentTracks = homeData?.recentlyPlayed.length ? homeData.recentlyPlayed : recent;
  const likedPreview = homeData?.likedSongs.length ? homeData.likedSongs : likedSongs.slice(0, 6);
  const topTracks = homeData?.topTracks ?? [];
  const popularWithYou = homeData?.popularWithYou ?? [];
  const moodItems = homeData?.moods ?? [];

  useEffect(() => {
    let active = true;

    async function loadSpotifyStatus() {
      if (!userId || userId === "local-preview") {
        setSpotifyStatus("disconnected");
        setSpotifyLabel("");
        return;
      }

      try {
        const response = await fetch("/api/spotify/me");
        const data = (await response.json().catch(() => ({}))) as {
          profile?: { email?: string; display_name?: string };
        };
        if (!active) return;
        if (response.ok) {
          setSpotifyStatus("connected");
          setSpotifyLabel(data.profile?.email ?? data.profile?.display_name ?? "Connected");
        } else {
          setSpotifyStatus("disconnected");
          setSpotifyLabel("");
        }
      } catch {
        if (!active) return;
        setSpotifyStatus("disconnected");
        setSpotifyLabel("");
      }
    }

    void loadSpotifyStatus();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;
    async function loadHome() {
      if (!userId || userId === "local-preview") {
        setHomeData(null);
        setHomeError("");
        return;
      }

      try {
        const response = await fetch("/api/home");
        const data = (await response.json()) as HomePayload & { error?: string };
        if (!active) return;
        if (!response.ok) throw new Error(data.error ?? "Tidak dapat memuat musik.");
        setHomeData(data);
        setHomeError("");
      } catch {
        if (!active) return;
        setHomeError("Tidak dapat memuat musik.");
      }
    }
    void loadHome();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header className="rounded-[2rem] border-[3px] border-black bg-[#FF4D00] p-5 text-white shadow-[6px_6px_0_#000] lg:p-7">
            <p className="page-kicker">{homeData?.greeting ?? "Good evening"}, {name}</p>
            <h1 className="page-title mt-2">Maiabeat hits different.</h1>
          </header>

          <Link
            href="/search"
            className="flex h-14 items-center gap-3 rounded-2xl border-[3px] border-black bg-white px-4 font-black shadow-[5px_5px_0_#000]"
          >
            <Headphones size={22} strokeWidth={3} />
            Search music
          </Link>

          <BrutalCard className="grid gap-3 bg-[#00C2FF]">
            <div className="flex min-w-0 items-center gap-3">
              {spotifyStatus === "connected" ? (
                <Wifi className="shrink-0" size={28} strokeWidth={3} />
              ) : (
                <PlugZap className="shrink-0" size={28} strokeWidth={3} />
              )}
              <div className="min-w-0">
                <p className="text-xs font-black uppercase">
                  {spotifyStatus === "connected" ? "Spotify connected" : "Spotify required"}
                </p>
                <h2 className="section-title">
                  {spotifyStatus === "checking"
                    ? "Checking connection..."
                    : spotifyStatus === "connected"
                      ? "Ready for full playback"
                      : "Connect for full playback"}
                </h2>
                {spotifyLabel ? (
                  <p className="text-xs font-black text-black/70">{spotifyLabel}</p>
                ) : null}
              </div>
            </div>
            {spotifyStatus === "connected" ? (
              <Link href="/search">
                <BrutalButton tone="green" className="w-full" icon={<Search size={18} />}>
                  Search Spotify Music
                </BrutalButton>
              </Link>
            ) : (
              <a href="/api/spotify/login">
                <BrutalButton tone="green" className="w-full" disabled={spotifyStatus === "checking"}>
                  {spotifyStatus === "checking" ? "Checking..." : "Connect Spotify"}
                </BrutalButton>
              </a>
            )}
          </BrutalCard>

          <Link href="/liked">
            <BrutalCard className="flex items-center gap-3 bg-[#FF3B6B] text-white">
              <Heart size={26} fill="white" />
              <div>
                <p className="font-black">Liked Songs</p>
                <p className="text-sm font-bold">{likedSongs.length} saved tracks</p>
              </div>
            </BrutalCard>
          </Link>

          {homeError ? (
            <BrutalCard className="bg-[#FFD600] font-black">
              {homeError} Beberapa data lokal tetap ditampilkan.
            </BrutalCard>
          ) : null}

          <section className="grid gap-3">
            <h2 className="section-title">Continue Listening</h2>
            {homeData?.continueListening ? (
              <SongCard
                song={homeData.continueListening}
                songs={recentTracks}
                onAddToPlaylist={setSelectedSong}
              />
            ) : (
              <Link href="/search">
                <BrutalCard className="bg-white text-center font-black">
                  Search a song and your next listen appears here.
                </BrutalCard>
              </Link>
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Quick Access</h2>
            <div className="shortcut-grid">
              {(homeData?.quickAccess ?? [
                { title: "Liked Songs", route: "/liked", color: "#FF3B6B" },
                { title: "Library", route: "/library", color: "#00C2FF" },
                { title: "Queue", route: "/queue", color: "#29FF87" },
                { title: "Explore", route: "/explore", color: "#FFD600" },
              ]).map((item, index) => {
                const Icon = [Heart, Library, ListMusic, Disc3, Headphones, Search][index % 6];
                return (
                  <Link key={item.title} href={item.route}>
                    <BrutalCard className="grid min-h-28 place-items-start bg-white" style={{ backgroundColor: item.color }}>
                      <Icon size={22} />
                      <p className="card-title mt-3">{item.title}</p>
                    </BrutalCard>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Recently Played</h2>
              <Link href="/library" className="text-xs font-black underline">
                Library
              </Link>
            </div>
            <div className="recent-grid">
              {recentTracks.length ? (
                recentTracks.slice(0, 12).map((song) => (
                  <SongCard
                    key={song.id ?? song.spotifyTrackId}
                    song={song}
                    songs={recentTracks}
                    onAddToPlaylist={setSelectedSong}
                    compact
                  />
                ))
              ) : (
                <BrutalCard className="grid gap-3 bg-white">
                  <p className="font-black">No real plays yet.</p>
                  <p className="text-sm font-bold text-black/70">
                    Search a Spotify track, press play, and it will show up here.
                  </p>
                  <Link href="/search">
                    <BrutalButton tone="orange" className="w-full" icon={<Search size={18} />}>
                      Search Music
                    </BrutalButton>
                  </Link>
                </BrutalCard>
              )}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Made for Maia & Anggita</h2>
            <div className="playlist-grid">
              {(homeData?.madeForUs ?? []).slice(0, 6).map((playlist) => (
                <Link key={playlist.id} href={`/playlist/${playlist.id}`} prefetch={false}>
                  <BrutalCard className="grid min-h-32 place-items-start bg-[#FFD600] p-3">
                    <Search size={24} />
                    <p className="card-title mt-3 text-ellipsis max-w-full">{playlist.name}</p>
                    <p className="text-xs font-bold text-black/70">{playlist.totalTracks ?? 0} tracks</p>
                  </BrutalCard>
                </Link>
              ))}
              {!homeData?.madeForUs?.length ? (
                ["Maiabeat Mix 01", "Our Night Mix", "Soft Hours"].map((query) => (
                  <Link key={query} href={`/search?q=${encodeURIComponent(query)}`}>
                    <BrutalCard className="grid min-h-28 place-items-center bg-[#FFD600] p-3 text-center">
                      <Search size={24} />
                      <p className="text-center text-sm font-black">{query}</p>
                    </BrutalCard>
                  </Link>
                ))
              ) : null}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Liked Songs</h2>
            <div className="recent-grid">
              {likedPreview.slice(0, 6).map((song) => (
                <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={likedPreview} compact />
              ))}
              {!likedPreview.length ? (
                <Link href="/search">
                  <BrutalCard className="bg-white text-center font-black">
                    Like songs from Search or Player.
                  </BrutalCard>
                </Link>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Your Top Tracks</h2>
            <div className="recent-grid">
              {topTracks.slice(0, 8).map((song) => (
                <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={topTracks} compact />
              ))}
              {!topTracks.length ? (
                <BrutalCard className="bg-white text-center font-black">
                  Reconnect Spotify if top tracks need a fresh scope.
                </BrutalCard>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Your Top Artists</h2>
            <div className="playlist-grid">
              {(homeData?.topArtists ?? []).slice(0, 6).map((artist) => (
                <Link key={artist.id} href={`/artist/${artist.id}`}>
                  <BrutalCard className="grid gap-3 bg-white">
                    <Image
                      src={artist.imageUrl || "/icons/default-cover.svg"}
                      alt=""
                      width={320}
                      height={320}
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                      className="aspect-square w-full rounded-2xl border-[3px] border-black object-cover"
                    />
                    <p className="text-ellipsis card-title">{artist.name}</p>
                  </BrutalCard>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Shared Playlists</h2>
              <Link href="/playlists" className="text-xs font-black underline">
                View all
              </Link>
            </div>
            <div className="playlist-grid">
              {playlists.slice(0, 2).map((playlist) => (
                <Link
                  key={playlist.id}
                  href={`/playlists/${playlist.id}`}
                  prefetch={false}
                  className="min-w-0 rounded-2xl border-[3px] border-black bg-white p-3 font-black shadow-[5px_5px_0_#000]"
                >
                  <span className="text-ellipsis block">{playlist.name}</span>
                  <span className="block text-xs font-bold text-black/60">
                    {playlist.songIds.length} songs
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Mood Mix</h2>
            <div className="mood-grid">
              {(moodItems.length ? moodItems.map((mood) => mood.name) : ["Chill", "Workout", "Focus", "Night Drive", "Sad", "Lo-Fi", "J-Pop", "Indo Hits"]).map((mood, index) => (
                <MoodTile key={mood} mood={mood} index={index} />
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">New Releases</h2>
            <div className="playlist-grid">
              {(homeData?.newReleases ?? []).slice(0, 6).map((album) => (
                <Link key={album.id} href={`/album/${album.id}`}>
                  <BrutalCard className="grid gap-3 bg-white">
                    <Image
                      src={album.coverUrl || "/icons/default-cover.svg"}
                      alt=""
                      width={320}
                      height={320}
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                      className="aspect-square w-full rounded-2xl border-[3px] border-black object-cover"
                    />
                    <p className="text-ellipsis card-title">{album.title}</p>
                    <p className="text-ellipsis text-xs font-bold text-black/70">{album.artist}</p>
                  </BrutalCard>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="section-title">Popular With You</h2>
            <div className="recent-grid">
              {popularWithYou.slice(0, 8).map((song) => (
                <SongCard key={song.id ?? song.spotifyTrackId} song={song} songs={popularWithYou} compact />
              ))}
            </div>
          </section>
        </div>
        <AddToPlaylistModal song={selectedSong} onClose={() => setSelectedSong(null)} />
      </AppShell>
    </AuthGuard>
  );
}
