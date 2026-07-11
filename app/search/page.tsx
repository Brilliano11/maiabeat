"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Disc3,
  Loader2,
  MoreHorizontal,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { SongCard } from "@/components/SongCard";
import type {
  AlbumItem,
  ArtistItem,
  PlaylistItem,
  SearchSection,
  Song,
} from "@/lib/types";
import {
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
  type RecentSearchItem,
} from "@/lib/recentSearches";
import { usePlayerStore } from "@/store/playerStore";

type Filter = "All" | "Songs" | "Artists" | "Albums" | "Playlists";

type SearchPayload = {
  songs: Song[];
  sections: {
    tracks: SearchSection<Song>;
    artists: SearchSection<ArtistItem>;
    albums: SearchSection<AlbumItem>;
    playlists: SearchSection<PlaylistItem>;
  } | null;
  error?: string;
};

const filters: Filter[] = ["All", "Songs", "Artists", "Albums", "Playlists"];
const quickSearches = ["Hindia", "NIKI", "Avenged Sevenfold", "Indo Hits", "J-Pop", "Lo-Fi"];

function spotifyTypeForFilter(filter: Filter) {
  if (filter === "Songs") return "track";
  if (filter === "Artists") return "artist";
  if (filter === "Albums") return "album";
  if (filter === "Playlists") return "playlist";
  return "track,artist,album,playlist";
}

function dedupeById<T extends { id: string }>(previous: T[], next: T[]) {
  const seen = new Set(previous.map((item) => item.id));
  return [...previous, ...next.filter((item) => !seen.has(item.id))];
}

function dedupeSongs(previous: Song[], next: Song[]) {
  const seen = new Set(previous.map((song) => song.spotifyTrackId));
  return [...previous, ...next.filter((song) => !seen.has(song.spotifyTrackId))];
}

function EmptySection({ children }: { children: React.ReactNode }) {
  return (
    <BrutalCard className="bg-white p-5 text-center font-black">
      {children}
    </BrutalCard>
  );
}

