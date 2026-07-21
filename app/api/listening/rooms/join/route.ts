import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/request";
import { requireUser } from "@/lib/auth/routeGuard";
import {
  joinListeningRoom,
  listeningRoomErrorDetails,
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
    rateLimit: { namespace: "listening-join", limit: 30, windowMs: 10 * 60_000 },
  });
  if (guard.response) return guard.response;

  try {
    const body = await readJsonObject<{ code?: unknown }>(request);
    if (typeof body?.code !== "string") {
      return NextResponse.json({ error: "Room code required." }, { status: 400 });
    }
    const room = await joinListeningRoom(
      guard.user.id,
      displayNameFor(guard.user),
      body.code,
    );
    return NextResponse.json({ room });
  } catch (error) {
    const details = listeningRoomErrorDetails(error, "Could not join room.");
    return NextResponse.json({ error: details.message }, { status: details.status });
  }
}
