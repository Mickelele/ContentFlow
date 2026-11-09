# Changelog

Zmiany widoczne dla użytkownika, od najnowszych. Plan na przyszłość jest w [docs/ROADMAP.md](docs/ROADMAP.md).

## [Nieopublikowane]

## Etap 2: Kalendarz (2026-11-09)

### Dodano
- Kalendarz z widokiem dnia, tygodnia i miesiąca; na telefonie widok 3 dni.
- Panel warstw jak w Google Calendar: wszystkie workspace'y naraz, klienci, „Zadania” i własne warstwy z checkboxami. Widoczność zapamiętuje się na koncie.
- Nowe warstwy (np. „Urlopy”) z wyborem koloru.
- Filtrowanie po kategoriach: nagranie, montaż, publikacja, spotkanie, zadanie, akceptacja, inne.
- Tworzenie wydarzeń kliknięciem w siatkę, zaznaczeniem zakresu, przyciskiem „Wydarzenie” lub „+” na telefonie.
- Edytor wydarzenia: warstwa, kategoria, cały dzień lub godziny, link, miejsce, opis, status, usuwanie.
- Linki Google Meet, Zoom i Teams: przyciski „Dołącz” i „Kopiuj link”, ikona kamery we wpisie.
- „Kopiuj szczegóły”: gotowy tekst z datą, godziną i linkiem do wysłania klientowi.
- Przeciąganie i zmiana długości wydarzeń myszą i palcem.
- Terminy zadań, produkcji i publikacji w kalendarzu (wypełnią się w Etapach 3 i 4).
- Dokumentacja projektu w `docs/`: roadmapa, architektura, model danych, dziennik decyzji, konfiguracja.

### Naprawiono
- Przyciski z nadpisanymi odstępami (np. strzałki „poprzedni / następny”) nie są już ściśnięte.
- Okna dialogowe ustawiają kursor w pierwszym polu zamiast na przycisku zamknięcia.

## Etap 1: Fundament (2026-11-09)

### Dodano
- Logowanie przez Google oraz e-mailem i hasłem.
- Po rejestracji automatycznie tworzy się profil i pierwszy workspace.
- Wiele workspace'ów na jednym koncie z przełącznikiem.
- Klienci: dodawanie, edycja, archiwum, kolor w kalendarzu, kontakt i profile społecznościowe.
- Ekran „Dziś” z powitaniem i podpowiedzią dodania pierwszego klienta.
- Panel boczny na komputerze i dolny pasek na telefonie, motyw jasny, ciemny i systemowy.

### Naprawiono
- Błąd „unstable value Date.now()” i ostrzeżenie o wolnej nawigacji w Next.js 16.
