# Architektura

> Ostatnia aktualizacja: 2026-11-09 (Pomocnik AI)

## Stos

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Aplikacja | Next.js 16 (App Router, Turbopack), React 19, TypeScript | `cacheComponents` włączone |
| Style | Tailwind CSS 4, tokeny w `src/app/globals.css` | bez biblioteki komponentów |
| Ikony | lucide-react | |
| Kalendarz | FullCalendar 6.1.22 (daygrid, timegrid, interaction) | wersje przypięte, zob. D-11 |
| Przeciąganie list | dnd-kit (core, sortable) | kolejność planu dnia; mysz, dotyk, klawiatura |
| Powiadomienia push | web-push 3.6.7 (VAPID) | wysyłka z `/api/cron/reminders`, zob. D-25 |
| Edytor tekstu | Tiptap 3.31.4 (StarterKit, task list) | scenariusze i notatki, zob. D-17 |
| Klasy CSS | tailwind-merge | `cx()` w `components/ui.tsx`: przy konflikcie wygrywa późniejsza klasa |
| Walidacja | zod 4 | w server actions |
| Backend | Supabase: Postgres, Auth, RLS, Realtime | klient `@supabase/ssr` |
| Pliki | Google Drive (tylko linki i identyfikatory) | brak własnego storage |
| AI | `@anthropic-ai/sdk` 1.3.0, model `claude-haiku-5-5` | Pomocnik, zob. D-31 |

## Struktura katalogów

```
src/
  proxy.ts                  odświeżanie sesji, przekierowanie niezalogowanych (dawne „middleware”)
  app/
    layout.tsx              <html lang="pl">, motyw przed pierwszym malowaniem
    page.tsx                przekierowanie do ostatniego workspace'u
    logowanie/              ekran logowania + server actions (Google, e-mail)
    auth/callback/          powrót z Google OAuth i z linku e-mail
    nowy-workspace/         tworzenie workspace'u
    w/[slug]/               aplikacja w obrębie workspace'u
      layout.tsx            powłoka (AppShell)
      page.tsx              zapamiętuje workspace jako ostatni → /dzis
      kalendarz/
        page.tsx            serwer: warstwy wszystkich workspace'ów + widoczność
        calendar-loader.tsx ładuje kalendarz tylko w przeglądarce
        calendar-app.tsx    FullCalendar, pobieranie zakresu, przeciąganie, zapis
        layers-panel.tsx    warstwy z checkboxami, nowa warstwa, filtry kategorii
        event-editor.tsx    edytor wydarzenia, linki do spotkań, kopiowanie
        item-details.tsx    podgląd terminu zadania / materiału
        calendar.css        wygląd FullCalendar w tokenach
      dzis/
        page.tsx            serwer: workspace'y, klienci, imię
        day-app.tsx         plan dnia, „z poprzednich dni”, kolumna dnia (tylko przeglądarka)
      zadania/
        page.tsx            serwer: workspace'y i klienci
        tasks-app.tsx       lista zadań w grupach, filtr, szybkie dodawanie (tylko przeglądarka)
      content/
        page.tsx            serwer: materiały z najbliższym terminem
        content-list.tsx    filtry etapu i klienta, nowy materiał
        [id]/material-editor.tsx  etapy, scenariusz, ujęcia, terminy, publikacje, linki (tylko przeglądarka)
      projekty/
        page.tsx, projects-list.tsx   lista według klientów, okno projektu
        [id]/page.tsx       materiały, zadania i wydarzenia projektu (serwer)
      pomysly/
        notes-app.tsx       widoki „Notatki” i „Pomysły” (tylko przeglądarka)
        notes-view.tsx      lista + edytor notatki z zapisem automatycznym
        ideas-view.tsx      bank pomysłów, „Zrób materiał”
      ustawienia/
        settings-view.tsx   workspace, Slack, stan Dysku i ChatGPT, konto
        actions.ts          zapis workspace'u i webhooka, test Slacka (server actions)
      klienci/
  components/
    editor/                 RichText (Tiptap), useAutosave + wskaźnik zapisu
    link-chip.tsx           ikona i wiersz linku z rozpoznanym serwisem
    chatgpt-menu.tsx        menu gotowych poleceń ChatGPT
    google-buttons.tsx      „Z Dysku” i „Do Google Docs”
    shell/                  AppShell, nawigacja, przełącznik workspace'ów, motyw
      notifications.tsx     dostawca powiadomień, dzwonek, dymki
    tasks/                  wiersz zadania, okno szczegółów z checklistą, szybkie dodawanie, tablica Kanban (task-board.tsx)
    ui.tsx                  Button, Field, Input, PageHeader, cx()…
    dialog.tsx              okno: wyśrodkowane na komputerze, arkusz na telefonie
    page-skeleton.tsx       szkielet ładowania modułów
  lib/
    env.ts                  zmienne środowiskowe (publiczne)
    palette.ts              12 kolorów klientów
    calendar.ts             typy kalendarza, kategorie, wykrywanie linków spotkań, daty
    tasks.ts                typy zadań, priorytety, daty „dziś / jutro”, sortowanie
    refs.ts                 workspace'y, aktywni klienci i projekty użytkownika (server-only)
    content.ts              rodzaje materiałów, etapy, platformy, szablon rolki
    projects.ts             statusy i typy projektów
    links.ts                rozpoznawanie serwisu po adresie, normalizacja linków
    prompts.ts              polecenia ChatGPT dla materiału i pomysłu
    google.ts / google-drive.ts  konfiguracja Google; token GIS, Picker, tworzenie Docs (przeglądarka)
    slack.ts                wysyłka na Slacka, odczyt webhooka (server-only)
    supabase/admin.ts       klient z kluczem serwisowym (server-only)
    workspace.ts            sesja, lista workspace'ów, bieżący workspace (server-only)
    supabase/               klient przeglądarkowy, serwerowy i do proxy
supabase/migrations/        schemat bazy (SQL)
docs/                       dokumentacja projektu
```