function SearchEntityCard({
  item,
  type,
  onOpen,
}: {
  item: ArtistItem | AlbumItem | PlaylistItem;
  type: "artist" | "album" | "playlist";
  onOpen: () => void;
}) {
  const title = "name" in item ? item.name : item.title;
  const subtitle =
    type === "artist"
      ? "Artis"
      : type === "album"
        ? `Album - ${"artist" in item ? item.artist : ""}`
        : `Playlist - ${"owner" in item ? item.owner ?? "Spotify" : "Spotify"}`;
  const imageUrl = "imageUrl" in item ? item.imageUrl : "coverUrl" in item ? item.coverUrl : null;

  return (
    <BrutalCard className="p-3">
      <div className="song-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl || "/icons/default-cover.svg"}
          alt=""
          className="h-[52px] w-[52px] rounded-xl border-[3px] border-black object-cover sm:h-16 sm:w-16"
        />
        <button onClick={onOpen} className="min-w-0 text-left">
          <p className="text-ellipsis card-title">{title}</p>
          <p className="text-ellipsis text-xs font-bold text-black/70 sm:text-sm">{subtitle}</p>
        </button>
        <div className="song-actions">
          <button
            aria-label={`Open ${title}`}
            onClick={onOpen}
            className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#29FF87]"
          >
            {type === "artist" ? <UserRound size={18} /> : <Disc3 size={18} />}
          </button>
          <button
            aria-label="More"
            onClick={onOpen}
            className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-white"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </BrutalCard>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [tracks, setTracks] = useState<Song[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const setQueue = usePlayerStore((state) => state.setQueue);

  const hasResults = tracks.length || artists.length || albums.length || playlists.length;
  const showRecentPanel = focused && !query.trim() && recentSearches.length > 0;

  const refreshRecent = useCallback(() => setRecentSearches(getRecentSearches()), []);

  const resetResults = useCallback(() => {
    setTracks([]);
    setArtists([]);
    setAlbums([]);
    setPlaylists([]);
    setNextOffset(null);
  }, []);

  const runSearch = useCallback(
    async (value = query, offset = 0, append = false) => {
      const trimmed = value.trim();
      if (!trimmed) {
        resetResults();
        setError("");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        const requestParams = new URLSearchParams({
          q: trimmed,
          type: spotifyTypeForFilter(activeFilter),
          limit: "10",
          offset: String(offset),
        });
        const response = await fetch(`/api/spotify/search?${requestParams.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as SearchPayload;
        if (!response.ok || !data.sections) {
          throw new Error(data.error ?? "Pencarian sedang bermasalah.");
        }
        if (controller.signal.aborted) return;

        const sections = data.sections;
        setTracks((current) =>
          append ? dedupeSongs(current, sections.tracks.items) : sections.tracks.items,
        );
        setArtists((current) =>
          append ? dedupeById(current, sections.artists.items) : sections.artists.items,
        );
        setAlbums((current) =>
          append ? dedupeById(current, sections.albums.items) : sections.albums.items,
        );
        setPlaylists((current) =>
          append ? dedupeById(current, sections.playlists.items) : sections.playlists.items,
        );

        const paginations = [
          sections.tracks.pagination,
          sections.artists.pagination,
          sections.albums.pagination,
          sections.playlists.pagination,
        ];
        const availableOffsets = paginations
          .map((pagination) => pagination.nextOffset)
          .filter((item): item is number => item !== null);
        setNextOffset(availableOffsets.length ? Math.min(...availableOffsets) : null);
        saveRecentSearch({
          id: trimmed.toLowerCase(),
          type: "query",
          title: trimmed,
          subtitle: "Query",
          route: `/search?q=${encodeURIComponent(trimmed)}`,
        });
        refreshRecent();
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setError("Pencarian sedang bermasalah.");
        if (!append) resetResults();
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeFilter, query, refreshRecent, resetResults],
  );

  const openRecent = (item: RecentSearchItem) => {
    if (item.type === "query") {
      setQuery(item.title);
      setFocused(false);
      void runSearch(item.title);
      return;
    }
    if (item.type === "track" && item.song) {
      setQueue([item.song], 0);
      router.push("/player");
      return;
    }
    if (item.route) router.push(item.route);
  };

  const rememberTrack = (track: Song) => {
    saveRecentSearch({
      id: track.spotifyTrackId,
      type: "track",
      title: track.title,
      subtitle: `Lagu - ${track.artist}`,
      imageUrl: track.coverUrl,
      spotifyUri: track.spotifyUri,
      route: "/player",
      song: track,
    });
    refreshRecent();
  };

  const openArtist = (artist: ArtistItem) => {
    saveRecentSearch({
      id: artist.id,
      type: "artist",
      title: artist.name,
      subtitle: "Artis",
      imageUrl: artist.imageUrl,
      spotifyUri: artist.spotifyUri,
      route: `/artist/${artist.id}`,
    });
    refreshRecent();
    router.push(`/artist/${artist.id}`);
  };

  const openAlbum = (album: AlbumItem) => {
    saveRecentSearch({
      id: album.id,
      type: "album",
      title: album.title,
      subtitle: `Album - ${album.artist}`,
      imageUrl: album.coverUrl,
      spotifyUri: album.spotifyUri,
      route: `/album/${album.id}`,
    });
    refreshRecent();
    router.push(`/album/${album.id}`);
  };

  const openPlaylist = (playlist: PlaylistItem) => {
    saveRecentSearch({
      id: playlist.id,
      type: "playlist",
      title: playlist.name,
      subtitle: `Playlist - ${playlist.owner ?? "Spotify"}`,
      imageUrl: playlist.coverUrl,
      spotifyUri: playlist.spotifyUri,
      route: `/playlist/${playlist.id}`,
    });
    refreshRecent();
    router.push(`/playlist/${playlist.id}`);
  };

  const loadMore = () => {
    if (nextOffset === null || loading || loadingMore) return;
    void runSearch(query, nextOffset, true);
  };

  useEffect(() => {
    queueMicrotask(refreshRecent);
    const listener = () => refreshRecent();
    window.addEventListener("maiabeat:recent-searches-updated", listener);
    return () => window.removeEventListener("maiabeat:recent-searches-updated", listener);
  }, [refreshRecent]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      queueMicrotask(() => {
        resetResults();
        setError("");
      });
      return;
    }

    const timeout = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [query, activeFilter, runSearch, resetResults]);

  useEffect(() => {
    if (!initial) return;
    queueMicrotask(() => setQuery(initial));
  }, [initial]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setFocused(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || nextOffset === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextOffset, query, loading, loadingMore]);

  const visibleSections = useMemo(
    () => ({
      tracks: activeFilter === "All" || activeFilter === "Songs",
      artists: activeFilter === "All" || activeFilter === "Artists",
      albums: activeFilter === "All" || activeFilter === "Albums",
      playlists: activeFilter === "All" || activeFilter === "Playlists",
    }),
    [activeFilter],
  );

  return (
    <AuthGuard>
      <AppShell>
        <div className="page-stack">
          <header>
            <p className="page-kicker">Find your sound</p>
            <h1 className="page-title">Search</h1>
          </header>

          <div ref={panelRef} className="relative z-20">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void runSearch();
              }}
              className="search-form"
            >
              <div className="flex min-w-0 items-center gap-2 rounded-2xl border-[3px] border-black bg-white px-3 shadow-[5px_5px_0_#000]">
                <Search size={20} strokeWidth={3} />
                <input
                  value={query}
                  onFocus={() => setFocused(true)}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari lagu, artis, album, atau playlist."
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-black/50"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      resetResults();
                    }}
                    className="grid h-10 w-10 place-items-center rounded-xl border-[3px] border-black bg-white"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              <button className="h-12 rounded-2xl border-[3px] border-black bg-[#FFD600] px-4 text-sm font-black uppercase shadow-[5px_5px_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none">
                Go
              </button>
            </form>

            {showRecentPanel ? (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 rounded-3xl border-[3px] border-black bg-[#FFF7D6] p-3 shadow-[6px_6px_0_#000]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase">Pencarian terakhir</p>
                  <button
                    type="button"
                    onClick={() => clearRecentSearches()}
                    className="text-xs font-black underline"
                  >
                    Hapus pencarian terkini
                  </button>
                </div>
                <div className="grid gap-2">
                  {recentSearches.slice(0, 6).map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl || "/icons/default-cover.svg"}
                        alt=""
                        className="h-11 w-11 rounded-xl border-[3px] border-black object-cover"
                      />
                      <button className="min-w-0 text-left" onClick={() => openRecent(item)}>
                        <span className="text-ellipsis block text-sm font-black">{item.title}</span>
                        <span className="text-ellipsis block text-xs font-bold text-black/60">
                          {item.subtitle ?? item.type}
                        </span>
                      </button>
                      <button
                        aria-label={`Remove ${item.title} from recent searches`}
                        onClick={() => removeRecentSearch(item.type, item.id)}
                        className="grid h-11 w-11 place-items-center rounded-xl border-[3px] border-black bg-[#FF3B6B] text-white"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="filter-strip">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full border-[3px] border-black px-4 py-2 text-sm font-black shadow-[4px_4px_0_#000] ${
                  activeFilter === filter ? "bg-[#FFD600]" : "bg-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {!query.trim() ? (
            <section className="grid gap-3">
              <h2 className="page-kicker">Quick search</h2>
              <div className="shortcut-grid">
                {quickSearches.map((term) => (
                  <BrutalButton
                    key={term}
                    tone="white"
                    className="min-h-12 px-2 text-sm"
                    onClick={() => setQuery(term)}
                  >
                    {term}
                  </BrutalButton>
                ))}
              </div>
            </section>
          ) : null}

          {error ? (
            <BrutalCard className="grid gap-3 bg-[#FF3B6B] text-white">
              <p className="font-black">Pencarian sedang bermasalah.</p>
              <BrutalButton tone="white" onClick={() => void runSearch()}>
                Coba Lagi
              </BrutalButton>
            </BrutalCard>
          ) : null}

          {loading ? (
            <div className="search-results">
              {Array.from({ length: 6 }).map((_, index) => (
                <BrutalCard key={index} className="h-24 animate-pulse bg-white" />
              ))}
            </div>
          ) : null}

          {!loading && query.trim() && !hasResults && !error ? (
            <EmptySection>
              Tidak ada hasil untuk &quot;{query.trim()}&quot;.
              <br />
              Coba kata kunci lain atau periksa ejaan.
            </EmptySection>
          ) : null}

          {!loading && visibleSections.tracks && tracks.length ? (
            <section className="grid gap-3">
              <h2 className="section-title">Songs</h2>
              <div className="search-results">
                {tracks.map((song) => (
                  <SongCard
                    key={song.id ?? song.spotifyTrackId}
                    song={song}
                    songs={tracks}
                    onPlay={rememberTrack}
                    onAddToPlaylist={(track) => {
                      rememberTrack(track);
                      setSelectedSong(track);
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!loading && visibleSections.artists && artists.length ? (
            <section className="grid gap-3">
              <h2 className="section-title">Artists</h2>
              <div className="search-results">
                {artists.map((artist) => (
                  <SearchEntityCard
                    key={artist.id}
                    item={artist}
                    type="artist"
                    onOpen={() => openArtist(artist)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!loading && visibleSections.albums && albums.length ? (
            <section className="grid gap-3">
              <h2 className="section-title">Albums</h2>
              <div className="search-results">
                {albums.map((album) => (
                  <SearchEntityCard
                    key={album.id}
                    item={album}
                    type="album"
                    onOpen={() => openAlbum(album)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!loading && visibleSections.playlists && playlists.length ? (
            <section className="grid gap-3">
              <h2 className="section-title">Playlists</h2>
              <div className="search-results">
                {playlists.map((playlist) => (
                  <SearchEntityCard
                    key={playlist.id}
                    item={playlist}
                    type="playlist"
                    onOpen={() => openPlaylist(playlist)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div ref={sentinelRef} className="h-2" />

          {nextOffset !== null && !loading ? (
            <BrutalButton tone="yellow" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading more
                </span>
              ) : (
                "Load More"
              )}
            </BrutalButton>
          ) : null}

          {!query.trim() ? (
            <Link href="/explore">
              <BrutalCard className="bg-[#00C2FF] text-center font-black">
                Cari lagu, artis, album, atau playlist.
              </BrutalCard>
            </Link>
          ) : null}
        </div>
        <AddToPlaylistModal song={selectedSong} onClose={() => setSelectedSong(null)} />
      </AppShell>
    </AuthGuard>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
