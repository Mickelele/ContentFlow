-- Zdjęcia w wydarzeniach kalendarza (D-35).
--   • pliki: Supabase Storage, prywatny koszyk event-photos, ścieżka <workspace_id>/<event_id>/<plik>.webp,
--   • dostęp do plików i wierszy: tylko członkowie workspace'u (is_member),
--   • przeglądarka pomniejsza zdjęcie (maks. 1600 px, WebP) przed wysłaniem.

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  path text not null unique,
  width int,
  height int,
  position int not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.event_photos (event_id, position);

alter table public.event_photos enable row level security;
create policy "członkowie widzą zdjęcia" on public.event_photos for select using (public.is_member(workspace_id));
create policy "członkowie dodają zdjęcia" on public.event_photos for insert with check (public.is_member(workspace_id));
create policy "członkowie zmieniają zdjęcia" on public.event_photos for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "członkowie usuwają zdjęcia" on public.event_photos for delete using (public.is_member(workspace_id));

-- workspace_id zawsze z wydarzenia; ścieżka pliku musi zaczynać się od <workspace_id>/<event_id>/.
create or replace function public.event_photos_from_event()
returns trigger language plpgsql as $$
begin
  select e.workspace_id into new.workspace_id from public.events e where e.id = new.event_id;
  if new.workspace_id is null then
    raise exception 'Nie ma takiego wydarzenia';
  end if;
  if split_part(new.path, '/', 1) <> new.workspace_id::text or split_part(new.path, '/', 2) <> new.event_id::text then
    raise exception 'Nieprawidłowa ścieżka zdjęcia';
  end if;
  return new;
end $$;

create trigger event_photos_from_event before insert on public.event_photos
  for each row execute function public.event_photos_from_event();

alter publication supabase_realtime add table public.event_photos;

-- Koszyk na pliki: prywatny, do 5 MB, tylko obrazy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Pierwszy człon ścieżki to workspace_id — po nim sprawdzamy członkostwo.
create policy "zdjęcia wydarzeń: odczyt" on storage.objects for select to authenticated
  using (bucket_id = 'event-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "zdjęcia wydarzeń: dodawanie" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "zdjęcia wydarzeń: usuwanie" on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