## Uwierzytelnianie

1. Użytkownik loguje się przez Google (`signInWithOAuth`) lub e-mailem i hasłem.
2. Google wraca na `https://<projekt>.supabase.co/auth/v1/callback`, Supabase przekierowuje na `/auth/callback?code=…`.
3. `/auth/callback` wymienia kod na sesję (`exchangeCodeForSession`) i zapisuje ją w ciasteczkach.
4. Trigger `on_auth_user_created` tworzy profil i pierwszy workspace.
5. `src/proxy.ts` przy każdym żądaniu odświeża token (`getClaims`) i odsyła niezalogowanych na `/logowanie`.
6. Strony serwerowe biorą użytkownika z `getAuth()` w `lib/workspace.ts`: też `getClaims` (podpis JWT sprawdzany lokalnie kluczami JWKS), bez zapytania do Supabase Auth. Profil (`getSession`) i lista workspace'ów (`getWorkspaces`) pobierają się równolegle; wszystkie trzy mają `cache()` na czas żądania (zob. D-32).

Logowanie Google prosi tylko o `openid email profile`. Dostęp do kalendarza czy Dysku będzie wymagał osobnej, jednorazowej zgody w chwili użycia (zob. [DECYZJE.md](DECYZJE.md)).

## Workspace'y i dostęp

- Użytkownik należy do wielu workspace'ów (`workspace_members`). Jeden workspace = jedna firma.
- Każda tabela z danymi ma `workspace_id`. Polityki RLS sprawdzają członkostwo funkcją `is_member(workspace_id)` (SECURITY DEFINER, żeby uniknąć rekurencji polityk).
- Adresy mają postać `/w/<slug>/<moduł>`. `getWorkspace(slug)` zwraca 404, jeśli użytkownik nie jest członkiem.
- Moduły (klienci, content, zadania…) działają w obrębie jednego workspace'u. Kalendarz i „Dziś” będą pokazywać wszystkie workspace'y naraz.

## Next.js 16: rzeczy, o których trzeba pamiętać

- **Proxy zamiast middleware:** plik `src/proxy.ts`, eksport `proxy`.
- **Cache Components:** wszystko, co czyta ciasteczka, czas albo bazę, musi być poza prerenderingiem.
  - `getSession()` zaczyna od `await connection()`, więc każdy ekran po zalogowaniu renderuje się na żądanie.
  - Trasy zależne od sesji mają `export const instant = false`.
  - Każdy moduł ma `loading.tsx` (szkielet), dzięki czemu przejście między modułami jest natychmiastowe.
- **Typy tras:** `PageProps<"/w/[slug]/…">` i `LayoutProps` są generowane (`npx next typegen` lub przy `next build`).
- Przed użyciem nowego API sprawdź `node_modules/next/dist/docs/`.

## System wizualny

