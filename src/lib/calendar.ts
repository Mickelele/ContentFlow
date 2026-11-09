import { BadgeCheck, CheckSquare, Circle, Scissors, Send, Users, Video, type LucideIcon } from "lucide-react";
import type { ClientColor } from "@/lib/palette";

/** Zdarzenie okna wysyłane przez dolny pasek („+ → Wydarzenie”), gdy kalendarz jest już otwarty. */
export const NEW_EVENT = "cf:new-event";

export type LayerKind = "client" | "tasks" | "custom" | "google";

export type Layer = {
  id: string;
  workspaceId: string;
  kind: LayerKind;
  name: string;
  color: ClientColor;
  position: number;
  visible: boolean;
};

export type WorkspaceLayers = { id: string; name: string; slug: string; color: ClientColor; layers: Layer[] };

export type SourceType = "event" | "task" | "milestone" | "publication";

export type CalendarItem = {
  source_type: SourceType;
  source_id: string;
  workspace_id: string;
  calendar_id: string;
  client_id: string | null;
  content_id: string | null;
  title: string;
  category: Category;
  status: string;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  location: string | null;
  url: string | null;
  description: string | null;
  platform: string | null;
};

export const CATEGORIES = {
  recording: { label: "Nagranie", icon: Video },
  editing: { label: "Montaż", icon: Scissors },
  publication: { label: "Publikacja", icon: Send },
  meeting: { label: "Spotkanie", icon: Users },
  task: { label: "Zadanie", icon: CheckSquare },
  approval: { label: "Akceptacja", icon: BadgeCheck },
  other: { label: "Inne", icon: Circle },
} satisfies Record<string, { label: string; icon: LucideIcon }>;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];
/** Kategorie, które można wybrać dla zwykłego wydarzenia (enum event_category w bazie). */
export const EVENT_CATEGORIES: Category[] = ["recording", "editing", "publication", "meeting", "task", "other"];

export const EVENT_STATUSES = {
  planned: "Zaplanowane",
  in_progress: "W trakcie",
  done: "Zakończone",
  cancelled: "Anulowane",
} as const;
export type EventStatus = keyof typeof EVENT_STATUSES;

export const PLATFORMS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

// ─── Linki do spotkań ───────────────────────────────────────

const MEETING_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Google Meet", re: /https?:\/\/meet\.google\.com\/[a-z0-9-]+/i },
  { name: "Zoom", re: /https?:\/\/(?:[\w-]+\.)?zoom\.us\/(?:j|my|w)\/[^\s<>"]+/i },
  { name: "Microsoft Teams", re: /https?:\/\/teams\.(?:microsoft|live)\.com\/[^\s<>"]+/i },
];

/** Szuka linku do spotkania w polach wydarzenia (link, lokalizacja, opis). */
export function findMeeting(...fields: (string | null | undefined)[]) {
  for (const text of fields) {
    if (!text) continue;
    for (const p of MEETING_PATTERNS) {
      const m = text.match(p.re);
      if (m) return { provider: p.name, url: m[0] };
    }
  }
  return null;
}

// ─── Daty ───────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → wartość dla <input type="datetime-local"> w czasie lokalnym. */
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Date → wartość dla <input type="date">. */
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Lokalna północ podanego dnia ("2026-11-12"). */
export const fromDateInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const dayFmt = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });

/** „środa, 12 listopada 2026, 10:00–11:00” — do kopiowania i wysyłania klientowi. */
export function formatRange(start: Date, end: Date, allDay: boolean) {
  if (allDay) {
    const lastDay = addDays(end, -1);
    return lastDay > start ? `${dayFmt.format(start)} – ${dayFmt.format(lastDay)}` : dayFmt.format(start);
  }
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dayFmt.format(start)}, ${timeFmt.format(start)}–${timeFmt.format(end)}`
    : `${dayFmt.format(start)}, ${timeFmt.format(start)} – ${dayFmt.format(end)}, ${timeFmt.format(end)}`;
}

export function eventDetailsText(e: {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | null;
  url?: string | null;
}) {
  const lines = [e.title, formatRange(e.start, e.end, e.allDay)];
  if (e.location) lines.push(`Miejsce: ${e.location}`);
  if (e.url) lines.push(`Link: ${e.url}`);
  return lines.join("\n");
}
