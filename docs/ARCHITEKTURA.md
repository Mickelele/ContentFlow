# Architektura

> Ostatnia aktualizacja: 2026-11-09 (Etap 3)

## Stos

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Aplikacja | Next.js 16 (App Router, Turbopack), React 19, TypeScript | `cacheComponents` włączone |
| Style | Tailwind CSS 4, tokeny w `src/app/globals.css` | bez biblioteki komponentów |
| Ikony | lucide-react | |
| Kalendarz | FullCalendar 6.1.22 (daygrid, timegrid, interaction) | wersje przypięte, zob. D-11 |
| Przeciąganie list | dnd-kit (core, sortable) | kolejność planu dnia; mysz, dotyk, klawiatura |
| Klasy CSS | tailwind-merge | `cx()` w `components/ui.tsx`: przy konflikcie wygrywa późniejsza klasa |
| Walidacja | zod 4 | w server actions |
| Backend | Supabase: Postgres, Auth, RLS, Realtime | klient `@supabase/ssr` |
| Pliki | Google Drive (tylko linki i identyfikatory) | brak własnego storage |

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
      content/ klienci/ projekty/ pomysly/ ustawienia/
  components/
    shell/                  AppShell, nawigacja, przełącznik workspace'ów, motyw
      notifications.tsx     dostawca powiadomień, dzwonek, dymki
    tasks/                  wiersz zadania, okno szczegółów z checklistą, szybkie dodawanie
    ui.tsx                  Button, Field, Input, PageHeader, cx()…
    dialog.tsx              okno: wyśrodkowane na komputerze, arkusz na telefonie
    page-skeleton.tsx       szkielet ładowania modułów
  lib/
    env.ts                  zmienne środowiskowe (publiczne)
    palette.ts              12 kolorów klientów
    calendar.ts             typy kalendarza, kategorie, wykrywanie linków spotkań, daty
    tasks.ts                typy zadań, priorytety, daty „dziś / jutro”, sortowanie
    refs.ts                 workspace'y i aktywni klienci użytkownika (server-only)
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

## Planowane elementy architektury

- Integracje Google na żądanie: krótkotrwały token z okna zgody Google, bez przechowywania tokenów (Etap 5–6).
- Powiadomienia systemowe (Web Push): `pg_cron` + Edge Function wysyłające przypomnienia z `reminders` (Etap 6).
