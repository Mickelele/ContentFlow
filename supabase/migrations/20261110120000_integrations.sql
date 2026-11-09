-- Etap 5: sekrety integracji workspace'u (Slack)
-- Adres webhooka Slacka działa jak hasło: kto go zna, pisze na kanał. Dlatego:
--   • właściciel może go zapisać i usunąć,
--   • nikt nie może go odczytać przez API (brak polityki SELECT),
--   • wysyłkę robi serwer aplikacji kluczem serwisowym, po sprawdzeniu członkostwa.

create table public.workspace_secrets (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  slack_webhook_url text check (slack_webhook_url is null or slack_webhook_url ~ '^https://hooks\.slack\.com/'),
  slack_channel text,                       -- nazwa kanału do wyświetlenia (nie jest sekretem)
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.workspace_secrets enable row level security;
create policy "właściciel zapisuje sekrety" on public.workspace_secrets
  for insert with check (public.is_owner(workspace_id));
create policy "właściciel zmienia sekrety" on public.workspace_secrets
  for update using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy "właściciel usuwa sekrety" on public.workspace_secrets
  for delete using (public.is_owner(workspace_id));

-- Upsert przez PostgREST wymaga, by wiersz był „widoczny” przy konflikcie,
-- więc zapis idzie przez funkcję zamiast bezpośrednio do tabeli.
create or replace function public.set_slack_webhook(ws uuid, url text, channel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(ws) then
    raise exception 'Tylko właściciel workspace''u może zmieniać integracje' using errcode = '42501';
  end if;
  insert into public.workspace_secrets (workspace_id, slack_webhook_url, slack_channel, updated_by, updated_at)
  values (ws, url, channel, auth.uid(), now())
  on conflict (workspace_id) do update
    set slack_webhook_url = excluded.slack_webhook_url,
        slack_channel = excluded.slack_channel,
        updated_by = excluded.updated_by,
        updated_at = now();
end $$;

-- Stan integracji bez ujawniania sekretu — dla wszystkich członków.
create or replace function public.integration_status(ws uuid)
returns table (slack_connected boolean, slack_channel text)
language sql stable security definer set search_path = public as $$
  select coalesce(s.slack_webhook_url is not null, false), s.slack_channel
  from (select 1) one
  left join public.workspace_secrets s on s.workspace_id = ws
  where public.is_member(ws)
$$;

grant execute on function public.set_slack_webhook(uuid, text, text) to authenticated;
grant execute on function public.integration_status(uuid) to authenticated;
