# Maiabeat

Maiabeat is a mobile-first music PWA with a neo brutalism UI. It uses Supabase for auth/data and Spotify Web API + Spotify Web Playback SDK for search and full-track playback.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL
- Spotify OAuth, Web API, and Web Playback SDK
- Zustand state
- PWA manifest + static asset service worker

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```txt
http://127.0.0.1:3002
```

## Supabase Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Run `supabase/schema.sql` in the Supabase SQL editor. This also creates the public
   `playlist-covers` Storage bucket used for cropped playlist artwork.
5. For an existing Maiabeat database, run `supabase/playlist_covers_storage.sql` and
   `supabase/listening_together.sql` without replaying the full schema. The listening migration
   adds room/member tables, RLS policies, and Realtime publication entries without modifying
   playlist, queue, profile, or playback-history rows.
6. In Supabase Auth settings, decide whether new users must confirm email before logging in.

## Spotify Setup

Create a Spotify Developer App and enable:

```txt
Web API
Web Playback SDK
```

Add this local Redirect URI exactly:

```txt
http://127.0.0.1:3002/api/spotify/callback
```

When deploying to Vercel, also add:

```txt
https://NAMA-PROJECT.vercel.app/api/spotify/callback
```

Set the same value in `SPOTIFY_REDIRECT_URI`.

Required scopes:

```txt
streaming
user-read-email
user-read-private
user-read-playback-state
user-modify-playback-state
user-read-currently-playing
playlist-read-private
playlist-read-collaborative
playlist-modify-private
playlist-modify-public
user-library-read
user-library-modify
```

## Spotify Limits

Full playback requires Spotify Premium. Spotify Development Mode can limit how many Spotify users can authenticate with the app. For wider usage, request Extended Quota Mode in the Spotify Developer Dashboard.

## Environment Notes

Never expose these in client code:

```txt
SPOTIFY_CLIENT_SECRET
SUPABASE_SERVICE_ROLE_KEY
Spotify refresh_token
```

Maiabeat stores Spotify refresh tokens only in Supabase through server routes.

## Deployment

1. Push changes to a non-production branch and verify the Vercel Preview deployment first.
2. Add every variable from `.env.example` to the matching Vercel environment. Store
   `SPOTIFY_CLIENT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` as sensitive server-only values.
3. Set `NEXT_PUBLIC_APP_URL` and `SPOTIFY_REDIRECT_URI` to the exact HTTPS deployment URL.
4. Add the same `/api/spotify/callback` URL to the Spotify Developer Dashboard.
5. Apply `supabase/schema.sql` to a new target project. For an existing project, apply only the
   standalone migrations in `supabase/` and verify that RLS and Realtime are enabled.
6. If Maiabeat is private, disable new-user signups in Supabase Auth. Otherwise enable email
   confirmation and review Supabase Auth rate limits.
7. Add Vercel WAF rate-limit rules for `/api/spotify/*` and `/api/lyrics`. The application also
   applies a per-user limiter, while WAF provides distributed protection before a request reaches
   the application.
8. Test login, Spotify OAuth, playback, queue persistence, playlist editing, lyrics, and a
   two-account Listening Together room in Preview before promoting to Production.

## Known Limitations

- Full playback requires Spotify Premium.
- Each person should connect their own Spotify account.
- Listening Together requires every participant to have Spotify Premium and an active Maiabeat
  Spotify connection. The host controls playback; volume remains personal to each listener.
- The app does not download, store, rip, or cache Spotify audio.
- Offline mode only caches static UI assets, not songs.
- Spotify Development Mode may require manually adding test users in the Spotify dashboard.
