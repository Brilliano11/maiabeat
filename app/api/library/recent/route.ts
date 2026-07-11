import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  addRecentlyPlayedForUser,
  clearRecentlyPlayedForUser,
} from "@/lib/library/server";
import type { Song } from "@/lib/types";

export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const { song, progressMs } = (await request.json()) as {
      song?: Song;
      progressMs?: number;
    };
    if (!song) return NextResponse.json({ error: "Song required." }, { status: 400 });
    const savedSong = await addRecentlyPlayedForUser(guard.user.id, song, progressMs ?? 0);
    return NextResponse.json({ song: savedSong });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recently played update failed." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    await clearRecentlyPlayedForUser(guard.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clear recent failed." },
      { status: 400 },
    );
  }
}
