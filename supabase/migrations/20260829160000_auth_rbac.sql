create type public.app_role as enum ('ops', 'po', 'release_manager', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.app_role not null default 'ops',
  created_at timestamptz not null default now()
);

create table public.meps (
  id uuid primary key,
  status text not null check (status in ('draft','running','completed')),
  definition jsonb not null,
  execution jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mep_templates (
  id uuid primary key,
  name text not null,
  definition jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = auth.uid() $$;
create or replace function public.role_level(value public.app_role) returns int language sql immutable as $$ select case value when 'ops' then 1 when 'po' then 2 when 'release_manager' then 3 when 'admin' then 4 end $$;
create or replace function public.has_level(required int) returns boolean language sql stable security definer set search_path = '' as $$ select coalesce(public.role_level(public.current_role()) >= required, false) $$;
create or replace function public.is_bootstrap_available() returns boolean language sql stable security definer set search_path = '' as $$ select not exists(select 1 from public.profiles) $$;
grant execute on function public.is_bootstrap_available() to anon, authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,display_name,role) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',''),case when not exists(select 1 from public.profiles) then 'admin'::public.app_role else 'ops'::public.app_role end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.enforce_mep_role() returns trigger language plpgsql security definer set search_path = '' as $$
declare level int := public.role_level(public.current_role());
begin
  if tg_op = 'INSERT' and level < 3 then raise exception 'Release Manager requis pour créer une MEP'; end if;
  if tg_op = 'DELETE' and level < 4 then raise exception 'Administrateur requis'; end if;
  if tg_op = 'UPDATE' then
    if new.definition is distinct from old.definition and level < 3 then raise exception 'Release Manager requis pour modifier la définition'; end if;
    if old.status = 'draft' and new.status = 'running' and level < 2 then raise exception 'Product Owner requis pour lancer une MEP'; end if;
    if new.created_by is distinct from old.created_by then raise exception 'Créateur immuable'; end if;
    new.updated_at := now();
  end if;
  return coalesce(new, old);
end $$;
create trigger enforce_mep_role before insert or update or delete on public.meps for each row execute function public.enforce_mep_role();

alter table public.profiles enable row level security;
alter table public.meps enable row level security;
alter table public.mep_templates enable row level security;
revoke all on public.profiles, public.meps, public.mep_templates from anon;
grant select on public.profiles, public.meps, public.mep_templates to authenticated;
grant insert, update, delete on public.meps, public.mep_templates to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_admin_update on public.profiles for update to authenticated using (public.has_level(4)) with check (public.has_level(4));
create policy meps_read on public.meps for select to authenticated using (true);
create policy meps_insert on public.meps for insert to authenticated with check (public.has_level(3) and created_by = auth.uid());
create policy meps_update on public.meps for update to authenticated using (public.has_level(1)) with check (public.has_level(1));
create policy meps_delete on public.meps for delete to authenticated using (public.has_level(4));
create policy templates_read on public.mep_templates for select to authenticated using (true);
create policy templates_insert on public.mep_templates for insert to authenticated with check (public.has_level(3) and created_by = auth.uid());
create policy templates_delete on public.mep_templates for delete to authenticated using (public.has_level(4));
