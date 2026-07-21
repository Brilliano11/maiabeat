import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  createListeningRoom,
  listeningRoomErrorDetails,
  normalizeListeningSync,
} from "@/lib/listening/server";

function displayNameFor(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().slice(0, 80);
  }
  return (user.email?.split("@")[0] || "Listener").slice(0, 80);
}

export async function POST(request: Request) {
  const guard = await requireUser({
    rateLimit: { namespace: "listening-create", limit: 10, windowMs: 60 * 60_000 },
  });
  if (guard.response) return guard.response;

  try {
    const body = await readJsonObject<{ playback?: unknown }>(request);
    const playback = normalizeListeningSync(body?.playback);
    const room = await createListeningRoom(
      guard.user.id,
      displayNameFor(guard.user),
      playback,
    );
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    const details = listeningRoomErrorDetails(error, "Room creation failed.");
    return NextResponse.json({ error: details.message }, { status: details.status });
  }
}
