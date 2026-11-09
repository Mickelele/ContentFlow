-- ContentFlow — schemat początkowy
-- Model: użytkownik należy do wielu workspace'ów (firm). Wszystkie dane mają workspace_id,
-- a RLS wpuszcza tylko członków danego workspace'u.

set check_function_bodies = off;

-- ─────────────────────────────────────────────────────────────
-- Typy
-- ─────────────────────────────────────────────────────────────
create type public.member_role as enum ('owner', 'member');
create type public.client_color as enum (
  'red', 'orange', 'amber', 'lime', 'green', 'teal',
  'cyan', 'blue', 'indigo', 'violet', 'pink', 'brown'
);
create type public.calendar_kind as enum ('client', 'tasks', 'custom', 'google');
create type public.event_category as enum ('recording', 'editing', 'publication', 'meeting', 'task', 'other');
create type public.event_status as enum ('planned', 'in_progress', 'done', 'cancelled');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.content_type as enum ('reel', 'post', 'graphic', 'video', 'carousel', 'other');
create type public.content_stage as enum ('idea', 'script', 'recording', 'editing', 'approval', 'scheduled', 'published');
create type public.milestone_kind as enum ('recording', 'editing', 'approval');
create type public.platform as enum ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube');
create type public.publication_status as enum ('planned', 'published', 'cancelled');
create type public.project_status as enum ('active', 'paused', 'done', 'archived');

-- ─────────────────────────────────────────────────────────────
-- Funkcje pomocnicze
-- ─────────────────────────────────────────────────────────────
create or replace function public.slugify(input text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(input, ''),
      'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzACELNOSZZ')),
    '[^a-z0-9]+', '-', 'g'))
$$;

-- updated_at + licznik wersji (do wykrywania konfliktów synchronizacji)
create or replace function public.touch_row()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.version := coalesce(old.version, 0) + 1;
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Profile i workspace'y
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  timezone text not null default 'Europe/Warsaw',
  settings jsonb not null default '{}'::jsonb,
  last_workspace_id uuid,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  color public.client_color not null default 'blue',
  plan text not null default 'free',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_last_workspace_fk
  foreign key (last_workspace_id) references public.workspaces (id) on delete set null;

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

-- Czy bieżący użytkownik należy do workspace'u. SECURITY DEFINER, żeby polityki
-- na workspace_members nie wywoływały się rekurencyjnie.
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  )
$$;

create or replace function public.is_owner(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = 'owner'
  )
$$;

-- Unikalny slug: "poligon-4x4", "poligon-4x4-2", …
-- SECURITY DEFINER: musi widzieć slugi wszystkich workspace'ów, nie tylko tych spod RLS.
create or replace function public.unique_workspace_slug(base_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  base text := nullif(public.slugify(base_name), '');
  candidate text;
  n int := 1;
begin
  base := coalesce(base, 'workspace');
  candidate := base;
  while exists (select 1 from public.workspaces where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end $$;

create or replace function public.workspaces_before_insert()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.unique_workspace_slug(new.name);
  end if;
  return new;
end $$;

create trigger workspaces_slug before insert on public.workspaces
  for each row execute function public.workspaces_before_insert();

-- ─────────────────────────────────────────────────────────────
-- Klienci, warstwy kalendarza, projekty
-- ─────────────────────────────────────────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  color public.client_color not null default 'blue',
  contact_person text,
  email text,
  phone text,
  website text,
  socials jsonb not null default '{}'::jsonb,   -- {"instagram": "...", "tiktok": "...", …}
  notes text,
  monthly_package jsonb,                        -- P1: np. {"reel": 8}
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index on public.clients (workspace_id) where archived_at is null;

-- Warstwa kalendarza (jak „Mój kalendarz”, „deadline” w Google).
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.calendar_kind not null,
  name text not null,
  color public.client_color not null default 'blue',
  client_id uuid unique references public.clients (id) on delete cascade,
  google_calendar_id text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check ((kind = 'client') = (client_id is not null))
);
create index on public.calendars (workspace_id);
create unique index calendars_one_tasks_per_ws on public.calendars (workspace_id) where kind = 'tasks';

-- Która warstwa jest widoczna — per użytkownik, synchronizowane między urządzeniami.
create table public.calendar_visibility (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  visible boolean not null default true,
  primary key (user_id, calendar_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  status public.project_status not null default 'active',
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index on public.projects (workspace_id);
create index on public.projects (client_id);

-- ─────────────────────────────────────────────────────────────
-- Content (materiały) i ich terminy
-- ─────────────────────────────────────────────────────────────
create table public.content (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  type public.content_type not null default 'reel',
  stage public.content_stage not null default 'idea',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index on public.content (workspace_id, stage);
create index on public.content (client_id);

create table public.content_milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  kind public.milestone_kind not null,
  due_at timestamptz not null,
  all_day boolean not null default true,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (content_id, kind)
);
create index on public.content_milestones (workspace_id, due_at);

create table public.content_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  platform public.platform not null,
  publish_at timestamptz not null,
  caption text,
  hashtags text[] not null default '{}',
  status public.publication_status not null default 'planned',
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index on public.content_publications (workspace_id, publish_at);

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null unique references public.content (id) on delete cascade,
  body jsonb not null default '{}'::jsonb,       -- dokument edytora (Tiptap)
  updated_at timestamptz not null default now(),
  version int not null default 1
);

create table public.shots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  description text not null,
  done boolean not null default false,
  position int not null default 0
);
create index on public.shots (content_id);

-- ─────────────────────────────────────────────────────────────
-- Wydarzenia
-- ─────────────────────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  category public.event_category not null default 'other',
  status public.event_status not null default 'planned',
  all_day boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  url text,
  rrule text,                 -- P1: wydarzenia cykliczne
  external_id text,           -- identyfikator z Google/Outlook, chroni przed duplikatami
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  check (ends_at >= starts_at)
);
create index on public.events (workspace_id, starts_at, ends_at);
create unique index events_external_unique on public.events (calendar_id, external_id) where external_id is not null;

