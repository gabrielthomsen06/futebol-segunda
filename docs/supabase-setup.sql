-- =============================================================
-- Futebol de Segunda — Setup do banco
-- Rode este script uma única vez no SQL Editor do Supabase.
-- =============================================================

-- 1. TABELAS ---------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  nick        text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  team_a      jsonb not null,
  team_b      jsonb not null,
  events      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- 2. FUNÇÃO is_admin ------------------------------------------

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false)
$$;

-- 3. TRIGGER: criar profile no signup --------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Sem nome')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. TRIGGER: blindar coluna is_admin --------------------------

create or replace function public.prevent_self_admin_promotion()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.is_admin is distinct from new.is_admin
     and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change is_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_self_promotion on public.profiles;
create trigger profiles_block_self_promotion
  before update on public.profiles
  for each row execute function public.prevent_self_admin_promotion();

-- 5. ROW LEVEL SECURITY ----------------------------------------

alter table public.profiles enable row level security;
alter table public.matches  enable row level security;

-- profiles: leitura pública
-- Nota: não há policy de INSERT por design — profiles são criados
-- exclusivamente pelo trigger handle_new_user no signup.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- profiles: cada um edita o próprio, admin edita qualquer um
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin(auth.uid()));

-- profiles: só admin deleta
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin(auth.uid()));

-- matches: leitura pública
drop policy if exists "matches_select_all" on public.matches;
create policy "matches_select_all" on public.matches
  for select using (true);

-- matches: só admin escreve
drop policy if exists "matches_admin_insert" on public.matches;
create policy "matches_admin_insert" on public.matches
  for insert with check (public.is_admin(auth.uid()));

drop policy if exists "matches_admin_update" on public.matches;
create policy "matches_admin_update" on public.matches
  for update using (public.is_admin(auth.uid()));

drop policy if exists "matches_admin_delete" on public.matches;
create policy "matches_admin_delete" on public.matches
  for delete using (public.is_admin(auth.uid()));
