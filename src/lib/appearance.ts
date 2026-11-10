/**
 * Wygląd aplikacji (D-36): wariant stylu i kolor akcentu, zapamiętane na urządzeniu (localStorage).
 * Atrybuty data-style i data-accent na <html> ustawia skrypt w layout.tsx przed pierwszym malowaniem.
 */
export const STYLES = [
  { key: "soft", label: "Delikatny", hint: "Pastelowe tło, białe karty, zaokrąglenia" },
  { key: "contrast", label: "Kontrastowy", hint: "Białe tło, czarne przyciski, mocne paski" },
  { key: "warm", label: "Ciepły beżowy", hint: "Papierowe tło, przygaszone kolory" },
] as const;

export const ACCENTS = [
  { key: "rose", label: "Róż", swatch: "oklch(0.68 0.12 355)" },
  { key: "lilac", label: "Liliowy", swatch: "oklch(0.66 0.11 305)" },
  { key: "sage", label: "Szałwia", swatch: "oklch(0.66 0.07 150)" },
  { key: "sky", label: "Błękit", swatch: "oklch(0.68 0.09 235)" },
  { key: "peach", label: "Brzoskwinia", swatch: "oklch(0.74 0.11 50)" },
  { key: "graphite", label: "Grafit", swatch: "oklch(0.5 0.01 85)" },
] as const;

export type StyleKey = (typeof STYLES)[number]["key"];
export type AccentKey = (typeof ACCENTS)[number]["key"];

export const DEFAULT_STYLE: StyleKey = "soft";
export const DEFAULT_ACCENT: AccentKey = "rose";

const STYLE_KEY = "cf-style";
const ACCENT_KEY = "cf-accent";

/** Skrypt wstawiany do <head>: ustawia motyw, wariant i akcent, zanim strona się namaluje. */
export const appearanceScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('cf-theme');var dark=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);d.dataset.theme=dark?'dark':'light';var s=localStorage.getItem('${STYLE_KEY}');if(s==='soft'||s==='contrast'||s==='warm')d.dataset.style=s;var a=localStorage.getItem('${ACCENT_KEY}');if(/^(rose|lilac|sage|sky|peach|graphite)$/.test(a||''))d.dataset.accent=a}catch(e){}})()`;

const listeners = new Set<() => void>();

/** Wygląd zapisany na koncie (profiles.settings.appearance) — taki sam na każdym urządzeniu. */
export type SavedAppearance = { style?: StyleKey; accent?: AccentKey; theme?: "light" | "dark" | "system" };

// Zapis na koncie ustawia AppearanceSync (powłoka aplikacji); bez niego zmiany zostają tylko na urządzeniu.
let persist: ((a: SavedAppearance) => void) | null = null;
export function setAppearancePersist(fn: ((a: SavedAppearance) => void) | null) {
  persist = fn;
}

function readTheme(): SavedAppearance["theme"] {
  try {
    const v = localStorage.getItem("cf-theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Wywoływane po każdej zmianie stylu, koloru lub trybu: zapis na koncie. */
export function persistAppearance() {
  persist?.({ style: readStyle(), accent: readAccent(), theme: readTheme() });
}

/** Ustawienia z konta → urządzenie (localStorage i atrybuty <html>), bez ponownego zapisu na koncie. */
export function applySavedAppearance(a: SavedAppearance) {
  const d = document.documentElement;
  try {
    if (a.style && STYLES.some((s) => s.key === a.style)) {
      localStorage.setItem(STYLE_KEY, a.style);
      d.dataset.style = a.style;
    }
    if (a.accent && ACCENTS.some((x) => x.key === a.accent)) {
      localStorage.setItem(ACCENT_KEY, a.accent);
      d.dataset.accent = a.accent;
    }
    if (a.theme === "light" || a.theme === "dark" || a.theme === "system") {
      localStorage.setItem("cf-theme", a.theme);
      const dark = a.theme === "dark" || (a.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      d.dataset.theme = dark ? "dark" : "light";
    }
  } catch {}
  listeners.forEach((l) => l());
}

function readKey<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export const readStyle = () => readKey<StyleKey>(STYLE_KEY, STYLES.map((s) => s.key), DEFAULT_STYLE);
export const readAccent = () => readKey<AccentKey>(ACCENT_KEY, ACCENTS.map((a) => a.key), DEFAULT_ACCENT);

export function setStyle(style: StyleKey) {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {}
  document.documentElement.dataset.style = style;
  listeners.forEach((l) => l());
  persistAppearance();
}

export function setAccent(accent: AccentKey) {
  try {
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {}
  document.documentElement.dataset.accent = accent;
  listeners.forEach((l) => l());
  persistAppearance();
}

export function subscribeAppearance(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
