-- Données de l'app : un enregistrement JSON par objet (compte, mouvement, placement...), isolé par utilisateur.
create table public.records (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index records_user_collection_idx on public.records(user_id, collection);
alter table public.records enable row level security;

create policy "records_select_own" on public.records for select to authenticated using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.records for delete to authenticated using ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger records_touch_updated_at before update on public.records
for each row execute function private.touch_updated_at();

-- Inscriptions sur invitation uniquement
create table private.app_config (
  key text primary key,
  value text not null
);
create table private.signup_allow (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Appelée par la fonction edge "signup" (service_role) : vérifie le code et autorise l'email quelques minutes.
create or replace function public.allow_signup(p_email text, p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_max int;
  v_count int;
begin
  select value into v_code from private.app_config where key = 'invite_code';
  select coalesce((select value::int from private.app_config where key = 'max_users'), 5) into v_max;
  select count(*) into v_count from auth.users;
  if v_code is null or p_code is null or upper(trim(p_code)) <> upper(v_code) or v_count >= v_max then
    return false;
  end if;
  insert into private.signup_allow(email) values (lower(trim(p_email)))
  on conflict (email) do update set created_at = now();
  return true;
end;
$$;
revoke execute on function public.allow_signup(text, text) from public, anon, authenticated;
grant execute on function public.allow_signup(text, text) to service_role;

create or replace function private.guard_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from private.signup_allow
    where email = lower(new.email) and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'Inscriptions fermées : un code d''invitation est nécessaire.';
  end if;
  delete from private.signup_allow where email = lower(new.email);
  return new;
end;
$$;
create trigger guard_signup before insert on auth.users
for each row execute function private.guard_signup();
