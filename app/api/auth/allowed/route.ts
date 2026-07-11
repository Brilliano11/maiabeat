import { NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowedUsers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? "";
  const allowed = await isEmailAllowed(email);

  return NextResponse.json({ allowed });
}
