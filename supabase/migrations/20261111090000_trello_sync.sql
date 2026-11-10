-- Trello: zadania z ContentFlow automatycznie trafiają na wybraną tablicę Trello (w jedną stronę).
--   • token Trello działa jak hasło → workspace_secrets (brak polityki SELECT, czyta tylko serwer),
--   • zadanie ↔ karta: tasks.trello_card_id,
--   • każda zmiana zadania lub checklisty trafia do kolejki trello_outbox (trigger),
--     a serwer aplikacji ją opróżnia: od razu po zmianie (z przeglądarki) i co minutę (cron).

alter table public.workspace_secrets
  add column trello_token text,
  add column trello_member text,                 -- nazwa konta Trello (do wyświetlenia)
  add column trello_board_id text,
  add column trello_board_name text,
  add column trello_lists jsonb,                  -- {"todo": "<idList>", "in_progress": "<idList>", "done": "<idList>"}
  add column trello_sync boolean not null default false;

alter table public.tasks add column trello_card_id text;

-- Kolejka: jeden wiersz na zadanie (kolejne zmiany tylko odświeżają wiersz).
create table public.trello_outbox (
  task_id uuid primary key,                       -- bez klucza obcego: po usunięciu zadania trzeba jeszcze zarchiwizować kartę
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  op text not null check (op in ('upsert', 'archive')),
  card_id text,
  attempts int not null default 0,
  last_error text,
  queued_at timestamptz not null default now()
);
create index on public.trello_outbox (queued_at);

-- Tylko serwer (klucz serwisowy) czyta i zapisuje kolejkę.
alter table public.trello_outbox enable row level security;

create or replace function public.trello_enabled(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_secrets s
    where s.workspace_id = ws and s.trello_sync and s.trello_token is not null and s.trello_board_id is not null
  )
$$;

create or replace function public.trello_enqueue(ws uuid, task uuid, operation text, card text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.trello_enabled(ws) then
    return;
  end if;
  insert into public.trello_outbox (task_id, workspace_id, op, card_id)
  values (task, ws, operation, card)
  on conflict (task_id) do update
    set op = excluded.op,
        card_id = coalesce(excluded.card_id, public.trello_outbox.card_id),
        attempts = 0,
        last_error = null,
        queued_at = now();
end $$;

-- Zadania: tylko główne (podzadania nie mają kart). Zmiana trello_card_id przez serwer nie wywołuje triggera.
create or replace function public.tasks_trello_queue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.parent_id is null and old.trello_card_id is not null then
      perform public.trello_enqueue(old.workspace_id, old.id, 'archive', old.trello_card_id);
    end if;
    return old;
  end if;
  if new.parent_id is null then
    perform public.trello_enqueue(new.workspace_id, new.id, 'upsert', new.trello_card_id);
  end if;
  return new;
end $$;

create trigger tasks_trello_insert after insert on public.tasks
  for each row execute function public.tasks_trello_queue();
create trigger tasks_trello_update after update of title, description, status, due_at, due_all_day on public.tasks
  for each row execute function public.tasks_trello_queue();
create trigger tasks_trello_delete after delete on public.tasks
  for each row execute function public.tasks_trello_queue();

create or replace function public.checklist_trello_queue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = coalesce(new.task_id, old.task_id);
  if found and t.parent_id is null then
    perform public.trello_enqueue(t.workspace_id, t.id, 'upsert', t.trello_card_id);
  end if;
  return coalesce(new, old);
end $$;

create trigger checklist_trello_queue after insert or update or delete on public.checklist_items
  for each row execute function public.checklist_trello_queue();

-- Pobranie paczki z kolejki: wiersze są usuwane w chwili pobrania (SKIP LOCKED),
-- więc dwa równoległe opróżniania nie wyślą tego samego dwa razy. Nieudane serwer odkłada z powrotem.
create or replace function public.claim_trello_outbox(ws_ids uuid[], batch int)
returns setof public.trello_outbox language sql security definer set search_path = public as $$
  delete from public.trello_outbox o
  where o.task_id in (
    select task_id from public.trello_outbox
    where ws_ids is null or workspace_id = any (ws_ids)
    order by queued_at
    limit batch
    for update skip locked
  )
  returning o.*
$$;
revoke execute on function public.claim_trello_outbox(uuid[], int) from public, anon, authenticated;
revoke execute on function public.trello_enqueue(uuid, uuid, text, text) from public, anon, authenticated;

-- Stan integracji (bez sekretów) dla wszystkich członków workspace'u.
drop function public.integration_status(uuid);
create function public.integration_status(ws uuid)
returns table (
  slack_connected boolean, slack_channel text, slack_reminders boolean,
  trello_connected boolean, trello_member text, trello_board_id text, trello_board_name text, trello_lists jsonb, trello_sync boolean
)
language sql stable security definer set search_path = public as $$
  select coalesce(s.slack_webhook_url is not null, false), s.slack_channel, coalesce(s.slack_reminders, false),
         coalesce(s.trello_token is not null, false), s.trello_member, s.trello_board_id, s.trello_board_name, s.trello_lists,
         coalesce(s.trello_sync, false)
  from (select 1) one
  left join public.workspace_secrets s on s.workspace_id = ws
  where public.is_member(ws)
$$;
grant execute on function public.integration_status(uuid) to authenticated;
