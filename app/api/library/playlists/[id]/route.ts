import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import { deletePlaylistForUser, updatePlaylistForUser } from "@/lib/library/server";
import type { PlaylistUpdate } from "@/lib/types";

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
    if (
      body.coverUrl &&
      body.coverUrl !== "/icons/default-cover.svg" &&
      !body.coverUrl.startsWith("/icons/cover-")
    ) {
      return NextResponse.json({ error: "Invalid playlist cover." }, { status: 400 });
    }
    if (body.visibility && body.visibility !== "private" && body.visibility !== "shared") {
      return NextResponse.json({ error: "Invalid playlist visibility." }, { status: 400 });
    }
    const playlist = await updatePlaylistForUser(guard.user.id, id, {
      ...body,
      name,
      description: body.description?.trim(),
    });
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
    await deletePlaylistForUser(guard.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playlist delete failed." },
      { status: 400 },
    );
  }
}
