import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Regulamin",
  description: "Warunki korzystania z aplikacji ContentFlow.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Regulamin">
      <p>
        Regulamin określa zasady korzystania z aplikacji {LEGAL.appName} dostępnej pod adresem <a href={LEGAL.appUrl}>{LEGAL.appUrl}</a>. Zakładając konto
        albo korzystając z aplikacji, akceptujesz regulamin i <Link href="/polityka-prywatnosci">politykę prywatności</Link>.
      </p>

      <h2>1. Usługodawca i kontakt</h2>
      <p>
        Usługodawcą jest {LEGAL.operator}. Kontakt: <ContactEmail />.
      </p>

      <h2>2. Czym jest ContentFlow</h2>
      <p>
        {LEGAL.appName} to aplikacja internetowa do planowania pracy twórców treści, marketerów i agencji: kalendarz, plan dnia, zadania, produkcja materiałów,
        notatki i pomysły, akceptacja materiałów przez klientów oraz integracje z usługami Google, Trello i Slack. Aplikacja jest udostępniana bezpłatnie.
      </p>

      <h2>3. Konto</h2>
      <ul>
        <li>Konto zakładasz, logując się przez Google albo adresem e-mail i hasłem.</li>
        <li>Odpowiadasz za poufność danych logowania i za działania wykonane z Twojego konta.</li>
        <li>Właściciel workspace&apos;u decyduje o jego ustawieniach i podłączonych integracjach.</li>
        <li>Możesz w każdej chwili przestać korzystać z aplikacji i poprosić o usunięcie konta, pisząc na adres kontaktowy.</li>
      </ul>

      <h2>4. Zasady korzystania</h2>
      <p>Zabronione jest w szczególności:</p>
      <ul>
        <li>umieszczanie treści bezprawnych, naruszających prawa innych osób lub dane osobowe bez podstawy prawnej;</li>
        <li>próby uzyskania dostępu do cudzych danych, obchodzenia zabezpieczeń lub zakłócania działania aplikacji;</li>
        <li>wykorzystywanie aplikacji do wysyłania spamu lub automatycznego, masowego obciążania usług.</li>
      </ul>
      <p>
        Wpisując do aplikacji dane swoich klientów (np. dane kontaktowe), odpowiadasz za to, że masz podstawę do ich przetwarzania. W tym zakresie{" "}
        {LEGAL.operator} przetwarza te dane w Twoim imieniu, wyłącznie aby świadczyć usługę.
      </p>

      <h2>5. Treści użytkownika</h2>
      <p>
        Treści, które dodajesz, należą do Ciebie. Udzielasz usługodawcy zgody na ich przechowywanie i przetwarzanie wyłącznie w zakresie potrzebnym do
        działania aplikacji (np. wyświetlenia ich członkom workspace&apos;u, wysłania na podłączoną tablicę Trello lub kanał Slacka).
      </p>

      <h2>6. Integracje i usługi zewnętrzne</h2>
      <p>
        Funkcje korzystające z Google, Trello, Slacka i Pomocnika AI działają na podstawie usług tych dostawców i ich regulaminów. Dostęp do konta Google
        możesz cofnąć w ustawieniach konta Google, a integracje Trello i Slack odłączyć w Ustawieniach aplikacji. Odpowiedzi Pomocnika AI są generowane
        automatycznie i mogą zawierać błędy.
      </p>

      <h2>7. Dostępność i odpowiedzialność</h2>
      <ul>
        <li>Dokładamy starań, by aplikacja działała bez przerw, ale nie gwarantujemy ciągłej dostępności. Możliwe są przerwy techniczne i zmiany funkcji.</li>
        <li>Zalecamy przechowywanie ważnych plików w ich źródłowym miejscu (np. na Dysku Google); aplikacja przechowuje do nich odnośniki.</li>
        <li>
          W granicach dozwolonych przez prawo usługodawca nie odpowiada za szkody wynikłe z przerw w działaniu, utraty danych z przyczyn niezależnych od niego
          ani z działania usług zewnętrznych. Nie wyłącza to praw konsumenta wynikających z przepisów bezwzględnie obowiązujących.
        </li>
      </ul>

      <h2>8. Reklamacje</h2>
      <p>
        Uwagi i reklamacje dotyczące działania aplikacji wyślij na <ContactEmail />, opisując problem. Odpowiemy w ciągu 14 dni.
      </p>

      <h2>9. Zakończenie korzystania</h2>
      <p>
        Usługodawca może zablokować konto, które narusza regulamin, po wcześniejszym wezwaniu do zaprzestania naruszeń (chyba że naruszenie jest rażące).
        Możesz zakończyć korzystanie z aplikacji w każdej chwili.
      </p>

      <h2>10. Postanowienia końcowe</h2>
      <p>
        Regulamin podlega prawu polskiemu. O istotnych zmianach regulaminu poinformujemy w aplikacji z co najmniej 7-dniowym wyprzedzeniem. Aktualna wersja
        jest zawsze dostępna na tej stronie.
      </p>
    </LegalPage>
  );
}
