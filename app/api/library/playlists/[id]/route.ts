import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  deletePlaylistForUser,
  getPlaylistCoverForUser,
  updatePlaylistForUser,
} from "@/lib/library/server";
import {
  isStoredPlaylistCoverUrl,
  removeStoredPlaylistCover,
} from "@/lib/library/playlistCoverStorage";
import type { PlaylistUpdate } from "@/lib/types";

const maxCustomCoverLength = 750_000;

function isValidPlaylistCover(value: string, userId: string, playlistId: string) {
  if (value === "/icons/default-cover.svg" || value.startsWith("/icons/cover-")) return true;
  if (isStoredPlaylistCoverUrl(value, { playlistId, userId })) return true;
  return (
    value.length <= maxCustomCoverLength &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}

export async function PATCH(request: Request, context: RouteContext<"/api/library/playlists/[id]">) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const body = await readJsonObject<PlaylistUpdate>(request);
    if (!body) {
      return NextResponse.json({ error: "Playlist update required." }, { status: 400 });
    }
    const name = body.name?.trim();
    if (body.name !== undefined && !name) {
      return NextResponse.json({ error: "Playlist name required." }, { status: 400 });
    }
    if (name && name.length > 80) {
      return NextResponse.json({ error: "Playlist name is too long." }, { status: 400 });
    }
    if (body.description && body.description.length > 300) {
      return NextResponse.json({ error: "Description is too long." }, { status: 400 });
    }
    if (body.coverUrl && !isValidPlaylistCover(body.coverUrl, guard.user.id, id)) {
      return NextResponse.json({ error: "Invalid playlist cover." }, { status: 400 });
    }
    if (body.visibility && body.visibility !== "private" && body.visibility !== "shared") {
      return NextResponse.json({ error: "Invalid playlist visibility." }, { status: 400 });
    }
    const previousCoverUrl =
      body.coverUrl !== undefined
        ? await getPlaylistCoverForUser(guard.user.id, id)
        : null;
    const playlist = await updatePlaylistForUser(guard.user.id, id, {
      ...body,
      name,
      description: body.description?.trim(),
    });
    if (body.coverUrl !== undefined && body.coverUrl !== previousCoverUrl) {
      await removeStoredPlaylistCover(previousCoverUrl, {
        playlistId: id,
        userId: guard.user.id,
      }).catch(() => undefined);
    }
    return NextResponse.json({ playlist });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playlist update failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/library/playlists/[id]">) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const coverUrl = await getPlaylistCoverForUser(guard.user.id, id);
    await deletePlaylistForUser(guard.user.id, id);
    await removeStoredPlaylistCover(coverUrl, {
      playlistId: id,
      userId: guard.user.id,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playlist delete failed." },
      { status: 400 },
    );
  }
}
