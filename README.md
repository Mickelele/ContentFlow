# ContentFlow

Kalendarz i planer pracy dla twórców i marketingowców: nagrania, montaże, publikacje, zadania i notatki wszystkich klientów w jednym miejscu. Next.js 16 + Supabase.

## Start

```bash
npm install
cp .env.example .env.local   # uzupełnij klucze Supabase
npm run dev
```

Pełna konfiguracja (Supabase, Google OAuth) jest w [docs/KONFIGURACJA.md](docs/KONFIGURACJA.md).

## Dokumentacja

| Dokument | Zawartość |
|---|---|
| [docs/ROADMAP.md](docs/ROADMAP.md) | Etapy, co jest zrobione, co dalej |
| [CHANGELOG.md](CHANGELOG.md) | Co się zmieniło w kolejnych wersjach |
| [docs/ARCHITEKTURA.md](docs/ARCHITEKTURA.md) | Stos, struktura katalogów, logowanie, workspace'y, specyfika Next.js 16, system wizualny |
| [docs/MODEL-DANYCH.md](docs/MODEL-DANYCH.md) | Tabele, relacje, triggery, planowane zmiany |
| [docs/DECYZJE.md](docs/DECYZJE.md) | Dziennik decyzji produktowych i technicznych |
| [docs/KONFIGURACJA.md](docs/KONFIGURACJA.md) | Zmienne środowiskowe, Supabase, Google OAuth, uruchomienie |
