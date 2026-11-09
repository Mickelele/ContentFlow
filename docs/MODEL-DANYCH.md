# Model danych

> Ostatnia aktualizacja: 2026-11-09 · Migracje: `supabase/migrations/`

Wszystkie tabele są w schemacie `public`, mają włączony RLS i (poza `profiles` i `calendar_visibility`) kolumnę `workspace_id`.
Tabele edytowane przez użytkownika mają `updated_at` i `version` (trigger `touch_row`), potrzebne do wykrywania konfliktów przy synchronizacji.

## Tabele

| Tabela | Opis | Najważniejsze kolumny |
|---|---|---|
| `profiles` | Profil użytkownika (1:1 z `auth.users`) | `email`, `full_name`, `avatar_url`, `timezone`, `last_workspace_id` |
| `workspaces` | Firma / przestrzeń pracy | `name`, `slug` (unikalny), `color`, `plan`, `created_by` |
| `workspace_members` | Członkostwo | `workspace_id`, `user_id`, `role` (`owner`/`member`) |
| `clients` | Klient | `name`, `color`, `contact_person`, `email`, `phone`, `website`, `socials` (jsonb), `notes`, `monthly_package`, `archived_at` |
| `calendars` | Warstwa kalendarza | `kind` (`client`/`tasks`/`custom`/`google`), `name`, `color`, `client_id`, `google_calendar_id`, `position` |
| `calendar_visibility` | Czy warstwa jest widoczna (per użytkownik) | `user_id`, `calendar_id`, `visible` |
| `projects` | Projekt klienta | `client_id`, `name`, `status`, `starts_on`, `ends_on` |
| `content` | Materiał | `client_id`, `project_id`, `title`, `type`, `stage` |
| `content_milestones` | Termin produkcyjny materiału | `content_id`, `kind` (`recording`/`editing`/`approval`), `due_at`, `done_at` |
| `content_publications` | Publikacja na platformie | `content_id`, `platform`, `publish_at`, `caption`, `hashtags`, `status` |
| `scripts` | Scenariusz (1:1 z materiałem) | `content_id`, `body` (jsonb, dokument edytora) |
| `shots` | Ujęcie do nagrania | `content_id`, `description`, `done`, `position` |
| `events` | Wydarzenie | `calendar_id`, `client_id`, `project_id`, `title`, `category`, `status`, `all_day`, `starts_at`, `ends_at`, `location`, `url`, `rrule`, `external_id` |
| `event_content` | Wydarzenie ↔ materiały (n:m) | `event_id`, `content_id` |
| `tasks` | Zadanie | `parent_id`, `client_id`, `project_id`, `content_id`, `title`, `status`, `priority`, `due_at`, `due_all_day`, `completed_at`, `position` |
| `checklist_items` | Pozycja checklisty zadania | `task_id`, `label`, `done`, `position` |
| `attachments` | Załącznik (link do Dysku) | `entity_type`, `entity_id`, `drive_file_id`, `name`, `mime_type`, `url` |
| `reminders` | Przypomnienie | `user_id`, jedno z: `event_id` / `task_id` / `publication_id`, `remind_at`, `sent_at` |
| `integrations` | Podłączone konto zewnętrzne | `provider`, `account_email`, `scopes`, `status`, `vault_secret_id` |

## Relacje

```
auth.users 1─1 profiles
auth.users n─m workspaces            (workspace_members)
workspaces 1─n clients, calendars, projects, content, events, tasks, …
clients    1─1 calendars             (warstwa klienta, kind = 'client')
clients    1─n projects, content, events, tasks
content    1─n content_milestones, content_publications, shots
content    1─1 scripts
events     n─m content               (event_content)
tasks      1─n tasks                 (podzadania, parent_id)
tasks      1─n checklist_items
```

## Automatyka w bazie

| Trigger / funkcja | Kiedy | Co robi |
|---|---|---|
| `handle_new_user` | rejestracja | tworzy `profiles` i pierwszy workspace (nazwa = imię i nazwisko) |
| `workspaces_before_insert` | nowy workspace | nadaje unikalny `slug` (polskie znaki → ASCII, np. `michal-czycza`, `michal-czycza-2`) |
| `workspaces_after_insert` | nowy workspace | twórca jako `owner`, warstwa „Zadania”, ustawia `last_workspace_id`, jeśli był pusty |
| `clients_sync_calendar` | nowy / zmieniony klient | tworzy warstwę klienta i synchronizuje jej nazwę i kolor |
| `touch_row` | aktualizacja | `updated_at = now()`, `version + 1` |

## Zasady biznesowe zapisane w schemacie

- Termin zadania (`due_at`) to znacznik, nie rezerwacja czasu (`due_all_day` domyślnie `true`).
- Jeden materiał ma wiele terminów produkcyjnych (jeden na rodzaj) i wiele publikacji (na różnych platformach, w różnych terminach).
- Wydarzenia z zewnątrz mają `external_id`, unikalny w obrębie warstwy, co chroni przed duplikatami przy imporcie.
- Archiwizacja klienta (`archived_at`) zachowuje jego projekty i historię.

## Planowane zmiany

| Etap | Zmiana |
|---|---|
| 2 | Funkcja `calendar_items(od, do, …)` |
| 3 | `tasks.planned_on date`, czyli „zrobię dziś”, osobno od terminu; tabela `notifications` |
| 4 | Tabele `notes` i `ideas` (tagi, klient, powiązanie z wydarzeniem) |
| 6 | `calendars.google_account_email`, `calendars.last_imported_at`; tabela powiązań eksportu (`event_id` ↔ `google_event_id`) |
