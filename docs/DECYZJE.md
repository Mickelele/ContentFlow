# Dziennik decyzji

Krótko: co zdecydowaliśmy, dlaczego i co z tego wynika. Najnowsze na górze.
Nie usuwamy starych wpisów. Gdy decyzja się zmienia, dodajemy nową i oznaczamy starą jako „zastąpiona przez D-xx”.

---

### D-31 · Pomocnik AI: Claude Haiku 5.5 z przewodnikiem w prompcie
2026-11-09
- **Decyzja:** Pomocnik to czat w powłoce aplikacji. Endpoint `/api/pomocnik` (tylko dla zalogowanych) wysyła do `claude-haiku-5-5` prompt systemowy z instrukcją i pełną treścią `docs/PRZEWODNIK.md` + `CHANGELOG.md` (z cache'owaniem promptu), effort `low`, odpowiedź strumieniem tekstu. Bieżąca strona trafia do ostatniego pytania. Pomocnik nie ma dostępu do danych użytkownika ani narzędzi.
- **Dlaczego:** dokumentacja jest mała (kilka tysięcy tokenów), więc cała mieści się w prompcie i nie potrzeba wyszukiwania (RAG). Haiku wybrał użytkownik: szybki i tani. Bez narzędzi nie ma ryzyka, że AI coś zmieni.
- **Skutek:** każda zmiana widoczna dla użytkownika wymaga aktualizacji `docs/PRZEWODNIK.md`, inaczej Pomocnik będzie podpowiadał nieaktualnie. Limit 40 pytań na godzinę na osobę i instancję serwera; twardy limit wydatków ustawia się w konsoli Anthropic.

### D-30 · Statystyki liczone w przeglądarce, tydzień od poniedziałku
2026-11-09
- **Decyzja:** podsumowanie pobiera surowe dane tygodnia (zadania, publikacje, terminy, wydarzenia) i liczy w przeglądarce, w jej strefie czasowej. Porównanie zawsze z poprzednim tygodniem.
- **Dlaczego:** granice dnia i tygodnia zależą od strefy użytkownika; dane jednego tygodnia są małe, więc osobne agregaty w bazie nie są potrzebne.

### D-29 · Akceptacja klienta przez link z tokenem, bez konta
2026-11-09
- **Decyzja:** prośba o akceptację tworzy losowy token (2× UUID v4) i migawkę scenariusza (`script_versions`). Strona `/akceptacja/[token]` i zapis odpowiedzi działają po stronie serwera kluczem serwisowym; przez API token nie daje dostępu. Link wygasa po 30 dniach, można go wycofać.
- **Dlaczego:** klienci nie mają kont w ContentFlow, a akceptacja musi być prosta (jeden link, jeden przycisk). Migawka gwarantuje, że klient akceptuje dokładnie tę wersję, którą widział.
- **Skutek:** akceptacja odhacza termin „akceptacja” i przesuwa etap na „zaplanowano”; poprawki cofają etap na „montaż”.

### D-28 · Tablica Kanban zadań z osobną kolejnością
2026-11-09
- **Decyzja:** Zadania mają widok tablicy (domyślny) i listy. Kolumny = statusy zadania (`todo`, `in_progress`, `done`); przeciągnięcie zmienia status, kolejność w kolumnie trzyma `tasks.board_position` (co 1024), niezależnie od `position` w planie dnia.
- **Dlaczego:** użytkownik chce pracować jak w Jirze; jedna kolumna kolejności dla planu dnia i tablicy mieszałaby dwa różne porządki.
- **Skutek:** kolumna „Ukończone” pokazuje 30 ostatnich; dodatkowe kolumny (np. „Do sprawdzenia”) wymagają nowego statusu w `task_status`.

### D-27 · Synchronizacja na żywo = ponowne pobranie po zmianie
2026-11-09
- **Decyzja:** Supabase Realtime powiadamia o zmianach w tabelach (z RLS), a widok pobiera dane od nowa (z opóźnieniem 0,5 s, także po powrocie do karty). Nie scalamy zmian po kawałku.
- **Dlaczego:** proste i odporne — jedno źródło prawdy (zapytanie widoku), brak rozjazdów przy złożonych danych (`calendar_items`, plan dnia).
- **Skutek:** praca offline z kolejką zmian zostaje na później.

### D-26 · Trello przez plik JSON, nie przez API
2026-11-09
- **Decyzja:** import tablicy z eksportu JSON (dostępnego w każdej tablicy Trello). `tasks.external_id = trello:<id karty>` chroni przed duplikatami.
- **Dlaczego:** zero konfiguracji, żadnych kluczy ani tokenów Trello do przechowywania; zgodne z zasadą „na żądanie”.

### D-25 · Przypomnienia z serwera: pg_cron → endpoint w Vercelu
2026-11-09
- **Decyzja:** co minutę `pg_cron` + `pg_net` w Supabase wywołuje `/api/cron/reminders` (nagłówek `Bearer CRON_SECRET`). Endpoint wysyła Web Push (VAPID, biblioteka `web-push`) i opcjonalnie Slacka, oznacza `reminders.sent_at` i `events.slack_notified_at`.
- **Dlaczego:** cron w darmowym planie Vercela działa tylko raz dziennie; Supabase ma cron co minutę bez dodatkowych usług.
- **Skutek:** przypomnienia starsze niż 2 godziny są pomijane (po awarii nie zasypujemy powiadomieniami).

### D-24 · PWA bez pamięci podręcznej stron
2026-11-09
- **Decyzja:** service worker (`public/sw.js`) służy instalacji i powiadomieniom push; nie przechowuje stron ani danych.
- **Dlaczego:** dane muszą być aktualne między urządzeniami; cache stron w aplikacji z sesją i RLS to ryzyko pokazania starych lub cudzych danych.

### D-23 · Hosting na Vercelu z automatycznym wdrażaniem z main
2026-11-09
- **Decyzja:** aplikacja działa na Vercelu (`contentflow-pi-ten.vercel.app`), każdy push na `main` wdraża nową wersję. Lokalna praca i produkcja korzystają z tej samej bazy Supabase.
- **Dlaczego:** Vercel to natywne środowisko Next.js (proxy, server actions, Cache Components działają bez konfiguracji), a wdrażanie z GitHuba nie wymaga żadnych skryptów.
- **Skutek:** przed pushem na `main` musi przechodzić `npm run build`. Wspólna baza oznacza, że dane testowe z pracy lokalnej widać na produkcji — przy pierwszych prawdziwych klientach warto założyć osobny projekt Supabase na środowisko deweloperskie.

### D-22 · ChatGPT przez gotowe polecenia, bez klucza API
2026-11-09
- **Decyzja:** integracja z ChatGPT to linki `chatgpt.com/?q=…` z poleceniem zbudowanym z danych materiału lub pomysłu (oraz kopiowanie polecenia). AI wbudowane w aplikację (własny klucz API, odpowiedź wklejana od razu w scenariusz) zostaje na później.
- **Dlaczego:** działa od ręki, bez kosztów i bez przechowywania klucza; użytkownik korzysta ze swojego konta ChatGPT.

### D-21 · Dysk i Docs po stronie przeglądarki, zakres drive.file
2026-11-09
- **Decyzja:** Google Identity Services wydaje krótkotrwały token w przeglądarce (bez zapisu), Picker wybiera pliki, Drive API tworzy Google Docs z HTML scenariusza. Zakres tylko `drive.file`.
- **Dlaczego:** spójne z D-05 i D-08 — nic nie przechowujemy, a `drive.file` nie wymaga audytu jak pełny dostęp do Dysku.
- **Skutek:** potrzebny klucz API (ograniczony do domeny) i numer projektu; bez nich przyciski są ukryte.

### D-20 · Webhook Slacka jako sekret bez odczytu
2026-11-09
- **Decyzja:** webhook leży w `workspace_secrets` bez polityki SELECT. Zapis tylko przez funkcję `set_slack_webhook` (właściciel), stan przez `integration_status` (bez ujawniania adresu). Wysyłka z server actions kluczem serwisowym po sprawdzeniu członkostwa.
- **Dlaczego:** kto zna webhook, może pisać na kanał. Członkowie mają móc wysyłać plan dnia, ale nie poznać adresu.
- **Skutek:** zmienna `SUPABASE_SECRET_KEY` musi być ustawiona na serwerze produkcyjnym.

### D-19 · Klient projektu przechodzi na materiał i zadanie
2026-11-09
- **Decyzja:** trigger `project_client_check` pilnuje, żeby projekt był z tego samego workspace'u, a materiał lub zadanie bez klienta przejmuje klienta projektu.
- **Dlaczego:** materiał z projektu HELINAT bez klienta nie miałby koloru w kalendarzu.

### D-18 · Notatki i pomysły w jednym module
2026-11-09
- **Decyzja:** moduł „Notatki i pomysły” (`/pomysly`) ma dwa widoki. Notatki mają formatowanie i mogą być podpięte pod wydarzenie. Pomysły to lekkie rekordy (tytuł, opis, link, tagi), które jednym kliknięciem stają się materiałem.
- **Dlaczego:** oba służą do „złapania myśli”, ale pomysł ma prowadzić do materiału, a notatka zostaje notatką. Osobne pozycje w menu zabierałyby miejsce na telefonie.
- **Skutek:** zamieniony pomysł ma status `converted` i odnośnik `content_id`, link do inspiracji trafia do plików materiału.

### D-17 · Tiptap jako edytor tekstu
2026-11-09
- **Decyzja:** scenariusze i notatki piszemy w Tiptap 3.31 (StarterKit, checklisty). Dokument zapisujemy jako JSON (`body`); w notatkach dodatkowo czysty tekst (`body_text`) do wyszukiwania. Zapis automatyczny po 0,8 s bez zmian.
- **Dlaczego:** potrzebne są nagłówki, listy i checklisty, a zwykłe pole tekstowe tego nie daje. JSON da się później wersjonować (`CON-12`) i przetwarzać (AI).

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
