# ContentFlow

Kalendarz i planer pracy dla twórców i marketingowców. Next.js 16 + Supabase.

## Uruchomienie

### 1. Projekt w Supabase

1. Załóż projekt na [supabase.com](https://supabase.com) (region: Frankfurt `eu-central-1`).
2. **SQL Editor** → wklej całą zawartość `supabase/migrations/20261109120000_init.sql` → **Run**.
3. **Project Settings → API Keys**: skopiuj *Project URL* i *Publishable key*.
4. Skopiuj `.env.example` do `.env.local` i wklej te dwie wartości.

### 2. Logowanie Google

1. [Google Cloud Console](https://console.cloud.google.com) → nowy projekt „ContentFlow”.
2. **APIs & Services → OAuth consent screen**: typ *External*, nazwa aplikacji, e-mail kontaktowy.
   Zakresy: tylko `openid`, `email`, `profile`. Dodaj siebie jako *test user*.
3. **Credentials → Create credentials → OAuth client ID** → *Web application*.
   - *Authorized JavaScript origins*: `http://localhost:3000`
   - *Authorized redirect URIs*: `https://<twoj-projekt>.supabase.co/auth/v1/callback`
4. Skopiuj *Client ID* i *Client secret* do Supabase: **Authentication → Sign In / Providers → Google**.
5. Supabase → **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:3000`
   - *Redirect URLs*: `http://localhost:3000/auth/callback`

### 3. Start

```bash
npm install
npm run dev
```

Otwórz http://localhost:3000.

## Struktura

| Ścieżka | Co tam jest |
|---|---|
| `supabase/migrations/` | Schemat bazy: workspace'y, klienci, warstwy kalendarza, content, zadania, RLS |
| `src/proxy.ts` | Odświeżanie sesji i przekierowanie niezalogowanych (w Next 16 „middleware” nazywa się „proxy”) |
| `src/lib/workspace.ts` | Sesja, lista workspace'ów, bieżący workspace |
| `src/app/w/[slug]/` | Aplikacja w obrębie workspace'u |
| `src/app/globals.css` | Tokeny: neutralny interfejs + 12 kolorów klientów (jasny i ciemny motyw) |

## Model

- Użytkownik należy do wielu **workspace'ów** (jeden na firmę). Po rejestracji powstaje pierwszy.
- Każdy **klient** automatycznie dostaje własną **warstwę kalendarza** w swoim kolorze; każdy workspace ma też warstwę „Zadania”.
- Widoczność warstw (`calendar_visibility`) jest zapisywana per użytkownik i synchronizuje się między urządzeniami.
- RLS: każda tabela ma `workspace_id`, dostęp mają tylko członkowie danego workspace'u.