create table public.event_content (
  event_id uuid not null references public.events (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  primary key (event_id, content_id)
);

-- ─────────────────────────────────────────────────────────────
-- Zadania
-- ─────────────────────────────────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_id uuid references public.tasks (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  content_id uuid references public.content (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  due_at timestamptz,
  due_all_day boolean not null default true,  -- termin to znacznik, nie rezerwacja godziny
  completed_at timestamptz,
  estimate_minutes int,
  actual_minutes int,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index on public.tasks (workspace_id, status, due_at);
create index on public.tasks (parent_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position int not null default 0
);
create index on public.checklist_items (task_id);

-- ─────────────────────────────────────────────────────────────
-- Załączniki (Google Drive), przypomnienia, integracje
-- ─────────────────────────────────────────────────────────────
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type text not null check (entity_type in ('content', 'event', 'task', 'project', 'client', 'script')),
  entity_id uuid not null,
  drive_file_id text,
  name text not null,
  mime_type text,
  url text not null,
  icon_url text,
  created_at timestamptz not null default now()
);
create index on public.attachments (entity_type, entity_id);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  publication_id uuid references public.content_publications (id) on delete cascade,
  remind_at timestamptz not null,
  sent_at timestamptz,
  check (num_nonnulls(event_id, task_id, publication_id) = 1)
);
create index reminders_due on public.reminders (remind_at) where sent_at is null;

-- Konto Google podpinane per workspace. Tokeny trzymamy w Supabase Vault (vault_secret_id),
-- nigdy w tej tabeli.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google')),
  account_email text,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked')),
  vault_secret_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, account_email)
);

-- ─────────────────────────────────────────────────────────────
-- Triggery
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['clients','projects','content','content_milestones',
                           'content_publications','scripts','events','tasks'] loop
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_row()', t, t);
  end loop;
end $$;

-- Nowy workspace: twórca zostaje właścicielem, powstaje warstwa „Zadania”.
create or replace function public.workspaces_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  insert into public.calendars (workspace_id, kind, name, color, position)
  values (new.id, 'tasks', 'Zadania', 'brown', 1000);

  update public.profiles set last_workspace_id = new.id
  where id = new.created_by and last_workspace_id is null;
  return new;
end $$;

create trigger workspaces_bootstrap after insert on public.workspaces
  for each row execute function public.workspaces_after_insert();

-- Klient ⇄ jego warstwa kalendarza.
create or replace function public.clients_sync_calendar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.calendars (workspace_id, kind, name, color, client_id, position)
    values (new.workspace_id, 'client', new.name, new.color, new.id,
            (select count(*) from public.calendars where workspace_id = new.workspace_id));
  elsif new.name is distinct from old.name or new.color is distinct from old.color then
    update public.calendars set name = new.name, color = new.color where client_id = new.id;
  end if;
  return new;
end $$;

create trigger clients_calendar after insert or update on public.clients
  for each row execute function public.clients_sync_calendar();

-- Rejestracja: profil + pierwszy workspace.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  display_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, display_name, new.raw_user_meta_data ->> 'avatar_url');

  insert into public.workspaces (name, created_by)
  values (display_name, new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy "własny profil" on public.profiles
  for select using (id = auth.uid());
create policy "edycja własnego profilu" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

alter table public.workspaces enable row level security;
create policy "członkowie widzą workspace" on public.workspaces
  for select using (public.is_member(id) or created_by = auth.uid());
create policy "każdy zalogowany tworzy workspace" on public.workspaces
  for insert with check (created_by = auth.uid());
create policy "właściciel edytuje workspace" on public.workspaces
  for update using (public.is_owner(id));
create policy "właściciel usuwa workspace" on public.workspaces
  for delete using (public.is_owner(id));

alter table public.workspace_members enable row level security;
create policy "członkowie widzą skład" on public.workspace_members
  for select using (public.is_member(workspace_id));
create policy "właściciel zarządza składem" on public.workspace_members
  for all using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy "można opuścić workspace" on public.workspace_members
  for delete using (user_id = auth.uid());

alter table public.calendar_visibility enable row level security;
create policy "własna widoczność warstw" on public.calendar_visibility
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.calendars c where c.id = calendar_id and public.is_member(c.workspace_id)));

-- Wszystkie tabele z workspace_id: dostęp dla członków.
do $$
declare t text;
begin
  foreach t in array array['clients','calendars','projects','content','content_milestones',
                           'content_publications','scripts','shots','events','event_content',
                           'tasks','checklist_items','attachments','integrations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "członkowie workspace''u" on public.%I
                    for all using (public.is_member(workspace_id))
                    with check (public.is_member(workspace_id))', t);
  end loop;
end $$;

alter table public.reminders enable row level security;
create policy "własne przypomnienia" on public.reminders
  for all using (user_id = auth.uid() and public.is_member(workspace_id))
  with check (user_id = auth.uid() and public.is_member(workspace_id));

-- Realtime: zmiany na żywo między telefonem a laptopem.
alter publication supabase_realtime add table
  public.events, public.tasks, public.content, public.content_milestones,
  public.content_publications, public.clients, public.calendars;
