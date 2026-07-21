create table if not exists public.listening_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  current_song jsonb,
  queue jsonb not null default '[]'::jsonb,
  current_index integer not null default 0 check (current_index >= 0),
  is_playing boolean not null default false,
  position_ms integer not null default 0 check (position_ms >= 0),
  started_at timestamptz,
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create table if not exists public.listening_room_members (
  room_id uuid not null references public.listening_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null default 'listener' check (role in ('host', 'listener')),
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_listening_rooms_host on public.listening_rooms(host_id);
create index if not exists idx_listening_rooms_active_code
  on public.listening_rooms(code) where status = 'active';
create index if not exists idx_listening_members_user
  on public.listening_room_members(user_id);
create index if not exists idx_listening_members_last_seen
  on public.listening_room_members(room_id, last_seen desc);

alter table public.listening_rooms enable row level security;
alter table public.listening_room_members enable row level security;

create or replace function public.is_listening_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.listening_room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
  );
$$;

revoke all on function public.is_listening_room_member(uuid) from public;
grant execute on function public.is_listening_room_member(uuid) to authenticated;

drop policy if exists "listening_rooms_read_members" on public.listening_rooms;
create policy "listening_rooms_read_members" on public.listening_rooms
for select to authenticated
using (host_id = auth.uid() or public.is_listening_room_member(id));

drop policy if exists "listening_members_read_room" on public.listening_room_members;
create policy "listening_members_read_room" on public.listening_room_members
for select to authenticated
using (user_id = auth.uid() or public.is_listening_room_member(room_id));

do $$
begin
  alter publication supabase_realtime add table public.listening_rooms;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.listening_room_members;
exception
  when duplicate_object then null;
end $$;
