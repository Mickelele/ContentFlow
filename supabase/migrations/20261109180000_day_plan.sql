-- Etap 3: plan dnia, przypomnienia, powiadomienia w aplikacji

-- ─────────────────────────────────────────────────────────────
-- Plan dnia: „zrobię to dziś” osobno od terminu oddania (D-09)
-- ─────────────────────────────────────────────────────────────
alter table public.tasks add column planned_on date;
create index tasks_planned on public.tasks (planned_on) where planned_on is not null;

-- Ukończenie zadania zapisuje datę ukończenia (i ją czyści przy cofnięciu).
create or replace function public.tasks_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger tasks_completed before insert or update of status on public.tasks
  for each row execute function public.tasks_completed_at();

-- Checklista dziedziczy workspace po zadaniu, więc klient nie musi go podawać.
create or replace function public.checklist_from_task()
returns trigger language plpgsql as $$
begin
  select t.workspace_id into new.workspace_id from public.tasks t where t.id = new.task_id;
  if new.workspace_id is null then
    raise exception 'Zadanie nie istnieje lub nie masz do niego dostępu' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger checklist_workspace before insert on public.checklist_items
  for each row execute function public.checklist_from_task();

-- ─────────────────────────────────────────────────────────────
-- Przypomnienia o wydarzeniach: przesunięcie wydarzenia przesuwa przypomnienie
-- ─────────────────────────────────────────────────────────────
alter table public.reminders add column offset_minutes int check (offset_minutes >= 0);

create or replace function public.reminders_from_event()
returns trigger language plpgsql as $$
begin
  if new.event_id is not null then
    select e.workspace_id,
           case when new.offset_minutes is not null then e.starts_at - make_interval(mins => new.offset_minutes) else new.remind_at end
      into new.workspace_id, new.remind_at
    from public.events e where e.id = new.event_id;
  end if;
  return new;
end $$;

create trigger reminders_event before insert or update on public.reminders
  for each row execute function public.reminders_from_event();

-- SECURITY DEFINER: przesunięcie wydarzenia przez jedną osobę aktualizuje przypomnienia wszystkich.
create or replace function public.events_move_reminders()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.reminders
     set remind_at = new.starts_at - make_interval(mins => offset_minutes), sent_at = null
   where event_id = new.id and offset_minutes is not null;
  return new;
end $$;

create trigger events_reminders after update of starts_at on public.events
  for each row when (old.starts_at is distinct from new.starts_at)
  execute function public.events_move_reminders();

-- ─────────────────────────────────────────────────────────────
-- Powiadomienia w aplikacji
-- Lista jest wyliczana na bieżąco z danych (bez kolejki i crona);
-- tabela przechowuje tylko, co użytkownik już przeczytał.
-- ─────────────────────────────────────────────────────────────
create table public.notification_reads (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.notification_reads enable row level security;
create policy "własne przeczytane" on public.notification_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notifications_feed()
returns table (
  key text,
  kind text,            -- reminder | due_today | overdue | publication | approval
  workspace_id uuid,
  source_type text,     -- event | task | publication | milestone
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
    -- Przypomnienia o wydarzeniach, które już „zadzwoniły” (wydarzenie jeszcze trwa lub było w ostatniej dobie)
    select 'reminder:' || r.id || ':' || extract(epoch from r.remind_at)::bigint, 'reminder', e.workspace_id,
           'event', e.id, e.title, e.starts_at
    from public.reminders r
    join public.events e on e.id = r.event_id
    where r.user_id = auth.uid() and r.remind_at <= now() and e.ends_at > now() - interval '1 day'
      and e.status <> 'cancelled'

    union all
    -- Zadania z terminem na dziś
    select 'due:' || t.id || ':' || extract(epoch from t.due_at)::bigint, 'due_today', t.workspace_id,
           'task', t.id, t.title, t.due_at
    from public.tasks t, day
    where t.parent_id is null and t.status <> 'done' and t.due_at >= day.start_at and t.due_at < day.end_at

    union all
    -- Zaległe zadania
    select 'overdue:' || t.id || ':' || extract(epoch from t.due_at)::bigint, 'overdue', t.workspace_id,
           'task', t.id, t.title, t.due_at
    from public.tasks t, day
    where t.parent_id is null and t.status <> 'done' and t.due_at < day.start_at

    union all
    -- Publikacje zaplanowane na dziś
    select 'pub:' || p.id || ':' || extract(epoch from p.publish_at)::bigint, 'publication', p.workspace_id,
           'publication', p.id, c.title, p.publish_at
    from public.content_publications p join public.content c on c.id = p.content_id, day
    where p.status = 'planned' and p.publish_at >= day.start_at and p.publish_at < day.end_at

    union all
    -- Materiały czekające na akceptację (termin dziś lub wcześniej)
    select 'approval:' || m.id || ':' || extract(epoch from m.due_at)::bigint, 'approval', m.workspace_id,
           'milestone', m.id, c.title, m.due_at
    from public.content_milestones m join public.content c on c.id = m.content_id, day
    where m.kind = 'approval' and m.done_at is null and m.due_at < day.end_at
  )
  select i.key, i.kind, i.workspace_id, i.source_type, i.source_id, i.title, i.at,
         exists (select 1 from public.notification_reads nr where nr.user_id = auth.uid() and nr.key = i.key)
  from items i
  order by i.at desc
  limit 100
$$;

grant execute on function public.notifications_feed() to authenticated;
