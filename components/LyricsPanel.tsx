"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Maximize2, Mic2, Minimize2, RefreshCw, X } from "lucide-react";
import { BrutalButton } from "@/components/BrutalButton";
import type { LyricsResult, Song } from "@/lib/types";
import { cn } from "@/lib/utils";

type LyricsPanelProps = {
  song: Song;
  progressMs: number;
  onSeek: (positionMs: number) => void | Promise<void>;
};

export function LyricsPanel({ song, progressMs, onSeek }: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const lineRefs = useRef<Array<HTMLButtonElement | HTMLParagraphElement | null>>([]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      track: song.title,
      artist: song.artist,
      durationMs: String(song.durationMs),
    });
    if (song.album) params.set("album", song.album);

    fetch(`/api/lyrics?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as LyricsResult & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Lyrics unavailable.");
        setLyrics(data);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Lyrics unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [requestKey, song.album, song.artist, song.durationMs, song.spotifyTrackId, song.title]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  const activeIndex = useMemo(() => {
    if (!lyrics?.synced) return -1;
    let index = -1;
    lyrics.lines.forEach((line, lineIndex) => {
      if (line.timeMs !== null && line.timeMs <= progressMs + 250) index = lineIndex;
    });
    return index;
  }, [lyrics, progressMs]);

  useEffect(() => {
    if (activeIndex < 0) return;
    lineRefs.current[activeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeIndex, fullscreen]);

  return (
    <section
      aria-labelledby="lyrics-title"
      className={cn("lyrics-panel", fullscreen && "lyrics-panel-fullscreen")}
    >
      <header className="lyrics-panel-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-black bg-[#FF3B6B] text-white">
            <Mic2 size={20} strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="lyrics-title" className="text-xl font-black">Lyrics</h2>
              {lyrics?.synced ? <span className="lyrics-synced-badge">Synced</span> : null}
            </div>
            <p className="text-ellipsis text-xs font-bold text-black/60">{song.title} · {song.artist}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={fullscreen ? "Exit fullscreen lyrics" : "Open fullscreen lyrics"}
          onClick={() => setFullscreen((current) => !current)}
          className="lyrics-icon-button"
        >
          {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
        </button>
      </header>

      <div className="lyrics-scroll" aria-live="polite">
        {loading ? (
          <div className="grid gap-3" aria-label="Loading lyrics">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="lyrics-skeleton" style={{ width: `${72 - index * 5}%` }} />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="lyrics-message">
            <p>{error}</p>
            <BrutalButton
              tone="yellow"
              icon={<RefreshCw size={16} />}
              onClick={() => {
                setLoading(true);
                setError("");
                setLyrics(null);
                setRequestKey((current) => current + 1);
              }}
            >
              Retry
            </BrutalButton>
          </div>
        ) : null}

        {!loading && lyrics?.instrumental ? (
          <div className="lyrics-message">
            <Mic2 size={32} />
            <p>This track is instrumental.</p>
          </div>
        ) : null}

        {!loading && lyrics && !lyrics.found ? (
          <div className="lyrics-message">
            <p>Lyrics belum tersedia untuk lagu ini.</p>
          </div>
        ) : null}

        {!loading && lyrics?.lines.length ? (
          <div className="lyrics-lines">
            {lyrics.lines.map((line, index) =>
              line.timeMs !== null ? (
                <button
                  key={`${line.timeMs}-${index}`}
                  ref={(element) => { lineRefs.current[index] = element; }}
                  type="button"
                  data-active={index === activeIndex ? "true" : "false"}
                  onClick={() => void onSeek(line.timeMs!)}
                  className={cn("lyrics-line", index === activeIndex && "lyrics-line-active")}
                >
                  {line.text}
                </button>
              ) : (
                <p
                  key={`${line.text}-${index}`}
                  ref={(element) => { lineRefs.current[index] = element; }}
                  className="lyrics-line"
                >
                  {line.text}
                </p>
              ),
            )}
          </div>
        ) : null}
      </div>

      <footer className="lyrics-panel-footer">
        <a
          href="https://lrclib.net"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-black"
        >
          Lyrics by LRCLIB <ExternalLink size={12} />
        </a>
        {fullscreen ? (
          <button type="button" onClick={() => setFullscreen(false)} className="inline-flex items-center gap-1 font-black">
            <X size={13} /> Close
          </button>
        ) : null}
      </footer>
    </section>
  );
}
