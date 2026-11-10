# Roadmapa ContentFlow

> Ostatnia aktualizacja: 2026-11-10 · Obecny etap: **Wygląd i zdjęcia zakończone** — następny do ustalenia (polecany: zespół i role)

ContentFlow jest **głównym kalendarzem i planerem** użytkownika. Google Calendar to most uruchamiany na żądanie, a nie źródło prawdy.
Identyfikatory w nawiasach (np. `CAL-01`) odnoszą się do specyfikacji wymagań v1.0.

Legenda: ✅ zrobione · 🔨 w trakcie · ⏳ zaplanowane · 💤 odłożone

---

## ✅ Etap 1: Fundament
Zakończony 2026-11-09 · commit `e166cf1`

- ✅ Next.js 16 + Supabase, TypeScript, Tailwind 4
- ✅ Logowanie Google oraz e-mail i hasło, odświeżanie sesji w `proxy.ts`
- ✅ Schemat bazy z RLS dla wszystkich modułów (workspace'y, klienci, warstwy kalendarza, projekty, content, wydarzenia, zadania, załączniki, przypomnienia, integracje)
- ✅ Automatycznie przy rejestracji: profil, pierwszy workspace, warstwa „Zadania”
- ✅ Wiele workspace'ów na konto (jeden na firmę) z przełącznikiem
- ✅ Powłoka aplikacji: panel boczny (desktop), dolny pasek z „+” (telefon), motyw jasny/ciemny/systemowy
- ✅ Klienci: lista, dodawanie, edycja, archiwum, 12 kolorów, kontakt, profile społecznościowe (`CLI-01..04`)
- ✅ Ekran „Dziś” (szkielet) i tworzenie workspace'u
- ✅ Szkielety ładowania modułów (natychmiastowa nawigacja w Next 16)

## ✅ Etap 2: Kalendarz
Zakończony 2026-11-09 · migracja `20261109150000_calendar.sql`

- ✅ Widok dnia, tygodnia i miesiąca (`CAL-01`); na telefonie zamiast tygodnia 3 dni
- ✅ Jeden widok dla **wszystkich workspace'ów** z panelem warstw i checkboxami jak w Google Calendar (na telefonie wysuwany z boku)
- ✅ Widoczność warstw zapisywana na koncie i zsynchronizowana między urządzeniami
- ✅ Własne warstwy (np. „Urlopy”, „Deadline”) obok warstw klientów i „Zadań”
- ✅ Dodawanie, edycja i usuwanie wydarzeń (`CAL-02`), całodniowe i godzinowe (`CAL-06`)
- ✅ Klient wydarzenia wynika z jego warstwy (`CAL-03`), kategorie jako ikony (`CAL-05`), kolor klienta (`CAL-04`)
- ✅ Przeciąganie i zmiana długości myszą i palcem (`CAL-07`); zmiana trafia do rekordu źródłowego
- ✅ Filtry: klienci przez warstwy, kategorie przez przełączniki (`CAL-08`)
- ✅ **Linki do spotkań:** rozpoznawanie Meet/Zoom/Teams, „Dołącz”, „Kopiuj link”, „Kopiuj szczegóły” do wysłania klientowi
- ✅ Funkcja `calendar_items(od, do)`: wydarzenia, terminy zadań, terminy produkcji i publikacje dla widocznego zakresu (`CAL-13`, `NFR-05`)
- ✅ „+ → Wydarzenie” w dolnym pasku otwiera edytor od razu
- ➡️ Przypisanie wydarzenia do **projektu** przeniesione do Etapu 4 (razem z modułem projektów)

## ✅ Etap 3: Plan dnia i zadania
Zakończony 2026-11-09 · migracja `20261109180000_day_plan.sql`

- ✅ „Dziś” jako plan dnia: lista do odhaczania z postępem, kolejność przeciąganiem (mysz, palec, klawiatura), szybkie dodawanie
- ✅ Plan dnia ze wszystkich workspace'ów naraz, z odznaką firmy przy zadaniu
- ✅ Rozróżnienie „zrobię dziś” (`planned_on`) i „termin oddania” (`due_at`)
- ✅ „Z poprzednich dni”: przenieś na dziś (pojedynczo lub wszystkie) albo odłóż
- ✅ Zadania: priorytety, terminy (z godziną lub bez), statusy, klient, opis, checklista (`TASK-01..06`, zob. D-15)
- ✅ Moduł Zadania: grupy Zaległe / Dziś / Jutro / 7 dni / Później / Bez terminu, ukończone, filtr klienta, „do planu dnia” jednym kliknięciem
- ✅ „Dziś”: wydarzenia z „Dołącz” i „Kopiuj link”, terminy na dziś, zaległe, publikacje tygodnia (`DASH-01..05`)
- ✅ Przypomnienia o wydarzeniach (od „w chwili rozpoczęcia” do „1 dzień przed”), przesuwają się razem z wydarzeniem (`CAL-10`)
- ✅ **Powiadomienia w aplikacji:** dzwonek z przypomnieniami, terminami, zaległościami, publikacjami i akceptacjami; dymek przy nowym przypomnieniu
- ✅ Z kalendarza termin zadania otwiera się w module Zadania

## ✅ Etap 4: Content, notatki i pomysły
Zakończony 2026-11-09 · migracja `20261110090000_content_notes.sql`

- ✅ Materiały: rolka, post, grafika, film, karuzela, inne; lista z filtrem etapu, klienta i wyszukiwarką (`CON-01..03`)
- ✅ Ścieżka produkcji: pomysł → scenariusz → nagrania → montaż → akceptacja → zaplanowano → opublikowano
- ✅ Edytor scenariusza (Tiptap, zapis automatyczny, szablon rolki) i numerowana lista ujęć (`CON-04..05`)
- ✅ Terminy nagrania, montażu i akceptacji z odhaczaniem, widoczne w kalendarzu (`CON-06..07`)
- ✅ Publikacje per platforma: data, opis, hashtagi, „Opublikowano” (`CON-08..09`)
- ✅ Pliki i linki przy materiale (`CON-10`)
- ✅ **Notatki:** formatowanie, checklisty, przypinanie, wyszukiwarka, klient; notatka ze spotkania z edytora wydarzenia
- ✅ **Pomysły:** szybkie zapisywanie, tagi, klient, link do inspiracji, archiwum; „Zrób materiał” jednym kliknięciem
- ✅ Projekty klientów: lista, strona projektu z materiałami, zadaniami i wydarzeniami (`CLI-05..07`)
- ✅ Projekt w materiale, zadaniu (`TASK-05`) i wydarzeniu w kalendarzu
- ✅ Z kalendarza i „Dziś” termin produkcji / publikacja otwiera materiał
- ➡️ Kanban materiałów (`CON-11`), wersjonowanie scenariuszy (`CON-12`) zostają w „Później”

## ✅ Etap 5: Integracje
Zakończony 2026-11-09 · migracja `20261110120000_integrations.sql`

- ✅ **Inteligentne linki:** wklejony link pokazuje ikonę i nazwę serwisu (Docs, Sheets, Slides, Dysk, Trello, Slack, Canva, Figma, Notion, YouTube, Instagram, TikTok i inne); nazwa domyślna = serwis
- ✅ **Dysk Google:** „Z Dysku” przy plikach materiału, okno wyboru Google, zakres `drive.file`, bez zapisywania tokenów
- ✅ **Google Docs:** „Do Google Docs” tworzy dokument ze scenariusza (nagłówki, listy) i dodaje link do materiału
- ✅ **ChatGPT:** gotowe polecenia przy materiale (hooki, scenariusz, opis z hashtagami, lista ujęć) i pomyśle (rozwinięcie, seria)
- ✅ **Slack:** webhook podłączany w Ustawieniach (z wiadomością testową), „Na Slacka” na „Dziś” wysyła plan dnia
- ✅ **Ustawienia:** nazwa i kolor workspace'u, stan integracji, konto
- ✅ Dysk i Docs skonfigurowane i sprawdzone 2026-11-09 (wybór pliku z Dysku i eksport scenariusza do Google Docs); w trybie Testing tylko dla kont z listy testerów
- ➡️ Automatyczne przypomnienia na Slacka (bez klikania) dojdą w Etapie 6 razem z wysyłką z serwera (`pg_cron`)

## ✅ Wdrożenie
- ✅ Produkcja na Vercelu: https://contentflow-pi-ten.vercel.app (2026-11-09), automatyczne wdrażanie z `main`
- ✅ Logowanie Google i Dysk działają na produkcji

## ✅ Etap 6: Google Calendar, Trello, PWA
Zakończony 2026-11-09 · migracje `20261110150000_push_sync.sql`, `20261110180000_task_board.sql` · sprawdzone na produkcji: harmonogram, push (Windows, iPhone), przypomnienie z serwera, import i eksport Google, tablica Kanban; import z Trello jeszcze nie przetestowany na prawdziwej tablicy

- ✅ **Import z Google Calendar** na żądanie: wybór konta, kalendarzy, warstwy docelowej (nowa lub istniejąca) i okresu; ponowny import aktualizuje bez duplikatów (`CAL-11`)
- ✅ **Eksport do Google Calendar** na żądanie: kalendarz docelowy, warstwy, okres; ponowny eksport aktualizuje wysłane wydarzenia; zaimportowane z Google nie wracają
- ✅ **Trello:** import z pliku JSON tablicy (karty → zadania, listy kontrolne → checklisty, lista „Done” → ukończone), bez duplikatów
- ✅ **PWA:** manifest, ikony, service worker, instalacja na telefonie i komputerze
- ✅ **Powiadomienia push** o wydarzeniach (Web Push) — także przy zamkniętej aplikacji; włączane per urządzenie w Ustawieniach
- ✅ **Przypomnienia na Slacka** z serwera (opcja workspace'u), jedno na wydarzenie
- ✅ **Tablica Kanban zadań** (jak w Jirze): Do zrobienia / W trakcie / Ukończone, przeciąganie między kolumnami i w kolumnie, szybkie dodawanie, przełącznik Tablica/Lista
- ✅ **Synchronizacja na żywo** (Supabase Realtime): kalendarz, „Dziś” i zadania odświeżają się po zmianie na innym urządzeniu
- ✅ Skonfigurowane: `pg_cron` + `pg_net`, klucze VAPID i `CRON_SECRET` w Vercelu, Google Calendar API (`docs/KONFIGURACJA.md`)
- ➡️ Praca offline z kolejką zmian (`NFR`, spec. 3.3) przeniesiona do „Później”

---

## ✅ Etap 7: Tablica materiałów, wersje, akceptacja, podsumowanie
Zakończony 2026-11-09 · migracja `20261110200000_content_review.sql` · sprawdzone na produkcji: przeciąganie na tablicy materiałów, zapis i podgląd wersji, akceptacja i poprawki przez link klienta (etap, status, dzwonek), podsumowanie z nawigacją tygodni

- ✅ **Tablica Kanban materiałów** (`CON-11`): 7 kolumn = etapy produkcji, przeciąganie zmienia etap, własna kolejność; przełącznik Tablica/Lista
- ✅ **Wersje scenariuszy** (`CON-12`): zapis wersji z nazwą, podgląd, przywracanie (bieżący tekst trafia do historii)
- ✅ **Akceptacja przez klienta** (`CON-13`): link bez logowania z migawką scenariusza, publikacjami i plikami; „Akceptuję” / „Proszę o poprawki” z komentarzem; odpowiedź zmienia etap, odhacza termin akceptacji (jeśli ma datę), przychodzi jako push i w dzwonku
- ✅ **Podsumowanie** (`DASH-06`, `DASH-07`): tydzień po tygodniu — ukończone zadania (dzień po dniu, porównanie z poprzednim tygodniem), terminy dotrzymane, publikacje, produkcja, czas w kalendarzu, podział na klientów; tekst podsumowania do skopiowania i na Slacka

## ✅ Pomocnik AI
Zakończony 2026-11-09 · commit `d7f0f04` · sprawdzone na produkcji: panel czatu, odpowiedź strumieniem z kontekstem strony

- ✅ Przewodnik dla użytkowników `docs/PRZEWODNIK.md` — źródło wiedzy Pomocnika
- ✅ Czat „Pomocnik” w powłoce aplikacji (Claude Haiku 5.5, odpowiedź strumieniem, kontekst bieżącej strony)
- ✅ Klucz `ANTHROPIC_API_KEY` w Vercelu i test na produkcji

## ✅ Trello: automatyczna wysyłka zadań
Zakończony 2026-11-10 · migracja `20261111090000_trello_sync.sql` · sprawdzone na produkcji: 126 zadań na tablicy bez duplikatów i na właściwych listach; nowe zadanie, zmiana statusu, checklista i usunięcie w ciągu kilku sekund

- ✅ Kolejka zmian w bazie (triggery na zadaniach i checklistach) i wysyłka na tablicę: tytuł, opis, termin, lista wg statusu, checklista
- ✅ Ustawienia → Trello: autoryzacja konta, wybór tablicy i list, utworzenie list, odłączenie
- ✅ Klucz API Trello, migracja na bazie, test na prawdziwej tablicy

## ✅ Wygląd „Planner”, zdjęcia w wydarzeniach, poprawki
Zakończony 2026-11-10 · migracja `20261111120000_event_photos.sql` · sprawdzone na produkcji: wygląd na „Dziś” i w kalendarzu, zdjęcie w nowym wydarzeniu (zapis, podgląd, usunięcie z plikiem), kalendarz tylko z bieżącego workspace'u, dodawanie do pustej kolumny i checklista w nowym zadaniu

- ✅ Wygląd w stylu plannera: 3 warianty, 6 kolorów, Ustawienia → Wygląd (D-36)
- ✅ Zdjęcia w wydarzeniach kalendarza (D-35)
- ✅ Kalendarz tylko z bieżącego workspace'u (D-34)
- ✅ Checklista w nowym zadaniu przed zapisem
- ✅ Dodawanie do pustej kolumny: na komputerze działa; dodany przycisk „Dodaj” na telefon (Enter na klawiaturze Androida nie zawsze wysyła)

## Później (P1/P2 ze specyfikacji)
- 💤 Praca offline z kolejką zmian i wskaźnikiem „czeka na synchronizację”
- 🔨 Weryfikacja aplikacji w Google (zakresy kalendarza): ✅ polityka prywatności i regulamin (2026-11-10), ⏳ potwierdzenie domeny w Search Console, nagranie demo i wysłanie do weryfikacji
- 💤 Wydarzenia cykliczne (`CAL-09`), wykrywanie konfliktów (`CAL-12`)
- 💤 Planer sesji nagraniowych (`REC-01..08`)
- 💤 Pakiety usług i licznik materiałów (`CLI-08..09`), raporty (`CLI-11`)
- 💤 Zapraszanie osób do workspace'u, role
- 💤 AI: wydarzenia z opisu, scenariusze, plan miesiąca (`AI-01..09`)
- 💤 Weryfikacja aplikacji w Google przed publicznym startem
- 💤 Zadania: powtarzające się (`TASK-07`), czas szacowany i rzeczywisty (`TASK-08`), zależności (`TASK-09`), sugerowanie terminów (`TASK-10`)
- 💤 Historia współpracy z klientem (`CLI-10`)
- 💤 Personalizacja układu „Dziś” (`DASH-08`)
- 💤 Synchronizacja z Outlook Calendar (`CAL-15`)
- 💤 Test wydajności: 1000+ wydarzeń w kalendarzu (`NFR-04`)

## Poza zakresem (decyzja z 2026-11-09)
- Gmail przez API: zakres „restricted” wymaga płatnego audytu bezpieczeństwa
- Canva przez API
- Automatyczna, ciągła synchronizacja z Google Calendar
- Automatyczne publikowanie w social media (`CON-14`)
