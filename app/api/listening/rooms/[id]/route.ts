import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  getListeningRoomForUser,
  heartbeatListeningRoom,
  leaveListeningRoom,
  listeningRoomErrorDetails,
  normalizeListeningSync,
  syncListeningRoom,
} from "@/lib/listening/server";

function errorResponse(error: unknown, fallback: string) {
  const details = listeningRoomErrorDetails(error, fallback);
  return NextResponse.json({ error: details.message }, { status: details.status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/listening/rooms/[id]">,
) {
  const guard = await requireUser({ rateLimit: false });
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const room = await getListeningRoomForUser(guard.user.id, id);
    return NextResponse.json({ room });
  } catch (error) {
    return errorResponse(error, "Could not load listening room.");
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/listening/rooms/[id]">,
) {
  const guard = await requireUser({
    rateLimit: { namespace: "listening-sync", limit: 240, windowMs: 60_000 },
  });
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    const body = await readJsonObject<{ action?: unknown; playback?: unknown }>(request);
    if (body?.action === "heartbeat") {
      const room = await heartbeatListeningRoom(guard.user.id, id);
      return NextResponse.json({ room });
    }
    if (body?.action === "sync") {
      const playback = normalizeListeningSync(body.playback);
      const room = await syncListeningRoom(guard.user.id, id, playback);
      return NextResponse.json({ room });
    }
    return NextResponse.json({ error: "Invalid room action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error, "Listening room update failed.");
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/listening/rooms/[id]">,
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await context.params;

  try {
    await leaveListeningRoom(guard.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not leave listening room.");
  }
}
