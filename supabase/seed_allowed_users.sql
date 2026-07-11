insert into public.allowed_users (email, role, display_name)
values ('anggitaramo@gmail.com', 'owner', 'Anggita')
on conflict (email) do update set
  role = excluded.role,
  display_name = excluded.display_name;
