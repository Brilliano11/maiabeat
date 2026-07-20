import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  addSongToPlaylistForUser,
  removeSongFromPlaylistForUser,
  reorderPlaylistSongsForUser,
} from "@/lib/library/server";
import type { Song } from "@/lib/types";

type PlaylistSongsContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: PlaylistSongsContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const body = await readJsonObject<{ song?: Song }>(request);
    const { song } = body ?? {};
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

export async function DELETE(request: Request, context: PlaylistSongsContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const body = await readJsonObject<{ songId?: string }>(request);
    const { songId } = body ?? {};
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

export async function PUT(request: Request, context: PlaylistSongsContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const body = await readJsonObject<{ songIds?: string[] }>(request);
    const songIds = body?.songIds;
    if (
      !songIds ||
      songIds.length > 1000 ||
      !songIds.every((songId) => typeof songId === "string")
    ) {
      return NextResponse.json({ error: "songIds required." }, { status: 400 });
    }
    const orderedSongIds = await reorderPlaylistSongsForUser(guard.user.id, id, songIds);
    return NextResponse.json({ songIds: orderedSongIds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playlist reorder failed." },
      { status: 400 },
    );
  }
}
