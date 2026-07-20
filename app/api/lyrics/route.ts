import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import { parsePlainLyrics, parseSyncedLyrics } from "@/lib/lyrics";
import type { LyricsResult } from "@/lib/types";

type LrclibResponse = {
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

const emptyLyrics: LyricsResult = {
  found: false,
  instrumental: false,
  synced: false,
  lines: [],
  source: "LRCLIB",
};

export async function GET(request: Request) {
  const guard = await requireUser({
    rateLimit: { namespace: "lyrics", limit: 30, windowMs: 60_000 },
  });
  if (guard.response) return guard.response;

  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track")?.trim() ?? "";
  const artist = searchParams.get("artist")?.trim() ?? "";
  const album = searchParams.get("album")?.trim() ?? "";
  const durationMs = Math.max(0, Number(searchParams.get("durationMs")) || 0);

  if (!track || !artist || track.length > 180 || artist.length > 180 || album.length > 180) {
    return NextResponse.json({ error: "Valid track and artist are required." }, { status: 400 });
  }

  const params = new URLSearchParams({
    track_name: track,
    artist_name: artist,
  });
  if (album) params.set("album_name", album);
  if (durationMs) params.set("duration", String(Math.round(durationMs / 1000)));

  try {
    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { "User-Agent": "Maiabeat/0.1.0" },
      next: { revalidate: 86_400 },
    });
    if (response.status === 404) return NextResponse.json(emptyLyrics);
    if (!response.ok) throw new Error(`Lyrics provider returned ${response.status}.`);

    const data = (await response.json()) as LrclibResponse;
    const syncedLines = parseSyncedLyrics(data.syncedLyrics);
    const plainLines = parsePlainLyrics(data.plainLyrics);
    const lines = syncedLines.length ? syncedLines : plainLines;
    return NextResponse.json({
      found: Boolean(lines.length || data.instrumental),
      instrumental: Boolean(data.instrumental),
      synced: Boolean(syncedLines.length),
      lines,
      source: "LRCLIB",
    } satisfies LyricsResult);
  } catch (error) {
    console.error("Lyrics lookup failed", {
      track,
      artist,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: "Lyrics are temporarily unavailable." },
      { status: 502 },
    );
  }
}
