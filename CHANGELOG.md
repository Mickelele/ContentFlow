# Changelog

Zmiany widoczne dla użytkownika, od najnowszych. Plan na przyszłość jest w [docs/ROADMAP.md](docs/ROADMAP.md).

## [Nieopublikowane]

### Naprawiono
- Wygląd (styl, kolor i tryb) zapisuje się na koncie i nie wraca do domyślnego na innym urządzeniu ani w aplikacji na telefonie.
- Zdjęcie w kalendarzu nie jest przycinane: widać je w całości.

### Dodano
- Kalendarz pokazuje zdjęcie wydarzenia: w widoku dnia i tygodnia pod tytułem wpisu, w widoku miesiąca jako małą miniaturę.
- Publiczne strony „Polityka prywatności” (/polityka-prywatnosci) i „Regulamin” (/regulamin), z linkami na stronie logowania.
- Strona logowania opisuje aplikację i to, do czego służy konto Google.

## Wygląd „Planner”, zdjęcia w wydarzeniach (2026-11-10)

### Dodano
- Nowy wygląd w stylu plannera: nagłówki szeryfowe, pastelowe paski sekcji, cytat dnia na „Dziś”. W Ustawieniach → Wygląd do wyboru 3 style (Delikatny, Kontrastowy, Ciepły beżowy) i 6 kolorów.
- Zdjęcia w wydarzeniach kalendarza: do 12 zdjęć na wydarzenie, także przy tworzeniu nowego; podgląd w pełnym rozmiarze, usuwanie.
- Checklistę można dodać już w nowym zadaniu, przed zapisaniem.

### Naprawiono
- Tablica zadań: pod polem nowego zadania w kolumnie jest przycisk „Dodaj” (na telefonie Enter nie zawsze dodawał zadanie).

### Zmieniono
- Kalendarz pokazuje tylko wydarzenia bieżącego workspace'u. Inny workspace wybierasz przełącznikiem w panelu bocznym.

## Trello, szybkość, Pomocnik jako dymek (2026-11-10)

### Dodano
- Trello: zadania z ContentFlow automatycznie trafiają na wybraną tablicę Trello (tytuł, opis, termin, checklista; kolumna wyznacza listę). Podłączenie w Ustawieniach → Trello.

### Zmieniono
- Strony otwierają się szybciej: serwer działa teraz we Frankfurcie, obok bazy danych, i robi mniej zapytań jedno po drugim.
- Pomocnik to teraz pływający dymek w prawym dolnym rogu, jak czat na stronach. Okno czatu nie blokuje aplikacji.

### Naprawiono
- Górny pasek na iPhonie (aplikacja na ekranie początkowym): linia paska nie najeżdża już na przyciski pod wycięciem ekranu.

## Pomocnik AI (2026-11-09)

### Dodano
- Pomocnik: czat z asystentem AI (przycisk „Pomocnik” w panelu bocznym, na telefonie ikona dymku na górnym pasku). Podpowiada krok po kroku, jak coś zrobić w aplikacji, i uwzględnia stronę, na której jesteś.
- Przewodnik po aplikacji dla użytkowników: `docs/PRZEWODNIK.md`.

## Etap 7: Tablica materiałów, wersje, akceptacja, podsumowanie (2026-11-09)

### Dodano
- Content: tablica Kanban z kolumnami etapów produkcji, przeciąganiem i własną kolejnością; przełącznik Tablica/Lista.
- Wersje scenariusza: „Wersje” w edytorze — zapis z nazwą, podgląd, przywracanie.
- Akceptacja przez klienta: link bez logowania (scenariusz, publikacje, pliki), odpowiedź „Akceptuję” / „Proszę o poprawki”; status w materiale, w dzwonku i jako powiadomienie push.
- Podsumowanie: statystyki tygodnia (zadania dzień po dniu, terminy, publikacje, produkcja, czas, klienci) i tekst podsumowania do skopiowania lub wysłania na Slacka.

## Etap 6: Google Calendar, Trello, PWA (2026-11-09)

### Dodano
- Wersja produkcyjna na Vercelu: https://contentflow-pi-ten.vercel.app
- Kalendarz → „Google”: import wydarzeń z Google Calendar i wysyłanie planu do Google, na żądanie, bez duplikatów.
- Zadania: tablica Kanban (Do zrobienia, W trakcie, Ukończone) z przeciąganiem kart i własną kolejnością; przełącznik Tablica/Lista.
- Zadania → „Z Trello”: import tablicy z pliku JSON (karty, listy kontrolne, terminy).
- Instalacja ContentFlow jako aplikacji na telefonie i komputerze (PWA) z własną ikoną.
- Powiadomienia push o wydarzeniach na wybranych urządzeniach (Ustawienia → To urządzenie).
- Automatyczne przypomnienia o wydarzeniach na kanale Slacka (opcja w Ustawieniach).
- Zmiany z innych urządzeń pojawiają się od razu w kalendarzu, na „Dziś” i w zadaniach.

## Etap 5: Integracje (2026-11-09)

### Dodano
- Inteligentne linki: ikona i nazwa serwisu przy plikach materiału i inspiracjach pomysłów.
- ChatGPT: gotowe polecenia przy materiale (hooki, scenariusz, opis i hashtagi, lista ujęć) i pomyśle (rozwinięcie, seria); otwierają chatgpt.com albo kopiują polecenie.
- Ustawienia: nazwa i kolor workspace'u, integracje, konto.
- Slack: podłączenie webhookiem z wiadomością testową, „Wyślij test”, „Odłącz”, przycisk „Na Slacka” z planem dnia na „Dziś”.
- Dysk Google: „Z Dysku” przy plikach materiału (po skonfigurowaniu klucza API).
- Google Docs: „Do Google Docs” zamienia scenariusz w dokument i dodaje do niego link (po skonfigurowaniu klucza API).

## Etap 4: Content, notatki i pomysły (2026-11-09)

### Dodano
- Content: lista materiałów z filtrem etapu i klienta, wyszukiwarką, najbliższym terminem i postępem.
- Tworzenie materiału: nazwa, rodzaj (rolka, post, grafika, film, karuzela), klient, projekt.
- Strona materiału: ścieżka produkcji, scenariusz z formatowaniem i szablonem rolki (zapis automatyczny), lista ujęć, terminy nagrania / montażu / akceptacji, publikacje na każdej platformie z opisem i hashtagami, pliki i linki.
- Projekty: lista według klientów, strona projektu z materiałami, zadaniami i wydarzeniami; wybór projektu w materiale, zadaniu i wydarzeniu.
- Notatki: edytor z formatowaniem i checklistami, przypinanie, wyszukiwarka, klient.
- „Notatka” w wydarzeniu zakłada notatkę ze spotkania albo otwiera istniejącą.
- Bank pomysłów: tagi, klient, link do inspiracji, archiwum; „Zrób materiał” zamienia pomysł w materiał.
- Termin produkcji i publikacja w kalendarzu oraz na „Dziś” prowadzą do materiału.

### Zmieniono
- „Pomysły” w menu to teraz „Notatki i pomysły”.

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
