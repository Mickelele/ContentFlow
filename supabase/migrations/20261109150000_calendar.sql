-- Etap 2: kalendarz
-- 1. Wydarzenie dziedziczy workspace (i klienta) po warstwie, w której leży.
-- 2. calendar_items(od, do): jeden odczyt wszystkiego, co ma datę — wydarzeń, terminów zadań,
--    terminów produkcji i publikacji — ze wszystkich workspace'ów użytkownika (RLS filtruje).

-- ─────────────────────────────────────────────────────────────
-- Wydarzenie ← warstwa
-- ─────────────────────────────────────────────────────────────
create or replace function public.events_from_calendar()
returns trigger language plpgsql as $$
declare
  cal record;
begin
  if tg_op = 'INSERT' or new.calendar_id is distinct from old.calendar_id then
    select c.workspace_id, c.kind, c.client_id into cal
    from public.calendars c where c.id = new.calendar_id;
    if not found then
      raise exception 'Warstwa kalendarza nie istnieje lub nie masz do niej dostępu'
        using errcode = '42501';
    end if;
    -- workspace_id i client_id zawsze wynikają z warstwy: klient wydarzenia = klient jego warstwy.
    -- (NOT NULL i RLS są sprawdzane po triggerze BEFORE, więc klient nie musi ich podawać.)
    new.workspace_id := cal.workspace_id;
    new.client_id := case when cal.kind = 'client' then cal.client_id end;
  end if;
  return new;
end $$;

create trigger events_calendar before insert or update of calendar_id on public.events
  for each row execute function public.events_from_calendar();

-- ─────────────────────────────────────────────────────────────
-- calendar_items
-- ─────────────────────────────────────────────────────────────
create index if not exists content_milestones_due on public.content_milestones (due_at);
create index if not exists content_publications_at on public.content_publications (publish_at);
create index if not exists tasks_due on public.tasks (due_at) where due_at is not null;

create or replace function public.calendar_items(p_from timestamptz, p_to timestamptz)
returns table (
  source_type text,       -- 'event' | 'task' | 'milestone' | 'publication'
  source_id uuid,
  workspace_id uuid,
  calendar_id uuid,
  client_id uuid,
  content_id uuid,
  title text,
  category text,          -- recording | editing | publication | meeting | task | approval | other
  status text,
  all_day boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  url text,
  description text,
  platform text
)
language sql stable security invoker set search_path = public as $$
  -- Wydarzenia
  select 'event', e.id, e.workspace_id, e.calendar_id, e.client_id, null::uuid,
         e.title, e.category::text, e.status::text, e.all_day, e.starts_at, e.ends_at,
         e.location, e.url, e.description, null
  from public.events e
  where e.starts_at < p_to and e.ends_at > p_from

  union all
  -- Terminy zadań (zawsze na warstwie „Zadania” swojego workspace'u)
  select 'task', t.id, t.workspace_id, tc.id, t.client_id, t.content_id,
         t.title, 'task', t.status::text, t.due_all_day, t.due_at, t.due_at,
         null, null, t.description, null
  from public.tasks t
  join public.calendars tc on tc.workspace_id = t.workspace_id and tc.kind = 'tasks'
  where t.parent_id is null and t.due_at >= p_from and t.due_at < p_to

  union all
  -- Terminy produkcji materiału (na warstwie klienta; bez klienta — na „Zadaniach”)
  select 'milestone', m.id, m.workspace_id, coalesce(cc.id, tc.id), c.client_id, c.id,
         c.title, case m.kind when 'approval' then 'approval' else m.kind::text end,
         case when m.done_at is null then 'planned' else 'done' end,
         m.all_day, m.due_at, m.due_at, null, null, null, null
  from public.content_milestones m
  join public.content c on c.id = m.content_id
  join public.calendars tc on tc.workspace_id = m.workspace_id and tc.kind = 'tasks'
  left join public.calendars cc on cc.client_id = c.client_id
  where m.due_at >= p_from and m.due_at < p_to

  union all
  -- Publikacje
  select 'publication', p.id, p.workspace_id, coalesce(cc.id, tc.id), c.client_id, c.id,
         c.title, 'publication', p.status::text, false, p.publish_at, p.publish_at,
         null, null, p.caption, p.platform::text
  from public.content_publications p
  join public.content c on c.id = p.content_id
  join public.calendars tc on tc.workspace_id = p.workspace_id and tc.kind = 'tasks'
  left join public.calendars cc on cc.client_id = c.client_id
  where p.publish_at >= p_from and p.publish_at < p_to
$$;

grant execute on function public.calendar_items(timestamptz, timestamptz) to authenticated;
