@AGENTS.md

# ContentFlow: zasady pracy

## Dokumentacja na bieżąco (obowiązkowo)

Każda zmiana w kodzie idzie razem z aktualizacją dokumentacji, **w tym samym commicie**:

| Gdy… | Zaktualizuj |
|---|---|
| kończysz lub zaczynasz punkt z planu | `docs/ROADMAP.md`: status (✅ 🔨 ⏳ 💤), „Obecny etap”, data aktualizacji |
| zmienia się coś widocznego dla użytkownika | `CHANGELOG.md`, sekcja „Nieopublikowane” (Dodano / Zmieniono / Naprawiono) |
| zapada decyzja produktowa lub techniczna | `docs/DECYZJE.md`: nowy wpis D-xx na górze (decyzja, dlaczego, skutek) |
| zmienia się schemat bazy | nowa migracja w `supabase/migrations/` + `docs/MODEL-DANYCH.md` |
| zmienia się struktura, stos lub wzorzec | `docs/ARCHITEKTURA.md` |
| zmienia się konfiguracja lub zmienne środowiskowe | `docs/KONFIGURACJA.md` + `.env.example` |
| zmienia się coś, co użytkownik klika lub widzi | `docs/PRZEWODNIK.md` (z niego korzysta Pomocnik AI) |

Po zamknięciu etapu przenieś wpisy z „Nieopublikowane” w `CHANGELOG.md` pod nagłówek etapu z datą.

## Konwencje

- Interfejs, dokumentacja i komentarze po polsku. Nazwy w kodzie (zmienne, tabele) po angielsku.
- Nie zmieniaj istniejących migracji, które są już na bazie. Każda zmiana schematu to nowy plik migracji.
- Każda nowa tabela: `workspace_id`, RLS przez `is_member(workspace_id)`, `updated_at` i `version`, jeśli jest edytowalna.
- Kolor oznacza klienta, kategoria to ikona (zob. `docs/DECYZJE.md` D-03).
- Przed commitem: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
