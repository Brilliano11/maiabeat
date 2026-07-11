# Maiabeat

Maiabeat is an invite-only, mobile-first music PWA with a neo brutalism UI. It uses Supabase for auth/data and Spotify Web API + Spotify Web Playback SDK for search and full-track playback.

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
4. Run `supabase/schema.sql` in the Supabase SQL editor.
5. Add invited users:

```sql
insert into public.allowed_users (email, role, display_name)
values
  ('anggitaramo@gmail.com', 'owner', 'Anggita'),
  ('friend@example.com', 'partner', 'Friend');
```

Maiabeat is not public-open. Any email not present in `allowed_users` will be rejected with an invite-only message.

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

Deploy to Vercel, add all environment variables, then add the Vercel callback URL to the Spotify Developer Dashboard.

## Known Limitations

- Full playback requires Spotify Premium.
- Each invited person should connect their own Spotify account.
- The app does not download, store, rip, or cache Spotify audio.
- Offline mode only caches static UI assets, not songs.
- Spotify Development Mode may require manually adding test users in the Spotify dashboard.
