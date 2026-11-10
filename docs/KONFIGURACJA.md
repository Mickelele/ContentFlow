# Konfiguracja i uruchomienie

> Ostatnia aktualizacja: 2026-11-09

## Zmienne środowiskowe

Skopiuj `.env.example` do `.env.local`. Plik `.env.local` nie trafia do repozytorium.

| Zmienna | Skąd | Gdzie używana |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys | przeglądarka i serwer |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | jw. (*Publishable key*) | przeglądarka i serwer |
| `SUPABASE_SECRET_KEY` | jw. (*Secret key*) | tylko serwer, omija RLS. Nigdy z prefiksem `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_TRELLO_API_KEY` | Trello → Power-Up → API key | przeglądarka i serwer, wysyłka zadań do Trello. Klucz jest publiczny; tokeny kont zapisuje serwer |
| `ANTHROPIC_API_KEY` | [Claude Console](https://platform.claude.com) → API Keys | tylko serwer, Pomocnik AI. Nigdy z prefiksem `NEXT_PUBLIC_` |

## Supabase

1. Projekt w regionie Frankfurt (`eu-central-1`).
2. **SQL Editor:** uruchom kolejno pliki z `supabase/migrations/` (od najstarszego).
3. **Authentication → URL Configuration:**
   - *Site URL:* `http://localhost:3000` (na produkcji adres aplikacji)
   - *Redirect URLs:* `http://localhost:3000/auth/callback` (na produkcji także `https://<domena>/auth/callback`)
4. **Authentication → Sign In / Providers:** e-mail (z potwierdzaniem adresu) i Google (niżej).

## Google OAuth (logowanie)

1. [Google Cloud Console](https://console.cloud.google.com), projekt `ContentFlow`.
2. **Google Auth Platform → Get started:** nazwa aplikacji, e-mail pomocy, *Audience: External*.
3. **Audience → Test users:** dodaj adresy, którymi logujecie się w trybie *Testing* (maks. 100).
4. **Data access:** bez dodatkowych zakresów (domyślnie `openid`, `email`, `profile`).
5. **Clients → Create client → Web application:**
   - *Authorized JavaScript origins:* `http://localhost:3000`
   - *Authorized redirect URIs:* `https://<projekt>.supabase.co/auth/v1/callback`
6. *Client ID* i *Client secret* wklej w Supabase: **Sign In / Providers → Google** → **Save**.

Sprawdzenie, czy Google jest włączony:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

W odpowiedzi `external.google` powinno mieć wartość `true`.

### Przed publicznym startem
- Zmień w *Audience* status aplikacji na **In production**. Same podstawowe zakresy nie wymagają weryfikacji.
- Integracje z kalendarzem (Etap 6) używają zakresów „wrażliwych”. Powyżej 100 użytkowników wymagają weryfikacji Google: domeny, polityki prywatności, regulaminu i nagrania demo.
- Dodaj adres produkcyjny do *JavaScript origins* w Google i do *Redirect URLs* w Supabase.

## Dysk Google i Google Docs (Etap 5)

ContentFlow prosi o dostęp do Dysku dopiero przy pierwszym użyciu („Z Dysku”, „Do Google Docs”), z zakresem `drive.file`: widzi tylko pliki wskazane w oknie Google albo utworzone przez siebie. Tokenów nie zapisujemy.

1. Google Cloud Console → projekt `ContentFlow` → **APIs & Services → Library**: włącz **Google Drive API** i **Google Picker API**.
2. **APIs & Services → Credentials → Create credentials → API key.** Potem **Edit API key**:
   - *Application restrictions:* **Websites**, dodaj `http://localhost:3000/*` (na produkcji także `https://<domena>/*`)
   - *API restrictions:* **Restrict key** → zaznacz **Google Picker API** i **Google Drive API**
3. Numer projektu: **IAM & Admin → Settings → Project number**.
4. **Google Auth Platform → Data access → Add or remove scopes:** dodaj `https://www.googleapis.com/auth/drive.file` → **Update** → **Save**.
5. W `.env.local`:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Client ID z logowania (to samo co w Supabase)
   - `NEXT_PUBLIC_GOOGLE_API_KEY` — klucz z kroku 2
   - `NEXT_PUBLIC_GOOGLE_APP_ID` — numer projektu z kroku 3
6. Uruchom ponownie `npm run dev` (zmienne `NEXT_PUBLIC_*` są wczytywane przy starcie).

Dopóki te trzy zmienne są puste, przyciski Dysku i Docs są ukryte.

**Tryb Testing:** samo logowanie działa dla każdego, ale dostęp do Dysku Google wyda tylko kontom z listy **Audience → Test users**. Inni zobaczą „Błąd 403: access_denied — aplikacja nie przeszła weryfikacji”. Rozwiązanie: dopisać konto do testerów albo opublikować aplikację (**Publish app** → *In production*; `drive.file` nie jest zakresem wrażliwym). Konta firmowe i uczelniane może dodatkowo blokować administrator organizacji.

Numer projektu (`NEXT_PUBLIC_GOOGLE_APP_ID`) to liczba — ta sama, którą zaczyna się Client ID (`757723447090-…`), a nie identyfikator projektu (`contentflow-514213`).

## Slack (Etap 5)

Konfiguruje właściciel workspace'u w **Ustawieniach** aplikacji:
1. [api.slack.com/apps](https://api.slack.com/apps?new_app=1) → **Create New App → From scratch** → wybierz swój Slack.
2. **Incoming Webhooks** → włącz → **Add New Webhook to Workspace** → wybierz kanał.
3. Skopiuj adres `https://hooks.slack.com/services/…` i wklej go w Ustawieniach ContentFlow.

Adresu webhooka nie da się odczytać przez API aplikacji (tabela `workspace_secrets` bez polityki SELECT). Wiadomości wysyła serwer kluczem `SUPABASE_SECRET_KEY`, więc ta zmienna musi być ustawiona na serwerze.

## Google Calendar — import i eksport (Etap 6)

1. Google Cloud → **APIs & Services → Library:** włącz **Google Calendar API**.
2. **Google Auth Platform → Data access → Add or remove scopes:** dodaj
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
3. To zakresy **wrażliwe**: w trybie *Testing* działają dla kont z listy testerów; publicznie wymagają weryfikacji aplikacji przez Google (domena, polityka prywatności, regulamin, nagranie demo).

Przycisk „Google” w kalendarzu pojawia się, gdy ustawione jest `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Powiadomienia push i przypomnienia z serwera (Etap 6)

**Zmienne** (lokalnie w `.env.local`, na produkcji w Vercelu → Settings → Environment Variables):

| Zmienna | Skąd |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` (raz; ta sama para lokalnie i na produkcji, inaczej zapisane urządzenia przestaną działać) |
| `VAPID_SUBJECT` | adres aplikacji, np. `https://contentflow-pi-ten.vercel.app` |
| `CRON_SECRET` | długi losowy ciąg (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) |

**Harmonogram** — co minutę Supabase woła `/api/cron/reminders`, który wysyła push i (jeśli włączone) Slacka:
1. Supabase → **Integrations**: włącz **Cron** (`pg_cron`) i **pg_net**.
2. **SQL Editor** (sekretu nie zapisujemy w repozytorium — wstaw swój `CRON_SECRET`):
   ```sql
   select cron.schedule(
     'contentflow-reminders', '* * * * *',
     $$ select net.http_get(
          url := 'https://contentflow-pi-ten.vercel.app/api/cron/reminders',
          headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
        ) $$
   );
   ```
3. Sprawdzenie: `select * from cron.job_run_details order by start_time desc limit 5;`

Na iPhonie powiadomienia działają tylko w aplikacji dodanej do ekranu początkowego (iOS 16.4+).

## Trello

### Import z pliku (Etap 6)

Bez konfiguracji. W Trello: menu tablicy → **Drukuj, eksportuj i udostępniaj → Eksportuj jako JSON**, a w ContentFlow: **Zadania → Z Trello** i wskazanie pliku.

### Automatyczna wysyłka zadań na tablicę

1. Zaloguj się do Trello i otwórz [trello.com/power-ups/admin](https://trello.com/power-ups/admin) → **New**: nazwa `ContentFlow`, dowolny workspace Trello, e-mail i autor. W polu *Iframe connector URL* wpisz adres aplikacji: `https://contentflow-pi-ten.vercel.app`. Pole jest obowiązkowe, ale nieużywane: Power-Upa nie dodajemy do żadnej tablicy, służy tylko do wydania klucza API.
2. W Power-Upie: zakładka **API key** → **Generate a new API key**. Klucz (nie *Secret*) wpisz jako `NEXT_PUBLIC_TRELLO_API_KEY` w `.env.local` i w Vercelu, potem **Redeploy**.
3. W tej samej zakładce, **Allowed origins**: dodaj `https://contentflow-pi-ten.vercel.app` i `http://localhost:3000`. Bez tego Trello nie wróci do ContentFlow po autoryzacji (zostaje ręczne wklejenie tokenu).
4. W ContentFlow: **Ustawienia → Trello → Połącz z Trello** (właściciel workspace'u), zgoda na koncie Trello, wybór tablicy i trzech list.

Token Trello trafia tylko do `workspace_secrets` (bez odczytu przez API) i jest wysyłany do Trello w nagłówku. Kolejkę opróżnia przeglądarka zaraz po zmianie (`/api/trello/flush`) oraz cron co minutę (`/api/cron/reminders`), więc nie trzeba dodawać nowego zadania w `pg_cron`.

## Pomocnik AI (Claude)

1. [Claude Console](https://platform.claude.com) → **Settings → API Keys → Create Key**. Klucz zaczyna się od `sk-ant-api…`.
2. Wpisz go jako `ANTHROPIC_API_KEY` w `.env.local` oraz w Vercelu (**Settings → Environment Variables**, środowisko *Production*), potem zrób **Redeploy**.
3. W konsoli ustaw **Limits → Spend limit** (np. kilka dolarów miesięcznie). Model `claude-haiku-5-5` kosztuje $0,10 za milion tokenów wejścia i $0,50 za milion wyjścia; jedno pytanie to zwykle ułamek centa.
4. Bez klucza przycisk „Pomocnik” działa, ale odpowiada komunikatem o braku konfiguracji.

Klucza nie wklejaj do czatów, issue ani commitów. Jeśli wyciekł, usuń go w konsoli i utwórz nowy.

## Wdrożenie (Vercel)

Produkcja: **https://contentflow-pi-ten.vercel.app** · projekt Vercel połączony z `Mickelele/ContentFlow`, gałąź `main` wdraża się automatycznie po każdym pushu.

1. [vercel.com/new](https://vercel.com/new) → import repozytorium. Ustawienia domyślne (Next.js, `next build`, Node 22).
2. **Environment Variables:** te same zmienne co w `.env.local` — 6 podstawowych oraz 4 do powiadomień (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`); sekrety (`SUPABASE_SECRET_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`) oznacz jako *Sensitive*.
3. **Region funkcji:** ustawiony w repozytorium w `vercel.json` (`"regions": ["fra1"]`, Frankfurt, obok bazy Supabase `eu-central-1`). Domyślny region Vercela to Waszyngton (`iad1`): wtedy każde zapytanie do bazy leci przez Atlantyk. Region sprawdzisz w nagłówku odpowiedzi `x-vercel-id` funkcji (np. `arn1::fra1::…`; drugi człon to region funkcji).
4. Adres produkcyjny dopisać w trzech miejscach (inaczej logowanie i Dysk nie zadziałają):

| Gdzie | Pole | Wartość |
|---|---|---|
| Supabase → Authentication → URL Configuration | Site URL | `https://contentflow-pi-ten.vercel.app` |
| jw. | Redirect URLs | `https://contentflow-pi-ten.vercel.app/auth/callback` (zostaw też `http://localhost:3000/auth/callback`) |
| Google Cloud → Clients → klient Web | Authorized JavaScript origins | `https://contentflow-pi-ten.vercel.app` |
| Google Cloud → Credentials → klucz API | Website restrictions | `https://contentflow-pi-ten.vercel.app/*` |

Zmiana zmiennych w Vercelu wymaga ponownego wdrożenia (**Deployments → ⋯ → Redeploy**), bo `NEXT_PUBLIC_*` są wbudowywane w kod podczas builda.

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Aplikacja działa pod http://localhost:3000.

## Sprawdzenie przed commitem

```bash
npx tsc --noEmit
npm run lint
npm run build
```
