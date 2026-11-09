import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Model Pomocnika: szybki i tani, wystarczy do odpowiedzi z przewodnika. */
export const ASSISTANT_MODEL = "claude-haiku-5-5";

let cached: string | null = null;

/**
 * Wiedza Pomocnika: przewodnik użytkownika i dziennik zmian.
 * Pliki są dołączane do funkcji na Vercelu przez outputFileTracingIncludes w next.config.ts.
 */
async function knowledge() {
  if (cached) return cached;
  const root = process.cwd();
  const [guide, changelog] = await Promise.all([
    readFile(path.join(root, "docs", "PRZEWODNIK.md"), "utf8"),
    readFile(path.join(root, "CHANGELOG.md"), "utf8"),
  ]);
  cached = `<przewodnik>\n${guide}\n</przewodnik>\n\n<dziennik_zmian>\n${changelog}\n</dziennik_zmian>`;
  return cached;
}

const INSTRUCTIONS = `Jesteś Pomocnikiem w aplikacji ContentFlow: planerze dla twórców treści, marketerów i agencji. Odpowiadasz użytkownikom na pytania, jak coś zrobić w aplikacji.

Zasady:
- Opieraj się wyłącznie na przewodniku i dzienniku zmian poniżej. Jeśli czegoś tam nie ma, powiedz wprost, że aplikacja tego (jeszcze) nie potrafi albo że nie wiesz, i zaproponuj najbliższą dostępną drogę. Nie wymyślaj przycisków ani funkcji.
- Pisz po polsku, krótko i konkretnie. Kroki podawaj jako numerowaną listę (1., 2., 3.). Nazwy przycisków i sekcji pisz w cudzysłowie „…”, dokładnie tak jak w aplikacji.
- Bez nagłówków, tabel i bloków kodu. Pogrubienia **tak** tylko dla najważniejszych nazw.
- Jeśli wiesz, na jakiej stronie jest użytkownik, uwzględnij to (np. „Jesteś już w Kalendarzu, więc…”).
- Nie masz dostępu do danych użytkownika i nie wykonujesz działań w aplikacji: tylko podpowiadasz.
- Pytania niezwiązane z ContentFlow zbywaj uprzejmie jednym zdaniem i wracaj do aplikacji.`;

export async function assistantSystem() {
  return `${INSTRUCTIONS}\n\n${await knowledge()}`;
}

/** Czytelna nazwa modułu na podstawie ścieżki, jako kontekst dla modelu. */
export function describePath(pathname: string) {
  const m = pathname.match(/^\/w\/[^/]+\/?([^/?#]*)(\/[^?#]*)?/);
  if (!m) return null;
  const names: Record<string, string> = {
    "": "Dziś",
    dzis: "Dziś (plan dnia)",
    kalendarz: "Kalendarz",
    content: "Content (materiały)",
    zadania: "Zadania",
    klienci: "Klienci",
    projekty: "Projekty",
    pomysly: "Notatki i pomysły",
    podsumowanie: "Podsumowanie",
    ustawienia: "Ustawienia",
  };
  const name = names[m[1]];
  if (!name) return null;
  return m[2] && m[2] !== "/" ? `${name}, strona szczegółów` : name;
}
