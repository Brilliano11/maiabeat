drop policy if exists "allowed_users_read_self_email" on public.allowed_users;
drop policy if exists "profiles_read_allowed" on public.profiles;

create policy "profiles_read_authenticated" on public.profiles
for select using (auth.uid() is not null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'partner'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();

  return new;
end;
$$;

drop table if exists public.allowed_users;
