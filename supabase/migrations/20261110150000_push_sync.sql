-- Etap 6: powiadomienia push, przypomnienia z serwera, import/eksport Google Calendar

-- ─────────────────────────────────────────────────────────────
-- Subskrypcje Web Push (jedna na przeglądarkę / telefon)
-- ─────────────────────────────────────────────────────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "własne subskrypcje" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Przypomnienia o wydarzeniach również na Slacka (ustawienie workspace'u)
-- ─────────────────────────────────────────────────────────────
alter table public.workspace_secrets add column slack_reminders boolean not null default false;

create or replace function public.set_slack_reminders(ws uuid, enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(ws) then
    raise exception 'Tylko właściciel workspace''u może zmieniać integracje' using errcode = '42501';
  end if;
  update public.workspace_secrets set slack_reminders = enabled, updated_at = now() where workspace_id = ws;
end $$;
grant execute on function public.set_slack_reminders(uuid, boolean) to authenticated;

drop function public.integration_status(uuid);
create function public.integration_status(ws uuid)
returns table (slack_connected boolean, slack_channel text, slack_reminders boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(s.slack_webhook_url is not null, false), s.slack_channel, coalesce(s.slack_reminders, false)
  from (select 1) one
  left join public.workspace_secrets s on s.workspace_id = ws
  where public.is_member(ws)
$$;
grant execute on function public.integration_status(uuid) to authenticated;

-- Jedno powiadomienie na Slacku na wydarzenie (choć przypomnień osobistych może być kilka).
alter table public.events add column slack_notified_at timestamptz;

create or replace function public.events_reset_slack_notice()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.slack_notified_at := null;
  end if;
  return new;
end $$;
create trigger events_slack_notice before update of starts_at on public.events
  for each row execute function public.events_reset_slack_notice();

-- ─────────────────────────────────────────────────────────────
-- Google Calendar: import bez duplikatów i pamięć eksportu
-- ─────────────────────────────────────────────────────────────
-- Upsert z PostgREST potrzebuje pełnego (nie częściowego) indeksu unikalnego.
drop index if exists public.events_external_unique;
alter table public.events add constraint events_calendar_external_unique unique (calendar_id, external_id);

alter table public.calendars add column google_account_email text;
alter table public.calendars add column last_imported_at timestamptz;

-- Które wydarzenie ContentFlow zostało wysłane do którego kalendarza Google (ponowny eksport = aktualizacja).
create table public.event_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  exported_at timestamptz not null default now(),
  unique (event_id, google_calendar_id)
);
alter table public.event_exports enable row level security;
create policy "członkowie workspace'u" on public.event_exports
  for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

create or replace function public.event_exports_workspace()
returns trigger language plpgsql as $$
begin
  select workspace_id into new.workspace_id from public.events where id = new.event_id;
  return new;
end $$;
create trigger event_exports_ws before insert on public.event_exports
  for each row execute function public.event_exports_workspace();

-- Synchronizacja na żywo: checklisty też (pozostałe tabele są w publikacji od początku).
alter publication supabase_realtime add table public.checklist_items;

-- Import z Trello (i innych źródeł): identyfikator zewnętrzny zadania, ponowny import aktualizuje zamiast dublować.
alter table public.tasks add column external_id text;
alter table public.tasks add constraint tasks_workspace_external_unique unique (workspace_id, external_id);
