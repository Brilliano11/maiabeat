import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchSpotifyProfile,
} from "@/lib/spotify/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";

function getAppUrl(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) return requestOrigin;

  try {
    const configured = new URL(configuredUrl);
    if (configured.hostname === "localhost" || configured.hostname === "127.0.0.1") {
      return requestOrigin;
    }
    return configured.origin;
  } catch {
    return requestOrigin;
  }
}

export async function GET(request: Request) {
  const appUrl = getAppUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("maiabeat_spotify_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/profile?spotify=state_error", appUrl));
  }

  const { user } = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.redirect(new URL("/profile?spotify=supabase_error", appUrl));

  try {
    const token = await exchangeCodeForToken(code);
    const profile = await fetchSpotifyProfile(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const { data: existing } = await admin
      .from("spotify_connections")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const refreshToken = token.refresh_token ?? existing?.refresh_token;
    if (!refreshToken) throw new Error("Spotify did not return refresh token.");

    const { error } = await admin.from("spotify_connections").upsert(
      {
        user_id: user.id,
        spotify_user_id: profile.id,
        spotify_email: profile.email,
        access_token: token.access_token,
        refresh_token: refreshToken,
        token_type: token.token_type,
        scope: token.scope,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;

    cookieStore.delete("maiabeat_spotify_state");
    return NextResponse.redirect(new URL("/profile?spotify=connected", appUrl));
  } catch (error) {
    const url = new URL("/profile", appUrl);
    url.searchParams.set("spotify", "error");
    url.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Spotify connection failed",
    );
    return NextResponse.redirect(url);
  }
}
