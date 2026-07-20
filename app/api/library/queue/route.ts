import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  addQueueItemForUser,
  clearQueueForUser,
  replaceQueueForUser,
} from "@/lib/library/server";
import type { RepeatMode, Song } from "@/lib/types";

function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<Song>;
  return (
    typeof song.spotifyTrackId === "string" &&
    song.spotifyTrackId.length > 0 &&
    typeof song.spotifyUri === "string" &&
    typeof song.title === "string" &&
    typeof song.artist === "string" &&
    typeof song.durationMs === "number" &&
    Number.isFinite(song.durationMs)
  );
}

function isRepeatMode(value: unknown): value is RepeatMode {
  return value === "off" || value === "one" || value === "all";
}

export async function PUT(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const body = await readJsonObject<{
      songs?: unknown;
      currentTrackId?: unknown;
      currentIndex?: unknown;
      isPlaying?: unknown;
      progressMs?: unknown;
      shuffleEnabled?: unknown;
      repeatMode?: unknown;
    }>(request);
    const songs = body?.songs;

    if (!Array.isArray(songs) || songs.length > 200 || !songs.every(isSong)) {
      return NextResponse.json(
        { error: "Queue must contain at most 200 valid songs." },
        { status: 400 },
      );
    }

    const result = await replaceQueueForUser(guard.user.id, songs, {
      currentTrackId:
        typeof body?.currentTrackId === "string" ? body.currentTrackId : null,
      currentIndex:
        typeof body?.currentIndex === "number" && Number.isInteger(body.currentIndex)
          ? body.currentIndex
          : 0,
      isPlaying: typeof body?.isPlaying === "boolean" ? body.isPlaying : false,
      progressMs:
        typeof body?.progressMs === "number" && Number.isFinite(body.progressMs)
          ? body.progressMs
          : 0,
      shuffleEnabled:
        typeof body?.shuffleEnabled === "boolean" ? body.shuffleEnabled : false,
      repeatMode: isRepeatMode(body?.repeatMode) ? body.repeatMode : "off",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Queue update failed." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const body = await readJsonObject<{ song?: Song }>(request);
    const { song } = body ?? {};
    if (!song) return NextResponse.json({ error: "Song required." }, { status: 400 });
    const item = await addQueueItemForUser(guard.user.id, song);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Add to queue failed." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    await clearQueueForUser(guard.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clear queue failed." },
      { status: 400 },
    );
  }
}
