# Architektura

> Ostatnia aktualizacja: 2026-11-09 (Etap 1)

## Stos

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Aplikacja | Next.js 16 (App Router, Turbopack), React 19, TypeScript | `cacheComponents` włączone |
| Style | Tailwind CSS 4, tokeny w `src/app/globals.css` | bez biblioteki komponentów |
| Ikony | lucide-react | |
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
      dzis/ kalendarz/ content/ zadania/ klienci/ projekty/ pomysly/ ustawienia/
  components/
    shell/                  AppShell, nawigacja, przełącznik workspace'ów, motyw
    ui.tsx                  Button, Field, Input, PageHeader…
    page-skeleton.tsx       szkielet ładowania modułów
  lib/
    env.ts                  zmienne środowiskowe (publiczne)
    palette.ts              12 kolorów klientów
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

## Planowane elementy architektury

- `calendar_items(od, do, filtry)`: funkcja w Postgresie łącząca wydarzenia, terminy zadań i terminy contentu. Zwraca `source_type` i `source_id`, więc przeciągnięcie w kalendarzu zmienia rekord źródłowy (Etap 2).
- Integracje Google na żądanie: krótkotrwały token z okna zgody Google, bez przechowywania tokenów (Etap 5–6).
- Powiadomienia: tabela powiadomień + `pg_cron` i Edge Function do wysyłki (Etap 3 i 6).
