# Changelog

Zmiany widoczne dla użytkownika, od najnowszych. Plan na przyszłość jest w [docs/ROADMAP.md](docs/ROADMAP.md).

## [Nieopublikowane]

## Etap 3: Plan dnia i zadania (2026-11-09)

### Dodano
- „Dziś” to teraz plan dnia: lista do odhaczania z paskiem postępu, kolejność zmieniana przeciąganiem, pole „Co dziś zrobisz?”.
- Plan dnia pokazuje zadania ze wszystkich workspace'ów.
- „Z poprzednich dni”: nieodhaczone zadania z wcześniejszych planów, z przeniesieniem na dziś lub odłożeniem.
- Kolumna obok planu: wydarzenia dnia z „Dołącz” i „Kopiuj link”, terminy na dziś, zaległe zadania, publikacje tygodnia.
- Moduł Zadania: grupy według terminu, zakładka „Ukończone”, filtr klienta, szybkie dodawanie, dodawanie do planu dnia ikoną słońca.
- Szczegóły zadania: priorytet, status, klient, termin oddania z godziną lub bez, „Kiedy to zrobisz”, opis, checklista.
- Przypomnienia o wydarzeniach z wyborem czasu; przesuwają się razem z wydarzeniem.
- Dzwonek powiadomień z licznikiem, listą i „Oznacz wszystkie”; dymek, gdy nadejdzie przypomnienie.
- Termin zadania w kalendarzu ma przycisk „Otwórz zadanie”.

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
