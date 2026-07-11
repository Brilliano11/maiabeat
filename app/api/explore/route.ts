import { NextResponse } from "next/server";
import { moodItems } from "@/lib/catalog";
import { requireUser } from "@/lib/auth/routeGuard";

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  return NextResponse.json({
    sections: [
      "Made for Maia & Anggita",
      "Recently Played",
      "Your Top Tracks",
      "Your Top Artists",
      "New Releases",
      ...moodItems.map((mood) => mood.name),
      "Discover More",
    ],
    moods: moodItems,
  });
}
