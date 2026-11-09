-- Etap 4: content, projekty, notatki i pomysły

-- ─────────────────────────────────────────────────────────────
-- Dane materiału dziedziczą workspace po materiale (klient go nie podaje)
-- ─────────────────────────────────────────────────────────────
create or replace function public.inherit_workspace_from_content()
returns trigger language plpgsql as $$
begin
  select c.workspace_id into new.workspace_id from public.content c where c.id = new.content_id;
  if new.workspace_id is null then
    raise exception 'Materiał nie istnieje lub nie masz do niego dostępu' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['content_milestones', 'content_publications', 'scripts', 'shots'] loop
    execute format('create trigger %I_workspace before insert on public.%I
                    for each row execute function public.inherit_workspace_from_content()', t, t);
  end loop;
end $$;

-- Klient materiału / zadania / wydarzenia musi być z tego samego workspace'u co projekt.
create or replace function public.project_client_check()
returns trigger language plpgsql as $$
declare p record;
begin
  if new.project_id is null then return new; end if;
  select workspace_id, client_id into p from public.projects where id = new.project_id;
  if p.workspace_id is distinct from new.workspace_id then
    raise exception 'Projekt należy do innego workspace''u' using errcode = '23514';
  end if;
  -- Materiał lub zadanie bez klienta przejmuje klienta projektu.
  if tg_table_name in ('content', 'tasks') and new.client_id is null then
    new.client_id := p.client_id;
  end if;
  return new;
end $$;

create trigger content_project before insert or update of project_id on public.content
  for each row execute function public.project_client_check();
create trigger tasks_project before insert or update of project_id on public.tasks
  for each row execute function public.project_client_check();
create trigger events_project before insert or update of project_id on public.events
  for each row execute function public.project_client_check();

-- ─────────────────────────────────────────────────────────────
-- Notatki
-- ─────────────────────────────────────────────────────────────
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  title text not null default '' check (char_length(title) <= 200),
  body jsonb not null default '{}'::jsonb,     -- dokument edytora (Tiptap)
  body_text text not null default '',           -- czysty tekst do wyszukiwania i podglądu
  pinned boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index on public.notes (workspace_id, updated_at desc);
create index on public.notes (event_id) where event_id is not null;

-- ─────────────────────────────────────────────────────────────
-- Pomysły
-- ─────────────────────────────────────────────────────────────
create type public.idea_status as enum ('new', 'converted', 'archived');

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  link text,                                    -- inspiracja
  type public.content_type,
  tags text[] not null default '{}',
  status public.idea_status not null default 'new',
  content_id uuid references public.content (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index on public.ideas (workspace_id, status, created_at desc);
create index on public.ideas using gin (tags);

do $$
declare t text;
begin
  foreach t in array array['notes', 'ideas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "członkowie workspace''u" on public.%I
                    for all using (public.is_member(workspace_id))
                    with check (public.is_member(workspace_id))', t);
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_row()', t, t);
  end loop;
end $$;

-- Realtime (synchronizacja na żywo w Etapie 6).
alter publication supabase_realtime add table public.notes, public.ideas;
