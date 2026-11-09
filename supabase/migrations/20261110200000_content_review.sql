-- Tablica materiałów, wersje scenariuszy, akceptacja przez klienta

-- ─────────────────────────────────────────────────────────────
-- Tablica Kanban materiałów: kolejność w kolumnie (etapie)
-- ─────────────────────────────────────────────────────────────
alter table public.content add column board_position double precision;
create index content_board on public.content (workspace_id, stage, board_position);

-- ─────────────────────────────────────────────────────────────
-- Wersje scenariuszy (CON-12)
-- ─────────────────────────────────────────────────────────────
create table public.script_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  label text check (char_length(label) <= 120),
  body jsonb not null,
  body_text text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.script_versions (content_id, created_at desc);
alter table public.script_versions enable row level security;
create policy "członkowie workspace'u" on public.script_versions
  for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create trigger script_versions_workspace before insert on public.script_versions
  for each row execute function public.inherit_workspace_from_content();

-- ─────────────────────────────────────────────────────────────
-- Akceptacja przez klienta (CON-13)
-- Klient dostaje link z losowym tokenem i nie potrzebuje konta. Stronę akceptacji
-- obsługuje serwer kluczem serwisowym; przez API token nie daje żadnego dostępu.
-- ─────────────────────────────────────────────────────────────
create type public.approval_status as enum ('pending', 'approved', 'changes_requested', 'cancelled');

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  script_version_id uuid references public.script_versions (id) on delete set null,
  -- 2 × UUID v4 = 244 losowe bity; bez zależności od pgcrypto
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status public.approval_status not null default 'pending',
  message text,                         -- wiadomość od nas do klienta
  client_name text,
  client_comment text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days'
);
create index on public.approval_requests (content_id, created_at desc);
alter table public.approval_requests enable row level security;
create policy "członkowie workspace'u" on public.approval_requests
  for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create trigger approval_requests_workspace before insert on public.approval_requests
  for each row execute function public.inherit_workspace_from_content();

alter publication supabase_realtime add table public.approval_requests, public.script_versions;

-- ─────────────────────────────────────────────────────────────
-- Powiadomienia: odpowiedzi klientów na prośby o akceptację (ostatnie 7 dni)
-- ─────────────────────────────────────────────────────────────
create or replace function public.notifications_feed()
returns table (
  key text,
  kind text,
  workspace_id uuid,
  source_type text,
  source_id uuid,
  title text,
  at timestamptz,
  read boolean
)
language sql stable security invoker set search_path = public as $$
  with tz as (
    select coalesce((select timezone from public.profiles where id = auth.uid()), 'Europe/Warsaw') as name
  ), day as (
    select (date_trunc('day', now() at time zone tz.name)) at time zone tz.name as start_at,
           (date_trunc('day', now() at time zone tz.name) + interval '1 day') at time zone tz.name as end_at
    from tz
  ), items (key, kind, workspace_id, source_type, source_id, title, at) as (
    select 'reminder:' || r.id || ':' || extract(epoch from r.remind_at)::bigint, 'reminder', e.workspace_id,
           'event', e.id, e.title, e.starts_at
    from public.reminders r
    join public.events e on e.id = r.event_id
    where r.user_id = auth.uid() and r.remind_at <= now() and e.ends_at > now() - interval '1 day'
      and e.status <> 'cancelled'

    union all
    select 'due:' || t.id || ':' || extract(epoch from t.due_at)::bigint, 'due_today', t.workspace_id,
           'task', t.id, t.title, t.due_at
    from public.tasks t, day
    where t.parent_id is null and t.status <> 'done' and t.due_at >= day.start_at and t.due_at < day.end_at

    union all
    select 'overdue:' || t.id || ':' || extract(epoch from t.due_at)::bigint, 'overdue', t.workspace_id,
           'task', t.id, t.title, t.due_at
    from public.tasks t, day
    where t.parent_id is null and t.status <> 'done' and t.due_at < day.start_at

    union all
    select 'pub:' || p.id || ':' || extract(epoch from p.publish_at)::bigint, 'publication', p.workspace_id,
           'publication', p.id, c.title, p.publish_at
    from public.content_publications p join public.content c on c.id = p.content_id, day
    where p.status = 'planned' and p.publish_at >= day.start_at and p.publish_at < day.end_at

    union all
    select 'approval:' || m.id || ':' || extract(epoch from m.due_at)::bigint, 'approval', m.workspace_id,
           'milestone', m.id, c.title, m.due_at
    from public.content_milestones m join public.content c on c.id = m.content_id, day
    where m.kind = 'approval' and m.done_at is null and m.due_at < day.end_at

    union all
    -- Klient odpowiedział na prośbę o akceptację
    select 'review:' || a.id || ':' || a.status, case a.status when 'approved' then 'client_approved' else 'client_changes' end,
           a.workspace_id, 'content', a.content_id, c.title, a.responded_at
    from public.approval_requests a join public.content c on c.id = a.content_id
    where a.status in ('approved', 'changes_requested') and a.responded_at > now() - interval '7 days'
  )
  select i.key, i.kind, i.workspace_id, i.source_type, i.source_id, i.title, i.at,
         exists (select 1 from public.notification_reads nr where nr.user_id = auth.uid() and nr.key = i.key)
  from items i
  order by i.at desc
  limit 100
$$;