- Interfejs jest neutralny (ciepła szarość), akcent to „atrament”. **Znaczenie niesie kolor klienta.**
- 12 kolorów klientów, każdy w trzech odcieniach: `solid` (kropka, checkbox), `fill` (tło wpisu), `ink` (tekst na tle). Osobne wartości dla motywu jasnego i ciemnego (`--c-<kolor>-*`).
- Kategoria wydarzenia to **ikona**, nie kolor, bo kolor należy do klienta.
- Motyw: `localStorage['cf-theme']` = `light` | `dark` | `system`, ustawiany skryptem przed pierwszym malowaniem.
- Telefon: dolny pasek Dziś · Kalendarz · + · Content · Więcej; pola formularzy mają 16px (bez powiększania na iOS).

## Kalendarz

```
page.tsx (serwer) ── warstwy + widoczność ──▶ CalendarApp (tylko przeglądarka)
                                                │
         datesSet (zmiana zakresu) ── rpc calendar_items(od, do) ──▶ elementy
         filtr: widoczna warstwa ∧ włączona kategoria ──▶ FullCalendar
         przeciągnięcie ── update tabeli źródłowej (events / tasks / content_*) ── błąd ⇒ revert()
```

- Zapisy idą prosto z przeglądarki przez `supabase-js`; dostęp pilnuje RLS (D-12).
- Wydarzenie zapisuje tylko `calendar_id`; `workspace_id` i `client_id` ustawia trigger (D-13).
- Czas: `timestamptz` w bazie, wyświetlanie w strefie przeglądarki. Wydarzenia całodniowe: północ do północy dnia po ostatnim dniu (koniec wyłączny).
- W `localStorage` zapamiętywane są tylko wygoda: ostatni widok (`cf-cal-view`) i włączone kategorie (`cf-cal-categories`). Widoczność warstw jest w bazie.
- „+ → Wydarzenie” z dolnego paska: na innym ekranie `kalendarz?nowe=1`, na otwartym kalendarzu zdarzenie okna `cf:new-event`.

## Plan dnia, zadania, powiadomienia

- „Dziś”, Zadania i Kalendarz renderują się tylko w przeglądarce (`next/dynamic`, `ssr: false`), bo „dziś” zależy od strefy czasowej urządzenia. Serwer dostarcza tylko listy workspace'ów i klientów (`lib/refs.ts`).
- Zmiany zadań są optymistyczne: interfejs zmienia się od razu, a przy błędzie wraca do poprzedniego stanu z komunikatem.
- Plan dnia = zadania z `planned_on = dziś`, w kolejności `position`. „Z poprzednich dni” = `planned_on < dziś` i niezrobione.
- Termin całodniowy zapisujemy jako lokalną północ (`due_all_day = true`).
- `?zadanie=<id>` w adresie modułu Zadania otwiera to zadanie (linki z kalendarza i powiadomień).
- Powiadomienia: `NotificationsProvider` w powłoce odpytuje `notifications_feed()` co 60 s i po powrocie do karty. Dzwonek jest w dwóch miejscach (panel boczny, górny pasek telefonu) i korzysta z jednego stanu. Nowe przypomnienie pokazuje dymek (tylko gdy aplikacja jest otwarta).

## Content i notatki

- Edytor (`components/editor/rich-text.tsx`) zwraca dokument JSON i czysty tekst. Pasek formatowania renderuje się dopiero przy gotowej instancji edytora (`immediatelyRender: false`).
- `useAutosave` zapisuje 0,8 s po ostatniej zmianie i wysyła niezapisane zmiany przy zamknięciu karty. Notatka łączy zmiany kilku pól w jeden zapis.
- Terminy produkcji: jeden na rodzaj (`unique (content_id, kind)`), zapis przez `upsert`. Termin całodniowy = lokalna północ.
- Zapisy pól materiału, ujęć, publikacji i linków idą od razu przez `supabase-js`; `workspace_id` danych materiału ustawia trigger.
- Stałe i typy używane w komponentach serwerowych trzymamy w `lib/` (nie w plikach `"use client"`), bo eksporty z modułów klienckich są dla serwera tylko referencjami.

## Integracje

- **Slack:** przeglądarka nie zna webhooka. Server action sprawdza członkostwo (`getWorkspace`), czyta webhook kluczem serwisowym i wysyła wiadomość. Daty planu dnia formatuje przeglądarka (jej strefa), serwer składa bloki Slacka.
- **Google:** skrypty `accounts.google.com/gsi/client` i `apis.google.com/js/api.js` ładowane na żądanie. Token z zakresem `drive.file` trzymany w pamięci do wygaśnięcia. Bez kompletu `NEXT_PUBLIC_GOOGLE_*` przyciski się nie renderują.
- **ChatGPT:** czysty link `chatgpt.com/?q=` — bez kluczy i bez serwera.

