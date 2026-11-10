import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description: "Jak ContentFlow przetwarza dane osobowe, w tym dane z kont Google.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Polityka prywatności">
      <p>
        Ta polityka opisuje, jakie dane przetwarza aplikacja {LEGAL.appName} dostępna pod adresem <a href={LEGAL.appUrl}>{LEGAL.appUrl}</a>, w jakim celu i
        komu je powierzamy. Dotyczy wszystkich osób, które korzystają z aplikacji, oraz klientów, którzy otwierają link do akceptacji materiału.
      </p>

      <h2>1. Administrator danych</h2>
      <p>
        Administratorem danych osobowych jest {LEGAL.operator}. Kontakt w sprawie danych osobowych i aplikacji: <ContactEmail />.
      </p>

      <h2>2. Jakie dane przetwarzamy</h2>
      <ul>
        <li>
          <strong>Dane konta:</strong> adres e-mail, imię i nazwisko oraz zdjęcie profilowe (przy logowaniu przez Google), hasło w postaci zaszyfrowanej
          (przy logowaniu e-mailem).
        </li>
        <li>
          <strong>Treści, które dodajesz:</strong> workspace&apos;y, klienci (w tym ich dane kontaktowe, które wpiszesz), projekty, wydarzenia, zadania,
          checklisty, materiały, scenariusze, notatki, pomysły, linki do plików i zdjęcia dodane do wydarzeń.
        </li>
        <li>
          <strong>Dane klientów odpowiadających na prośbę o akceptację:</strong> podane dobrowolnie imię i komentarz oraz decyzja (akceptacja lub prośba o
          poprawki).
        </li>
        <li>
          <strong>Dane techniczne:</strong> ciasteczka sesji logowania, subskrypcje powiadomień push na urządzeniach, na których je włączysz, oraz ustawienia
          zapisane w przeglądarce (motyw, wygląd, widok tablicy).
        </li>
      </ul>

      <h2>3. Dane z kont Google</h2>
      <p>Aplikacja korzysta z usług Google wyłącznie w zakresie potrzebnym do funkcji, które sam uruchomisz:</p>
      <ul>
        <li>
          <strong>Logowanie przez Google</strong> (zakresy <code>openid</code>, <code>email</code>, <code>profile</code>): adres e-mail, imię i nazwisko oraz
          zdjęcie profilowe do utworzenia i wyświetlania konta.
        </li>
        <li>
          <strong>Dysk Google i Google Docs</strong> (zakres <code>drive.file</code>): dostęp wyłącznie do plików, które wskażesz w oknie wyboru Google, oraz do
          dokumentów utworzonych przez aplikację (eksport scenariusza). Aplikacja zapisuje tylko nazwę i link do pliku.
        </li>
        <li>
          <strong>Kalendarz Google</strong> (zakresy <code>calendar.calendarlist.readonly</code> i <code>calendar.events</code>): na Twoje żądanie lista
          kalendarzy, import wydarzeń do ContentFlow i wysłanie wydarzeń z ContentFlow do wybranego kalendarza. Nie ma automatycznej, ciągłej synchronizacji.
        </li>
      </ul>
      <p>
        Tokeny dostępu Google są przechowywane tylko w pamięci przeglądarki do czasu ich wygaśnięcia; nie zapisujemy ich na serwerze. Dane z Google nie są
        sprzedawane, nie służą do reklam ani do trenowania modeli sztucznej inteligencji i nie są przekazywane innym podmiotom poza dostawcami opisanymi w
        punkcie 5, w zakresie potrzebnym do działania aplikacji.
      </p>
      <p>
        Korzystanie przez {LEGAL.appName} z informacji otrzymanych z interfejsów API Google i ich przekazywanie do innych aplikacji jest zgodne z{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Zasadami dotyczącymi danych użytkownika w usługach interfejsów API Google
        </a>
        , w tym z wymogami dotyczącymi ograniczonego użytkowania (Limited Use).
      </p>
      <p>
        Dostęp aplikacji do konta Google możesz w każdej chwili cofnąć na stronie{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2>4. Cele i podstawy przetwarzania</h2>
      <ul>
        <li>świadczenie usługi i prowadzenie konta (art. 6 ust. 1 lit. b RODO — wykonanie umowy, czyli korzystanie z aplikacji na zasadach regulaminu);</li>
        <li>wysyłanie przypomnień i powiadomień, które włączysz (art. 6 ust. 1 lit. b RODO);</li>
        <li>zapewnienie bezpieczeństwa, wykrywanie nadużyć i obsługa zgłoszeń (art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes);</li>
        <li>obsługa odpowiedzi klienta na prośbę o akceptację (art. 6 ust. 1 lit. f RODO — interes użytkownika, który wysłał prośbę).</li>
      </ul>

      <h2>5. Komu powierzamy dane</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — baza danych, logowanie i przechowywanie zdjęć; serwery w Unii Europejskiej (Frankfurt).
        </li>
        <li>
          <strong>Vercel</strong> — hosting aplikacji; funkcje serwerowe we Frankfurcie, statyczne pliki dostarczane przez globalną sieć.
        </li>
        <li>
          <strong>Google</strong> — logowanie oraz funkcje Dysku, Docs i Kalendarza, gdy z nich korzystasz.
        </li>
        <li>
          <strong>Anthropic</strong> — treść pytań zadanych Pomocnikowi AI i nazwa otwartej strony aplikacji, w celu wygenerowania odpowiedzi. Pomocnik nie ma
          dostępu do Twoich danych w aplikacji ani do danych z Google.
        </li>
        <li>
          <strong>Trello (Atlassian)</strong> i <strong>Slack</strong> — tylko gdy właściciel workspace&apos;u podłączy integrację: zadania (tytuł, opis,
          termin, checklista) trafiają na wybraną tablicę Trello, a plany dnia, przypomnienia i podsumowania na wybrany kanał Slacka.
        </li>
        <li>
          <strong>Dostawcy powiadomień push</strong> (np. Apple, Google, Mozilla) — treść powiadomienia, gdy włączysz powiadomienia na urządzeniu.
        </li>
      </ul>
      <p>
        Część dostawców może przetwarzać dane poza Europejskim Obszarem Gospodarczym; odbywa się to na podstawie standardowych klauzul umownych zatwierdzonych
        przez Komisję Europejską lub innych mechanizmów przewidzianych w RODO.
      </p>

      <h2>6. Kto widzi Twoje dane</h2>
      <p>
        Treści w workspace&apos;ie widzą wyłącznie jego członkowie. Klient, któremu wyślesz link do akceptacji, widzi tylko udostępniony materiał (scenariusz,
        publikacje i linki do plików) do czasu wygaśnięcia lub wycofania linku.
      </p>

      <h2>7. Jak długo przechowujemy dane</h2>
      <p>
        Dane konta i treści przechowujemy do czasu usunięcia ich przez Ciebie albo usunięcia konta. Linki do akceptacji wygasają po 30 dniach. Kopie
        zapasowe bazy danych są nadpisywane w cyklu dostawcy (Supabase).
      </p>

      <h2>8. Twoje prawa</h2>
      <p>
        Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia oraz wniesienia sprzeciwu. Aby skorzystać
        z tych praw albo usunąć konto, napisz na <ContactEmail />. Masz też prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2,
        00-193 Warszawa).
      </p>

      <h2>9. Ciasteczka i pamięć przeglądarki</h2>
      <p>
        Używamy wyłącznie ciasteczek niezbędnych do utrzymania sesji logowania. Ustawienia wyglądu i widoków zapisujemy w pamięci przeglądarki (localStorage)
        na Twoim urządzeniu. Nie używamy ciasteczek reklamowych ani narzędzi analitycznych firm trzecich.
      </p>

      <h2>10. Bezpieczeństwo</h2>
      <p>
        Połączenia są szyfrowane (HTTPS), dostęp do danych w bazie ogranicza się do członków workspace&apos;u, a klucze integracji (np. Slack, Trello) są
        przechowywane wyłącznie po stronie serwera.
      </p>

      <h2>11. Zmiany polityki</h2>
      <p>
        O istotnych zmianach poinformujemy w aplikacji. Aktualna wersja jest zawsze dostępna na tej stronie. Zasady korzystania z aplikacji opisuje{" "}
        <Link href="/regulamin">regulamin</Link>.
      </p>
    </LegalPage>
  );
}
