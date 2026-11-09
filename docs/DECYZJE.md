# Dziennik decyzji

Krótko: co zdecydowaliśmy, dlaczego i co z tego wynika. Najnowsze na górze.
Nie usuwamy starych wpisów. Gdy decyzja się zmienia, dodajemy nową i oznaczamy starą jako „zastąpiona przez D-xx”.

---

### D-16 · Przypomnienia są osobne dla każdej osoby
2026-11-09
- **Decyzja:** przypomnienie (`reminders`) należy do użytkownika i zapisuje przesunięcie w minutach (`offset_minutes`). Trigger liczy z niego `remind_at`, a przesunięcie wydarzenia przelicza przypomnienia wszystkich osób.
- **Dlaczego:** w jednym workspace może pracować kilka osób, a każda chce być powiadomiona kiedy indziej.

### D-15 · Checklista zamiast podzadań
2026-11-09
- **Decyzja:** wymaganie „podzadania i checklisty” (`TASK-06`) realizuje checklista w zadaniu. Kolumna `tasks.parent_id` zostaje na przyszłość, ale interfejs jej nie używa.
- **Dlaczego:** dwie prawie identyczne listy (podzadania i checklista) myliłyby się ze sobą. Gdy krok wymaga własnego terminu, staje się osobnym zadaniem.

### D-14 · Powiadomienia liczone na bieżąco, bez kolejki
2026-11-09
- **Decyzja:** listę powiadomień zwraca funkcja `notifications_feed()` wyliczana z danych (przypomnienia, terminy, zaległości, publikacje, akceptacje). Tabela `notification_reads` pamięta tylko, co przeczytano. Aplikacja odpytuje co minutę i po powrocie do karty.
- **Dlaczego:** nie trzeba crona ani kolejki w Supabase, a powiadomienie nie może się „zgubić” ani zdublować. Powiadomienia systemowe (Web Push) wymagają wysyłki z serwera, więc dojdą w Etapie 6 z `pg_cron`.
- **Skutek:** klucz powiadomienia zawiera termin (np. `overdue:<id>:<czas>`), więc przesunięte i znów zaległe zadanie wraca jako nowe.

### D-13 · Klient wydarzenia = klient jego warstwy
2026-11-09
- **Decyzja:** wydarzenie nie ma osobnego wyboru klienta. Trigger `events_from_calendar` ustawia `workspace_id` i `client_id` na podstawie warstwy.
- **Dlaczego:** gdyby klienta wybierało się osobno, wydarzenie mogłoby leżeć w warstwie HELINAT, a należeć do innego klienta. Kolor w kalendarzu przestałby wtedy mówić prawdę.
- **Skutek:** przeniesienie wydarzenia do innej warstwy zmienia klienta. Wydarzenie na warstwie własnej lub „Zadania” nie ma klienta.

### D-12 · Kalendarz rozmawia z bazą bezpośrednio z przeglądarki
2026-11-09
- **Decyzja:** odczyt (`rpc calendar_items`) i zapisy w kalendarzu idą z przeglądarki przez `supabase-js`, a nie przez server actions. Kalendarz renderuje się tylko po stronie klienta (`next/dynamic`, `ssr: false`).
- **Dlaczego:** przeciąganie i przełączanie warstw musi działać natychmiast. RLS i tak pilnuje dostępu na poziomie bazy. Widok zależy od szerokości ekranu i ustawień z `localStorage`, więc wersja z serwera i tak różniłaby się od tej w przeglądarce.
- **Skutek:** szkielet ładowania przy wejściu; listę warstw i workspace'ów nadal dostarcza serwer.

### D-11 · FullCalendar 6
2026-11-09
- **Decyzja:** widoki kalendarza na FullCalendar 6.1 (wtyczki daygrid, timegrid, interaction; licencja MIT), wersje przypięte dokładnie.
- **Dlaczego:** dojrzałe przeciąganie myszą i dotykiem, polska lokalizacja, pełna kontrola nad wyglądem wpisów. Własny kalendarz z obsługą dotyku to tygodnie pracy. Wersja 7 ma nowe API (Temporal) i jest świeża, więc na razie zostajemy przy 6.
- **Skutek:** wygląd jest nadpisany tokenami w `kalendarz/calendar.css`. Ewentualna migracja na 7 to osobne zadanie.

### D-10 · Na razie bez Gmaila i Canvy
2026-11-09
- **Decyzja:** integracje w Etapach 5–6 to Dysk Google, Google Docs, ChatGPT, Slack i Trello. Gmail i Canva wypadają z zakresu.
- **Dlaczego:** dostęp do Gmaila to zakres „restricted” w Google, który wymaga corocznego, płatnego audytu bezpieczeństwa. Canva wymaga zgłoszenia aplikacji do recenzji.
- **Skutek:** linki do maili i projektów w Canvie można wklejać jak każdy inny link.

