# Roadmapa ContentFlow

> Ostatnia aktualizacja: 2026-11-09 · Obecny etap: **6 — Google Calendar, Trello, PWA** (nierozpoczęty)

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

## ⏳ Etap 6: Google Calendar, Trello, PWA
- ⏳ **Import z Google** na żądanie: wybór konta, kalendarzy, okresu i warstwy docelowej; bez duplikatów przy ponownym imporcie
- ⏳ **Eksport do Google** na żądanie: wybór okresu, warstw i kalendarza docelowego; opcjonalnie link Google Meet
- ⏳ Trello: import kart jako zadań na żądanie
- ⏳ PWA: instalacja na telefonie, powiadomienia systemowe (Web Push), praca offline z kolejką zmian
- ⏳ Synchronizacja na żywo między telefonem a laptopem (Supabase Realtime)

---

## Później (P1/P2 ze specyfikacji)
- 💤 Wydarzenia cykliczne (`CAL-09`), wykrywanie konfliktów (`CAL-12`)
- 💤 Kanban contentu (`CON-11`), wersjonowanie (`CON-12`), akceptacja przez klienta (`CON-13`)
- 💤 Planer sesji nagraniowych (`REC-01..08`)
- 💤 Pakiety usług i licznik materiałów (`CLI-08..09`), raporty (`CLI-11`)
- 💤 Statystyki i podsumowanie tygodnia (`DASH-06..07`)
- 💤 Zapraszanie osób do workspace'u, role
- 💤 AI: wydarzenia z opisu, scenariusze, plan miesiąca (`AI-01..09`)
- 💤 Weryfikacja aplikacji w Google przed publicznym startem

## Poza zakresem (decyzja z 2026-11-09)
- Gmail przez API: zakres „restricted” wymaga płatnego audytu bezpieczeństwa
- Canva przez API
- Automatyczna, ciągła synchronizacja z Google Calendar
- Automatyczne publikowanie w social media (`CON-14`)
