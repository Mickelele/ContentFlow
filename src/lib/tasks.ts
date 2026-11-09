import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientColor } from "@/lib/palette";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type Task = {
  id: string;
  workspace_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  due_all_day: boolean;
  planned_on: string | null;
  position: number;
  completed_at: string | null;
  checklist_total: number;
  checklist_done: number;
};

export type ChecklistItem = { id: string; task_id: string; label: string; done: boolean; position: number };

export type ClientRef = { id: string; workspace_id: string; name: string; color: ClientColor };
export type WorkspaceRef = { id: string; name: string; slug: string; color: ClientColor };

export const STATUSES: Record<TaskStatus, string> = {
  todo: "Do zrobienia",
  in_progress: "W trakcie",
  done: "Ukończone",
};

export const PRIORITIES: Record<TaskPriority, { label: string; rank: number }> = {
  urgent: { label: "Pilny", rank: 0 },
  high: { label: "Wysoki", rank: 1 },
  normal: { label: "Normalny", rank: 2 },
  low: { label: "Niski", rank: 3 },
};

export const TASK_SELECT =
  "id, workspace_id, client_id, title, description, status, priority, due_at, due_all_day, planned_on, position, completed_at, checklist_items(done)";

type Row = Omit<Task, "checklist_total" | "checklist_done"> & { checklist_items: { done: boolean }[] | null };

/** Wiersz z Supabase (z checklist_items) → Task z licznikami checklisty. */
export const toTasks = (rows: unknown): Task[] =>
  ((rows ?? []) as Row[]).map(({ checklist_items, ...rest }) => {
    const items = checklist_items ?? [];
    return { ...rest, checklist_total: items.length, checklist_done: items.filter((i) => i.done).length };
  });

/** Ukończenie / cofnięcie ukończenia jednym kliknięciem. */
export async function setTaskDone(supabase: SupabaseClient, id: string, done: boolean) {
  return supabase.from("tasks").update({ status: done ? "done" : "todo" }).eq("id", id);
}

// ─── Daty (w strefie przeglądarki) ───────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "2026-11-12" w czasie lokalnym. */
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
};
export const keyToDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dayName = new Intl.DateTimeFormat("pl-PL", { weekday: "long" });
const shortDate = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });

/** „Dziś”, „Jutro”, „środa”, „12 lis” (+ godzina, jeśli termin nie jest całodniowy). */
export function dueLabel(task: Pick<Task, "due_at" | "due_all_day">) {
  if (!task.due_at) return null;
  const d = new Date(task.due_at);
  const key = dateKey(d);
  const today = todayKey();
  const diff = Math.round((keyToDate(key).getTime() - keyToDate(today).getTime()) / 864e5);
  const day =
    diff === 0 ? "Dziś" : diff === 1 ? "Jutro" : diff === -1 ? "Wczoraj" : diff > 1 && diff < 7 ? dayName.format(d) : shortDate.format(d);
  return task.due_all_day ? day : `${day}, ${timeFmt.format(d)}`;
}

export const isOverdue = (task: Pick<Task, "due_at" | "status">) =>
  Boolean(task.due_at && task.status !== "done" && dateKey(new Date(task.due_at)) < todayKey());

/** Termin całodniowy zapisujemy jako lokalną północ danego dnia. */
export function dueFromInputs(date: string, time: string) {
  if (!date) return { due_at: null, due_all_day: true };
  const [y, m, d] = date.split("-").map(Number);
  if (!time) return { due_at: new Date(y, m - 1, d).toISOString(), due_all_day: true };
  const [hh, mm] = time.split(":").map(Number);
  return { due_at: new Date(y, m - 1, d, hh, mm).toISOString(), due_all_day: false };
}

export function dueToInputs(task: Pick<Task, "due_at" | "due_all_day">) {
  if (!task.due_at) return { date: "", time: "" };
  const d = new Date(task.due_at);
  return { date: dateKey(d), time: task.due_all_day ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** Kolejność na liście: najpierw niezrobione, potem priorytet, termin, pozycja. */
export function compareTasks(a: Task, b: Task) {
  if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
  const p = PRIORITIES[a.priority].rank - PRIORITIES[b.priority].rank;
  if (p) return p;
  if (a.due_at !== b.due_at) return !a.due_at ? 1 : !b.due_at ? -1 : a.due_at < b.due_at ? -1 : 1;
  return a.position - b.position;
}
