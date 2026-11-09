# Konfiguracja i uruchomienie

> Ostatnia aktualizacja: 2026-11-09

## Zmienne środowiskowe

Skopiuj `.env.example` do `.env.local`. Plik `.env.local` nie trafia do repozytorium.

| Zmienna | Skąd | Gdzie używana |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys | przeglądarka i serwer |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | jw. (*Publishable key*) | przeglądarka i serwer |
| `SUPABASE_SECRET_KEY` | jw. (*Secret key*) | tylko serwer, omija RLS. Nigdy z prefiksem `NEXT_PUBLIC_` |

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
