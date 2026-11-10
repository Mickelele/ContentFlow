# Model danych

> Ostatnia aktualizacja: 2026-11-09 · Migracje: `supabase/migrations/` (`…120000_init`, `…150000_calendar`, `…180000_day_plan`, `20261110090000_content_notes`, `20261110120000_integrations`, `20261110150000_push_sync`, `20261110180000_task_board`, `20261110200000_content_review`, `20261111090000_trello_sync`, `20261111120000_event_photos`)

Wszystkie tabele są w schemacie `public`, mają włączony RLS i (poza `profiles` i `calendar_visibility`) kolumnę `workspace_id`.
Tabele edytowane przez użytkownika mają `updated_at` i `version` (trigger `touch_row`), potrzebne do wykrywania konfliktów przy synchronizacji.

## Tabele

| Tabela | Opis | Najważniejsze kolumny |
|---|---|---|
| `profiles` | Profil użytkownika (1:1 z `auth.users`) | `email`, `full_name`, `avatar_url`, `timezone`, `last_workspace_id` |
| `workspaces` | Firma / przestrzeń pracy | `name`, `slug` (unikalny), `color`, `plan`, `created_by` |
| `workspace_members` | Członkostwo | `workspace_id`, `user_id`, `role` (`owner`/`member`) |
| `clients` | Klient | `name`, `color`, `contact_person`, `email`, `phone`, `website`, `socials` (jsonb), `notes`, `monthly_package`, `archived_at` |
| `calendars` | Warstwa kalendarza | `kind` (`client`/`tasks`/`custom`/`google`), `name`, `color`, `client_id`, `google_calendar_id` + `google_account_email` + `last_imported_at` (import z Google), `position` |
| `calendar_visibility` | Czy warstwa jest widoczna (per użytkownik) | `user_id`, `calendar_id`, `visible` |
| `projects` | Projekt klienta | `client_id`, `name`, `status`, `starts_on`, `ends_on` |
| `content` | Materiał | `client_id`, `project_id`, `title`, `type`, `stage`, `board_position` (kolejność na tablicy) |
| `content_milestones` | Termin produkcyjny materiału | `content_id`, `kind` (`recording`/`editing`/`approval`), `due_at`, `done_at` |
| `content_publications` | Publikacja na platformie | `content_id`, `platform`, `publish_at`, `caption`, `hashtags`, `status` |
| `scripts` | Scenariusz (1:1 z materiałem) | `content_id`, `body` (jsonb, dokument edytora) |
| `script_versions` | Wersja scenariusza | `content_id`, `label`, `body` (jsonb), `body_text`, `created_at` |
| `approval_requests` | Prośba o akceptację klienta | `content_id`, `script_version_id` (migawka), `token` (unikalny), `status` (`pending`/`approved`/`changes_requested`/`cancelled`), `message`, `client_name`, `client_comment`, `responded_at`, `expires_at` |
| `shots` | Ujęcie do nagrania | `content_id`, `description`, `done`, `position` |
| `events` | Wydarzenie | `calendar_id`, `client_id`, `project_id`, `title`, `category`, `status`, `all_day`, `starts_at`, `ends_at`, `location`, `url`, `rrule`, `external_id` (unikalne z `calendar_id`, np. `gcal:<kalendarz>:<id>`), `slack_notified_at` |
| `event_content` | Wydarzenie ↔ materiały (n:m) | `event_id`, `content_id` |
| `tasks` | Zadanie | `parent_id` (nieużywane, D-15), `client_id`, `project_id`, `content_id`, `title`, `status`, `priority`, `due_at`, `due_all_day`, `planned_on` (plan dnia), `completed_at`, `position` (kolejność w planie dnia), `board_position` (kolejność na tablicy Kanban), `external_id` (unikalne z `workspace_id`, np. `trello:<id>`), `trello_card_id` (karta w Trello, na którą trafia zadanie; D-33) |
| `checklist_items` | Pozycja checklisty zadania | `task_id`, `label`, `done`, `position` |
| `attachments` | Załącznik (link do Dysku) | `entity_type`, `entity_id`, `drive_file_id`, `name`, `mime_type`, `url` |
| `reminders` | Przypomnienie (per osoba) | `user_id`, jedno z: `event_id` / `task_id` / `publication_id`, `offset_minutes`, `remind_at` (liczone triggerem), `sent_at` |
| `notification_reads` | Przeczytane powiadomienia | `user_id`, `key`, `read_at` |
| `notes` | Notatka | `client_id`, `project_id`, `event_id` (notatka ze spotkania), `title`, `body` (jsonb, Tiptap), `body_text` (do wyszukiwania), `pinned` |
| `ideas` | Pomysł | `client_id`, `title`, `description`, `link`, `type`, `tags` (text[]), `status` (`new`/`converted`/`archived`), `content_id` |
| `workspace_secrets` | Sekrety integracji (bez odczytu przez API, D-20) | `workspace_id`, `slack_webhook_url`, `slack_channel`, `slack_reminders`, `trello_token`, `trello_member`, `trello_board_id`, `trello_board_name`, `trello_lists` (jsonb: `todo`, `in_progress`, `done` → id listy), `trello_sync` |
| `event_photos` | Zdjęcie wydarzenia (D-35) | `event_id` (kaskada), `path` (unikalna, `<workspace_id>/<event_id>/<plik>.webp` w koszyku Storage `event-photos`), `width`, `height`, `position`, `created_by` |
| `trello_outbox` | Kolejka zmian zadań do wysłania do Trello (tylko serwer, RLS bez polityk) | `task_id` (PK, bez FK), `workspace_id`, `op` (`upsert` / `archive`), `card_id`, `attempts`, `last_error`, `queued_at` |
| `push_subscriptions` | Urządzenie z włączonymi powiadomieniami (per osoba) | `user_id`, `endpoint` (unikalny), `p256dh`, `auth`, `user_agent` |
| `event_exports` | Wydarzenie wysłane do Google Calendar | `event_id`, `google_calendar_id`, `google_event_id` (unikalne `event_id + google_calendar_id`) |
| `integrations` | Podłączone konto zewnętrzne (nieużywane — Google bez zapisu tokenów) | `provider`, `account_email`, `scopes`, `status`, `vault_secret_id` |

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
projects   1─n content, tasks, events, notes
events     1─n notes                 (notatki ze spotkania)
ideas      n─1 content               (pomysł zamieniony w materiał)
content    1─n attachments           (entity_type = 'content')
```

## Automatyka w bazie

| Trigger / funkcja | Kiedy | Co robi |
|---|---|---|
| `handle_new_user` | rejestracja | tworzy `profiles` i pierwszy workspace (nazwa = imię i nazwisko) |
| `workspaces_before_insert` | nowy workspace | nadaje unikalny `slug` (polskie znaki → ASCII, np. `michal-czycza`, `michal-czycza-2`) |
| `workspaces_after_insert` | nowy workspace | twórca jako `owner`, warstwa „Zadania”, ustawia `last_workspace_id`, jeśli był pusty |
| `clients_sync_calendar` | nowy / zmieniony klient | tworzy warstwę klienta i synchronizuje jej nazwę i kolor |
| `touch_row` | aktualizacja | `updated_at = now()`, `version + 1` |
| `events_from_calendar` | nowe wydarzenie / zmiana warstwy | ustawia `workspace_id` i `client_id` z warstwy (D-13) |
| `tasks_completed_at` | zmiana statusu zadania | ustawia / czyści `completed_at` |
| `checklist_from_task` | nowa pozycja checklisty | ustawia `workspace_id` z zadania |
| `inherit_workspace_from_content` | nowy termin / publikacja / scenariusz / ujęcie | ustawia `workspace_id` z materiału |
| `events_reset_slack_notice` | przesunięcie wydarzenia | czyści `slack_notified_at`, żeby przypomnienie na Slacku poszło ponownie |
| `event_exports_workspace` | nowy wpis eksportu | `workspace_id` z wydarzenia |
| `project_client_check` | projekt w materiale / zadaniu / wydarzeniu | sprawdza workspace projektu; materiał i zadanie bez klienta przejmują klienta projektu (D-19) |
| `reminders_from_event` | nowe / zmienione przypomnienie | `workspace_id` z wydarzenia, `remind_at = starts_at − offset_minutes` |
| `events_move_reminders` | przesunięcie wydarzenia | przelicza przypomnienia wszystkich osób (SECURITY DEFINER) |
| `tasks_trello_queue` | nowe / zmienione (tytuł, opis, status, termin) / usunięte zadanie główne | gdy workspace ma włączone Trello (`trello_enabled`), dopisuje zadanie do `trello_outbox` (`archive` przy usunięciu) |
| `checklist_trello_queue` | zmiana checklisty | dopisuje zadanie do `trello_outbox` |
| `event_photos_from_event` | nowe zdjęcie | `workspace_id` z wydarzenia; ścieżka musi zaczynać się od `<workspace_id>/<event_id>/` |

## Funkcje do odczytu

### `calendar_items(p_from, p_to)`
Wszystko, co ma datę w podanym zakresie, ze wszystkich workspace'ów użytkownika (`security invoker`, więc filtruje RLS). Kalendarz pokazuje z tego tylko wpisy z warstw bieżącego workspace'u (D-34).

Storage: koszyk `event-photos` (prywatny, do 5 MB, obrazy); polityki na `storage.objects` sprawdzają `is_member` po pierwszym członie ścieżki.

| `source_type` | Źródło | Warstwa | Czas |
|---|---|---|---|
| `event` | `events` | `calendar_id` wydarzenia | `starts_at`–`ends_at` |
| `task` | `tasks` (bez podzadań) | „Zadania” workspace'u | `due_at` (znacznik) |
| `milestone` | `content_milestones` | warstwa klienta materiału, inaczej „Zadania” | `due_at` |
| `publication` | `content_publications` | warstwa klienta materiału, inaczej „Zadania” | `publish_at` |

Kolumny: `source_type`, `source_id`, `workspace_id`, `calendar_id`, `client_id`, `content_id`, `title`, `category`, `status`, `all_day`, `starts_at`, `ends_at`, `location`, `url`, `description`, `platform`.
Przeciągnięcie w kalendarzu aktualizuje tabelę wskazaną przez `source_type` (D-02).

### `integration_status(ws)` i `set_slack_webhook(ws, url, channel)`
`integration_status` zwraca `slack_connected`, `slack_channel`, `slack_reminders` oraz `trello_connected`, `trello_member`, `trello_board_id`, `trello_board_name`, `trello_lists`, `trello_sync` dla członków (bez adresu i tokenu). `claim_trello_outbox(ws_ids, batch)` pobiera i usuwa paczkę z kolejki (`FOR UPDATE SKIP LOCKED`), tylko dla klucza serwisowego. `set_slack_webhook` zapisuje lub czyści webhook — tylko właściciel (SECURITY DEFINER).

### `notifications_feed()`
Powiadomienia zalogowanej osoby, liczone na bieżąco (D-14). „Dziś” wg `profiles.timezone`.

| `kind` | Kiedy | Klucz |
|---|---|---|
| `reminder` | `reminders.remind_at ≤ now()`, wydarzenie nie starsze niż doba, nieanulowane | `reminder:<id>:<remind_at>` |
| `due_today` | niezrobione zadanie z terminem dziś | `due:<id>:<due_at>` |
| `overdue` | niezrobione zadanie z terminem przed dziś | `overdue:<id>:<due_at>` |
| `publication` | zaplanowana publikacja dziś | `pub:<id>:<publish_at>` |
| `approval` | akceptacja materiału z terminem dziś lub wcześniej, niezrobiona | `approval:<id>:<due_at>` |
| `client_approved` / `client_changes` | klient odpowiedział na prośbę o akceptację (ostatnie 7 dni) | `review:<id>:<status>` |

Kolumna `read` mówi, czy klucz jest w `notification_reads`.

## Zasady biznesowe zapisane w schemacie

- Termin zadania (`due_at`) to znacznik, nie rezerwacja czasu (`due_all_day` domyślnie `true`).
- Jeden materiał ma wiele terminów produkcyjnych (jeden na rodzaj) i wiele publikacji (na różnych platformach, w różnych terminach).
- Wydarzenia z zewnątrz mają `external_id`, unikalny w obrębie warstwy, co chroni przed duplikatami przy imporcie.
- Archiwizacja klienta (`archived_at`) zachowuje jego projekty i historię.

## Planowane zmiany

| Etap | Zmiana |
|---|---|
