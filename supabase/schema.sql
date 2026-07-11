create extension if not exists "pgcrypto";

create table if not exists public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'partner' check (role in ('owner', 'partner')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  role text not null default 'partner' check (role in ('owner', 'partner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spotify_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spotify_user_id text,
  spotify_email text,
  access_token text not null,
  refresh_token text not null,
  token_type text,
  scope text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  spotify_track_id text not null unique,
  spotify_uri text not null unique,
  title text not null,
  artist text,
  artists jsonb default '[]'::jsonb,
  album text,
  cover_url text,
  duration_ms integer,
  explicit boolean default false,
  popularity integer,
  external_url text,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.liked_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, song_id)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(playlist_id, position)
);

create table if not exists public.queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null,
  source text default 'manual',
  created_at timestamptz not null default now(),
  unique(user_id, position)
);

create table if not exists public.recently_played (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  played_at timestamptz not null default now(),
  progress_ms integer default 0
);

create table if not exists public.player_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_song_id uuid references public.songs(id) on delete set null,
  device_id text,
  is_playing boolean not null default false,
  progress_ms integer not null default 0,
  current_index integer not null default 0,
  shuffle_enabled boolean not null default false,
  repeat_mode text not null default 'off' check (repeat_mode in ('off', 'one', 'all')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_allowed_users_email on public.allowed_users(lower(email));
create index if not exists idx_songs_spotify_track_id on public.songs(spotify_track_id);
create index if not exists idx_liked_songs_user_id on public.liked_songs(user_id);
create index if not exists idx_playlists_owner_id on public.playlists(owner_id);
create index if not exists idx_playlist_songs_playlist_id on public.playlist_songs(playlist_id);
create index if not exists idx_queue_items_user_id on public.queue_items(user_id);
create index if not exists idx_recently_played_user_id on public.recently_played(user_id);

alter table public.allowed_users enable row level security;
alter table public.profiles enable row level security;
alter table public.spotify_connections enable row level security;
alter table public.songs enable row level security;
alter table public.liked_songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.queue_items enable row level security;
alter table public.recently_played enable row level security;
alter table public.player_states enable row level security;

create policy "allowed_users_read_self_email" on public.allowed_users
for select using (lower(email) = lower((select auth.jwt() ->> 'email')));

create policy "profiles_read_allowed" on public.profiles
for select using (
  exists (
    select 1 from public.allowed_users au
    where lower(au.email) = lower((select auth.jwt() ->> 'email'))
  )
);

create policy "profiles_update_self" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "spotify_connections_read_self" on public.spotify_connections
for select using (auth.uid() = user_id);

create policy "songs_read_authenticated" on public.songs
for select using (auth.uid() is not null);

create policy "songs_insert_authenticated" on public.songs
for insert with check (auth.uid() is not null);

create policy "songs_update_authenticated" on public.songs
for update using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "liked_read_self" on public.liked_songs
for select using (auth.uid() = user_id);

create policy "liked_insert_self" on public.liked_songs
for insert with check (auth.uid() = user_id);

create policy "liked_delete_self" on public.liked_songs
for delete using (auth.uid() = user_id);

create policy "playlists_read" on public.playlists
for select using (auth.uid() = owner_id or visibility = 'shared');

create policy "playlists_insert_self" on public.playlists
for insert with check (auth.uid() = owner_id);

create policy "playlists_update_owner" on public.playlists
for update using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "playlists_delete_owner" on public.playlists
for delete using (auth.uid() = owner_id);

create policy "playlist_songs_read" on public.playlist_songs
for select using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id
    and (p.owner_id = auth.uid() or p.visibility = 'shared')
  )
);

create policy "playlist_songs_insert_allowed" on public.playlist_songs
for insert with check (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id
    and (p.owner_id = auth.uid() or p.visibility = 'shared')
  )
);

create policy "playlist_songs_delete_allowed" on public.playlist_songs
for delete using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id
    and (p.owner_id = auth.uid() or p.visibility = 'shared')
  )
);

create policy "queue_read_self" on public.queue_items
for select using (auth.uid() = user_id);

create policy "queue_insert_self" on public.queue_items
for insert with check (auth.uid() = user_id);

create policy "queue_update_self" on public.queue_items
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "queue_delete_self" on public.queue_items
for delete using (auth.uid() = user_id);

create policy "recent_read_self" on public.recently_played
for select using (auth.uid() = user_id);

create policy "recent_insert_self" on public.recently_played
for insert with check (auth.uid() = user_id);

create policy "player_state_read_self" on public.player_states
for select using (auth.uid() = user_id);

create policy "player_state_insert_self" on public.player_states
for insert with check (auth.uid() = user_id);

create policy "player_state_update_self" on public.player_states
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  allowed_row public.allowed_users%rowtype;
begin
  select * into allowed_row
  from public.allowed_users
  where lower(email) = lower(new.email)
  limit 1;

  if allowed_row.email is not null then
    insert into public.profiles (id, email, display_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'display_name', allowed_row.display_name, split_part(new.email, '@', 1)),
      allowed_row.role
    )
    on conflict (id) do update set
      email = excluded.email,
      display_name = excluded.display_name,
      role = excluded.role,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Seed invited emails after creating the schema:
-- insert into public.allowed_users (email, role, display_name)
-- values ('anggitaramo@gmail.com', 'owner', 'Anggita')
-- on conflict (email) do update set role = excluded.role, display_name = excluded.display_name;
