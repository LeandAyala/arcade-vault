-- SPEC 04 — Perfiles de jugador (alias) vinculados a auth.users.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Alias público de cada jugador. Se crea automáticamente al registrarse.';

alter table public.profiles enable row level security;

-- Lectura pública (servirá al ranking). Sin políticas de insert/update/delete:
-- el cliente no puede escribir; solo el trigger handle_new_user inserta filas.
create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);

-- Crea el perfil al registrarse un usuario. Si el alias viola el CHECK o el
-- unique, el insert falla y Supabase Auth no crea el usuario.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

-- Solo la invoca el trigger; nadie debe poder llamarla por la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
