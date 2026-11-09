"use client";

import { forgetToken, getGoogleToken } from "@/lib/google-auth";

/*
 * Google Calendar na żądanie (D-08): jednorazowy import do ContentFlow i jednorazowy eksport do Google.
 * Zakresy: lista kalendarzy (odczyt) + wydarzenia (odczyt i zapis). Bez synchronizacji w tle.
 */
export const CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

const API = "https://www.googleapis.com/calendar/v3";

export type GCalendar = { id: string; summary: string; backgroundColor?: string; primary?: boolean; accessRole: string };
export type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: unknown[];
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
};

export async function connectCalendar() {
  return getGoogleToken(CALENDAR_SCOPE, { selectAccount: true });
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    forgetToken(CALENDAR_SCOPE);
    throw new Error("Dostęp do Google wygasł. Połącz ponownie.");
  }
  if (!res.ok) {
    const msg = res.status === 403 ? "Google odmówił dostępu. Sprawdź, czy Google Calendar API jest włączone." : `Google Calendar zwrócił błąd ${res.status}.`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export async function listCalendars(token: string) {
  const data = await api<{ items: GCalendar[] }>(token, "/users/me/calendarList?minAccessRole=reader&maxResults=250");
  return data.items.sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)) || a.summary.localeCompare(b.summary, "pl"));
}

/** Wydarzenia z zakresu; cykliczne rozwinięte w pojedyncze wystąpienia. */
export async function listEvents(token: string, calendarId: string, from: Date, to: Date) {
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await api<{ items: GEvent[]; nextPageToken?: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    out.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && out.length < 10000);
  return out;
}

export type GEventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

export async function insertEvent(token: string, calendarId: string, body: GEventInput) {
  return api<{ id: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(body) });
}

export async function patchEvent(token: string, calendarId: string, eventId: string, body: GEventInput) {
  return api<{ id: string }>(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ─── Przekształcenia ─────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localMidnight = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Wydarzenie Google → wiersz `events` (warstwa i identyfikator zewnętrzny chronią przed duplikatami). */
export function toContentFlowEvent(e: GEvent, calendarId: string, layerId: string) {
  const allDay = Boolean(e.start.date);
  const starts = allDay ? localMidnight(e.start.date!) : new Date(e.start.dateTime!);
  const ends = allDay ? localMidnight(e.end.date ?? e.start.date!) : new Date(e.end.dateTime ?? e.start.dateTime!);
  const meet = e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null;
  return {
    calendar_id: layerId,
    external_id: `gcal:${calendarId}:${e.id}`,
    title: (e.summary || "(bez tytułu)").slice(0, 200),
    description: e.description ?? null,
    location: e.location ?? null,
    url: meet,
    all_day: allDay,
    starts_at: starts.toISOString(),
    ends_at: (ends < starts ? starts : ends).toISOString(),
    category: meet || (e.attendees?.length ?? 0) > 0 ? "meeting" : "other",
    status: "planned",
  };
}

/** Wydarzenie ContentFlow → treść wydarzenia Google. */
export function toGoogleEvent(e: {
  title: string;
  description: string | null;
  location: string | null;
  url: string | null;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
}): GEventInput {
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  const description = [e.description, e.url ? `Link: ${e.url}` : null, "Wysłano z ContentFlow"].filter(Boolean).join("\n\n");
  return {
    summary: e.title,
    description,
    location: e.location ?? undefined,
    start: e.all_day ? { date: dateStr(start) } : { dateTime: start.toISOString() },
    end: e.all_day ? { date: dateStr(end > start ? end : new Date(start.getTime() + 864e5)) } : { dateTime: end.toISOString() },
  };
}
