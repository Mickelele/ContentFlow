/**
 * Rozpoznawanie serwisu po adresie linku — bez pobierania strony.
 * Dla każdego serwisu: nazwa, rodzaj (do ikony) i kolor znaku (marki są rozpoznawalne po kolorze).
 */
export type LinkKind =
  | "gdoc"
  | "gsheet"
  | "gslides"
  | "gform"
  | "gdrive"
  | "trello"
  | "slack"
  | "canva"
  | "figma"
  | "notion"
  | "dropbox"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "linkedin"
  | "meet"
  | "zoom"
  | "teams"
  | "chatgpt"
  | "web";

export type LinkInfo = { kind: LinkKind; service: string; url: string; host: string };

const RULES: { kind: LinkKind; service: string; test: (u: URL) => boolean }[] = [
  { kind: "gdoc", service: "Google Docs", test: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/document") },
  { kind: "gsheet", service: "Google Sheets", test: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/spreadsheets") },
  { kind: "gslides", service: "Google Slides", test: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/presentation") },
  { kind: "gform", service: "Google Forms", test: (u) => u.hostname === "docs.google.com" && u.pathname.startsWith("/forms") },
  { kind: "gdrive", service: "Dysk Google", test: (u) => u.hostname === "drive.google.com" },
  { kind: "trello", service: "Trello", test: (u) => u.hostname.endsWith("trello.com") },
  { kind: "slack", service: "Slack", test: (u) => u.hostname.endsWith("slack.com") },
  { kind: "canva", service: "Canva", test: (u) => u.hostname.endsWith("canva.com") },
  { kind: "figma", service: "Figma", test: (u) => u.hostname.endsWith("figma.com") },
  { kind: "notion", service: "Notion", test: (u) => u.hostname.endsWith("notion.so") || u.hostname.endsWith("notion.site") },
  { kind: "dropbox", service: "Dropbox", test: (u) => u.hostname.endsWith("dropbox.com") },
  { kind: "youtube", service: "YouTube", test: (u) => /(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname) },
  { kind: "instagram", service: "Instagram", test: (u) => u.hostname.endsWith("instagram.com") },
  { kind: "tiktok", service: "TikTok", test: (u) => u.hostname.endsWith("tiktok.com") },
  { kind: "facebook", service: "Facebook", test: (u) => u.hostname.endsWith("facebook.com") || u.hostname === "fb.watch" },
  { kind: "linkedin", service: "LinkedIn", test: (u) => u.hostname.endsWith("linkedin.com") },
  { kind: "meet", service: "Google Meet", test: (u) => u.hostname === "meet.google.com" },
  { kind: "zoom", service: "Zoom", test: (u) => u.hostname.endsWith("zoom.us") },
  { kind: "teams", service: "Microsoft Teams", test: (u) => u.hostname.startsWith("teams.") },
  { kind: "chatgpt", service: "ChatGPT", test: (u) => u.hostname === "chatgpt.com" || u.hostname === "chat.openai.com" },
];

/** Dopisuje https:// do adresu bez protokołu; zwraca null dla niepoprawnych. */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

export function linkInfo(raw: string): LinkInfo {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    const rule = RULES.find((r) => r.test(u));
    return { kind: rule?.kind ?? "web", service: rule?.service ?? host, url: u.toString(), host };
  } catch {
    return { kind: "web", service: raw, url: raw, host: raw };
  }
}

/** Domyślna nazwa linku, gdy użytkownik jej nie podał: „Google Docs”, „Trello”, „example.com”. */
export const defaultLinkName = (url: string) => linkInfo(url).service;
