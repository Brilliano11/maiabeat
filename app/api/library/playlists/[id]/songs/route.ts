import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  addSongToPlaylistForUser,
  removeSongFromPlaylistForUser,
} from "@/lib/library/server";
import type { Song } from "@/lib/types";

export async function POST(request: Request, context: RouteContext<"/api/library/playlists/[id]/songs">) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const { song } = (await request.json()) as { song?: Song };
    if (!song) return NextResponse.json({ error: "Song required." }, { status: 400 });
    const savedSong = await addSongToPlaylistForUser(guard.user.id, id, song);
    return NextResponse.json({ song: savedSong });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Add to playlist failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/library/playlists/[id]/songs">) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const { songId } = (await request.json()) as { songId?: string };
    if (!songId) return NextResponse.json({ error: "songId required." }, { status: 400 });
    await removeSongFromPlaylistForUser(guard.user.id, id, songId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Remove from playlist failed." },
      { status: 400 },
    );
  }
}