## PWA, push i synchronizacja (Etap 6)

- `app/manifest.ts` + `app/pwa-icon/[size]` (ikony generowane `ImageResponse`) + `public/sw.js` (instalacja, push, kliknięcie powiadomienia). Service worker rejestruje `AppShell`. Proxy przepuszcza `sw.js`, `manifest.webmanifest`, `pwa-icon/` i `api/cron/` bez sesji.
- Subskrypcja push: Ustawienia → „To urządzenie” (`device-card.tsx`) → server action zapisuje `push_subscriptions`. `lib/push.ts` wysyła i usuwa martwe subskrypcje (404/410).
- `/api/cron/reminders` (Bearer `CRON_SECRET`, klucz serwisowy): przypomnienia z ostatnich 2 godzin → push do osoby + Slack raz na wydarzenie.
- `lib/use-realtime.ts`: kanał Supabase Realtime na tabele widoku → odświeżenie z opóźnieniem; używają go kalendarz, „Dziś” i zadania.
- Google Calendar: `lib/google-auth.ts` (wspólny token GIS dla Dysku i Kalendarza, wybór konta przy kalendarzu), `lib/google-calendar.ts` (lista, wydarzenia, wstawianie, aktualizacja), `kalendarz/google-dialog.tsx`.
- Tablica zadań: `components/tasks/task-board.tsx` — dnd-kit z wieloma kontenerami (kolumna = status), podgląd przeniesienia w `onDragOver`, zapis statusu i `board_position` w `onDragEnd`; widok zapamiętany w `localStorage` (`cf-tasks-view`).
- Trello: `zadania/trello-import.tsx` czyta plik JSON w przeglądarce i robi `upsert` po `(workspace_id, external_id)`.

## Tablica materiałów, wersje, akceptacja, podsumowanie (Etap 7)

- `content/content-board.tsx`: ten sam wzorzec dnd-kit co tablica zadań; kolumna = etap, `content.board_position`. Widok zapamiętany przez `useSyncExternalStore` (serwer renderuje tablicę, przeglądarka może przełączyć na listę).
- `content/[id]/script-versions.tsx`: migawki dokumentu edytora; przywrócenie = `setContent` + automatyczny zapis.
- `content/[id]/approval-section.tsx` → `approval_requests`; publiczna strona `app/akceptacja/[token]` (proxy przepuszcza `/akceptacja`), HTML scenariusza z `lib/doc-html.ts` (własny bezpieczny renderer JSON → HTML), odpowiedź w `akceptacja/[token]/actions.ts` (klucz serwisowy, push do autora prośby).
- `podsumowanie/stats-app.tsx`: zapytania z zakresu tygodnia, agregacja w przeglądarce, wykres słupkowy w HTML (jedna seria, kolor atramentu, wartość po najechaniu/fokusie, opis dla czytników).

## Pomocnik AI

- `components/shell/assistant.tsx`: pływający dymek (`fixed`, prawy dolny róg; na telefonie nad dolnym paskiem) i okno czatu: niemodalny `<dialog>` otwierany `show()`, Esc obsługiwany ręcznie; na komputerze okienko nad dymkiem, na telefonie arkusz od dołu. Dymki powiadomień są przesunięte wyżej, żeby się nie nakładały. Historia rozmowy żyje w stanie `AppShell`, wysyłane jest ostatnie 19 wiadomości. Odpowiedź czytana strumieniem (`fetch` + `ReadableStream`), przerwanie przez `AbortController`. Własny minimalny renderer Markdown (akapity, listy, pogrubienia) bez wstawiania HTML.
- `app/api/pomocnik/route.ts`: sprawdza sesję (`getClaims`), waliduje treść (zod), limit w pamięci, wywołuje `@anthropic-ai/sdk` (`messages.stream`) i przekazuje `text_delta` jako czysty tekst. Błędy API zamienia na polskie komunikaty w strumieniu.
- `lib/assistant.ts` (server-only): model, instrukcja, wczytanie `docs/PRZEWODNIK.md` i `CHANGELOG.md` z dysku (raz na instancję). Pliki dołącza do funkcji `outputFileTracingIncludes` w `next.config.ts`.

## Planowane elementy architektury

- Praca offline: kolejka zmian w IndexedDB i wskaźnik „czeka na synchronizację”.