### D-09 · Plan dnia osobno od terminów
2026-11-09
- **Decyzja:** zadanie ma dwie daty: `planned_on` („zrobię to dziś”) i `due_at` („termin oddania”). Ekran „Dziś” to lista do odhaczania oparta na `planned_on`.
- **Dlaczego:** zadanie z terminem w piątek planuje się często na środę. Jedna data nie wystarcza do planowania dnia.

### D-08 · Google Calendar tylko na żądanie
2026-11-09
- **Decyzja:** ContentFlow jest głównym kalendarzem (źródłem prawdy). Z Google można jednorazowo **zaimportować** wydarzenia i jednorazowo **wysłać** je do Google, zawsze z wyborem konta. Nie ma synchronizacji w tle.
- **Dlaczego:** użytkownik chce zastąpić Google Calendar i planować w ContentFlow, a z Google korzystać tylko wtedy, kiedy sam zechce.
- **Skutek:** nie przechowujemy tokenów Google, bo zgoda jest jednorazowa, a token ważny około godziny. Odpada problem 7-dniowych tokenów w trybie testowym. Zaimportowane wydarzenia stają się zwykłymi wydarzeniami ContentFlow w wybranej warstwie. `external_id` chroni przed duplikatami.
- **Zastępuje:** wcześniejszy pomysł podpinania kont Google na stałe z odczytem na żywo.

### D-07 · Kalendarz jak Google Calendar: warstwy z checkboxami
2026-11-09
- **Decyzja:** jeden widok kalendarza pokazuje wszystkie workspace'y. W panelu bocznym każdy workspace ma swoje warstwy (klienci, „Zadania”, własne), które włącza się i wyłącza checkboxem.
- **Dlaczego:** tak użytkownik pracuje dziś w Google Calendar. Konflikty terminów powstają między firmami, więc trzeba je widzieć razem.
- **Skutek:** tabele `calendars` i `calendar_visibility` (widoczność per użytkownik, zsynchronizowana między urządzeniami).

### D-06 · Workspace = firma, klienci w środku
2026-11-09
- **Decyzja:** jeden użytkownik ma wiele workspace'ów (np. jeden na firmę). Klienci, content i zadania należą do workspace'u.
- **Dlaczego:** aplikacja jest dla wielu użytkowników (klienci, partnerka), a jedna osoba może prowadzić kilka firm.
- **Skutek:** `workspace_id` w każdej tabeli, RLS przez członkostwo, adresy `/w/<slug>/…`, przełącznik workspace'ów.

### D-05 · Pliki na Google Drive, tylko odnośniki
2026-11-09
- **Decyzja:** nie przechowujemy plików. Tabela `attachments` trzyma identyfikator, nazwę i link do pliku na Dysku. Wybór pliku odbywa się oknem Google Picker z zakresem `drive.file`.
- **Dlaczego:** użytkownik trzyma materiały na Dysku. Pełny dostęp do Dysku to zakres „restricted” z kosztownym audytem, a `drive.file` go nie wymaga.

### D-04 · Logowanie Google tylko z podstawowymi zakresami
2026-11-09
- **Decyzja:** logowanie prosi tylko o `openid email profile`. Dodatkowe uprawnienia (kalendarz, Dysk) są żądane osobno, w chwili użycia.
- **Dlaczego:** podstawowe zakresy nie wymagają weryfikacji aplikacji w Google, a szerokie uprawnienia przy samym logowaniu odstraszają.

### D-03 · Kolor = klient, kategoria = ikona
2026-11-09
- **Decyzja:** kolor wpisu w kalendarzu oznacza klienta. Kategoria (nagranie, montaż, publikacja…) jest ikoną i krótkim słowem. Kolory wybiera się z palety 12 sprawdzonych odcieni.
- **Dlaczego:** dwa systemy kolorów naraz robią z kalendarza nieczytelną mozaikę. Dowolny wybór koloru daje odcienie, które nie działają w ciemnym motywie.

### D-02 · Kalendarz czyta dane z wielu źródeł
2026-11-09
- **Decyzja:** kalendarz pokazuje wydarzenia, terminy zadań i terminy contentu przez jedną funkcję `calendar_items`. Przeciągnięcie zmienia rekord źródłowy.
- **Dlaczego:** wymóg specyfikacji („zmiana terminu w kalendarzu aktualizuje właściwy rekord źródłowy”) i brak duplikowania danych.

### D-01 · Next.js 16 + Supabase
2026-11-09
- **Decyzja:** stos zgodny ze specyfikacją. Next.js 16 z włączonym Cache Components.
- **Skutek:** sesja jest czytana po `await connection()`, trasy zależne od sesji mają `instant = false`, a moduły mają `loading.tsx`.
