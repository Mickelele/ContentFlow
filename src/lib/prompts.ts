import { CONTENT_TYPES, PLATFORM_LIST, type ContentType, type Platform } from "@/lib/content";

/** Polecenia do ChatGPT budowane z danych materiału. Otwierane w nowej karcie z gotowym tekstem. */
export type PromptItem = { key: string; label: string; hint: string; prompt: string };

const MAX_CONTEXT = 2500;
const clip = (t: string) => (t.length > MAX_CONTEXT ? `${t.slice(0, MAX_CONTEXT)}…` : t);

export function materialPrompts(m: {
  title: string;
  type: ContentType;
  client?: string | null;
  platforms: Platform[];
  script?: string;
}): PromptItem[] {
  const typ = CONTENT_TYPES[m.type].label.toLowerCase();
  const dla = m.client ? ` dla marki ${m.client}` : "";
  const gdzie = m.platforms.length ? m.platforms.map((p) => PLATFORM_LIST.find((x) => x.key === p)?.label).join(", ") : "Instagram i TikTok";
  const kontekst = m.script?.trim() ? `\n\nObecny scenariusz:\n${clip(m.script.trim())}` : "";

  return [
    {
      key: "hooks",
      label: "Hooki",
      hint: "5 otwarć na pierwsze 3 sekundy",
      prompt: `Napisz 5 hooków (pierwsze 3 sekundy) do materiału typu ${typ}${dla} na temat „${m.title}”. Każdy w innym stylu: pytanie, liczba, kontrowersja, obietnica, historia. Krótko, po polsku, bez emoji.${kontekst}`,
    },
    {
      key: "script",
      label: m.script?.trim() ? "Popraw scenariusz" : "Scenariusz",
      hint: "Hook, rozwinięcie, wezwanie do działania",
      prompt: m.script?.trim()
        ? `Popraw scenariusz materiału typu ${typ}${dla} „${m.title}”. Zachowaj strukturę hook – rozwinięcie – wezwanie do działania, skróć do 30–45 sekund mówienia i dopisz wskazówki, co pokazać w kadrze.${kontekst}`
        : `Napisz scenariusz materiału typu ${typ}${dla} na temat „${m.title}”. 30–45 sekund mówienia. Struktura: hook (3 s), rozwinięcie w 3 punktach, wezwanie do działania. Przy każdym fragmencie dopisz, co pokazać w kadrze.`,
    },
    {
      key: "caption",
      label: "Opis i hashtagi",
      hint: `Opis posta na ${gdzie}`,
      prompt: `Napisz opis posta na ${gdzie}${dla} do materiału „${m.title}”. Pierwsze zdanie ma zatrzymać przewijanie, potem 2–3 krótkie akapity i pytanie do odbiorców. Na końcu 12 hashtagów: mieszanka popularnych i niszowych, po polsku i angielsku.${kontekst}`,
    },
    {
      key: "shots",
      label: "Lista ujęć",
      hint: "Co nagrać na planie",
      prompt: `Przygotuj listę ujęć do nagrania materiału typu ${typ} „${m.title}”${dla}. Dla każdego ujęcia: plan (zbliżenie / plan średni / szeroki), co widać, ruch kamery i czas trwania. Uwzględnij przebitki (B-roll).${kontekst}`,
    },
  ];
}

export function ideaPrompts(i: { title: string; description?: string | null; client?: string | null }): PromptItem[] {
  const dla = i.client ? ` dla marki ${i.client}` : "";
  const opis = i.description?.trim() ? `\n\nNotatka do pomysłu: ${clip(i.description.trim())}` : "";
  return [
    {
      key: "expand",
      label: "Rozwiń pomysł",
      hint: "3 sposoby realizacji",
      prompt: `Mam pomysł na materiał do social media${dla}: „${i.title}”. Zaproponuj 3 różne sposoby realizacji (format, kąt, hook, długość) i oceń, który ma największy potencjał zasięgowy i dlaczego.${opis}`,
    },
    {
      key: "series",
      label: "Seria materiałów",
      hint: "5 odcinków z jednego pomysłu",
      prompt: `Rozpisz pomysł „${i.title}”${dla} na serię 5 krótkich materiałów (rolek). Dla każdego: tytuł, hook i jedno zdanie o treści.${opis}`,
    },
  ];
}

export const chatGptUrl = (prompt: string) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
