import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Trello: wysyłka zadań z ContentFlow na tablicę Trello (w jedną stronę).
 * Klucz API aplikacji jest publiczny (NEXT_PUBLIC_TRELLO_API_KEY), token konta Trello trzymamy tylko
 * w workspace_secrets i wysyłamy w nagłówku, nigdy w adresie.
 */

const API = "https://api.trello.com/1";
export const TRELLO_KEY = process.env.NEXT_PUBLIC_TRELLO_API_KEY ?? "";
export const trelloConfigured = Boolean(TRELLO_KEY);

export type TrelloLists = { todo: string; in_progress: string; done: string };
type Status = keyof TrelloLists;

export class TrelloError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function trello<T>(token: string, path: string, init?: { method?: string; body?: Record<string, unknown> }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `OAuth oauth_consumer_key="${TRELLO_KEY}", oauth_token="${token}"`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new TrelloError(res.status, (await res.text().catch(() => "")).slice(0, 200) || res.statusText);
  return (res.status === 204 ? null : await res.json()) as T;
}

export const getTrelloMember = (token: string) => trello<{ fullName: string; username: string }>(token, "/members/me?fields=fullName,username");

export const getTrelloBoards = (token: string) =>
  trello<{ id: string; name: string }[]>(token, "/members/me/boards?filter=open&fields=name");

export const getTrelloLists = (token: string, boardId: string) =>
  trello<{ id: string; name: string }[]>(token, `/boards/${encodeURIComponent(boardId)}/lists?filter=open&fields=name`);

export const createTrelloList = (token: string, boardId: string, name: string) =>
  trello<{ id: string; name: string }>(token, "/lists", { method: "POST", body: { idBoard: boardId, name, pos: "bottom" } });

/** Domyślne dopasowanie list po nazwach (pl/en); brakujące — kolejne listy tablicy. */
export function guessLists(lists: { id: string; name: string }[]): Partial<TrelloLists> {
  const find = (re: RegExp) => lists.find((l) => re.test(l.name.trim()))?.id;
  return {
    todo: find(/^(do zrobienia|to ?do|zadania|backlog)$/i) ?? lists[0]?.id,
    in_progress: find(/^(w trakcie|in progress|doing|robię)$/i) ?? lists[1]?.id,
    done: find(/^(ukończone|zrobione|gotowe|done|zakończone|completed)$/i) ?? lists[2]?.id,
  };
}

type Secrets = { token: string; boardId: string; lists: TrelloLists };

type TaskRow = {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: Status;
  due_at: string | null;
  trello_card_id: string | null;
  external_id: string | null;
  checklist_items: { label: string; done: boolean; position: number }[];
};

type OutboxRow = { task_id: string; workspace_id: string; op: "upsert" | "archive"; card_id: string | null; attempts: number };

const CHECKLIST_NAME = "Checklista";
const MAX_ATTEMPTS = 5;

/**
 * Opróżnia kolejkę zmian: zadanie → karta (tytuł, opis, termin, lista wg statusu, checklista).
 * `workspaceIds = null` — wszystkie workspace'y (cron). Zwraca liczbę wysłanych i nieudanych.
 */
export async function flushTrelloOutbox(workspaceIds: string[] | null, batch = 25) {
  if (!trelloConfigured) return { sent: 0, failed: 0 };
  const admin = createAdminClient();
  const { data: claimed, error } = await admin.rpc("claim_trello_outbox", { ws_ids: workspaceIds, batch });
  if (error) throw new Error(`claim_trello_outbox: ${error.message}`);
  const rows = (claimed ?? []) as OutboxRow[];
  if (!rows.length) return { sent: 0, failed: 0 };

  const secrets = new Map<string, Secrets | null>();
  const secretsFor = async (ws: string) => {
    if (!secrets.has(ws)) {
      const { data } = await admin
        .from("workspace_secrets")
        .select("trello_token, trello_board_id, trello_lists, trello_sync")
        .eq("workspace_id", ws)
        .maybeSingle();
      const lists = data?.trello_lists as Partial<TrelloLists> | null;
      secrets.set(
        ws,
        data?.trello_sync && data.trello_token && data.trello_board_id && lists?.todo
          ? { token: data.trello_token, boardId: data.trello_board_id, lists: { todo: lists.todo, in_progress: lists.in_progress ?? lists.todo, done: lists.done ?? lists.todo } }
          : null,
      );
    }
    return secrets.get(ws)!;
  };

  let sent = 0;
  let failed = 0;
  // Po kolei: limit Trello to 100 zapytań na 10 s na token, a jedna zmiana to 1–5 zapytań.
  for (const row of rows) {
    const s = await secretsFor(row.workspace_id);
    if (!s) continue; // integracja wyłączona — zmiana przepada
    try {
      if (row.op === "archive") {
        if (row.card_id) await archiveCard(s, row.card_id);
      } else {
        await upsertCard(admin, s, row.task_id);
      }
      sent++;
    } catch (e) {
      failed++;
      const status = e instanceof TrelloError ? e.status : 0;
      const message = e instanceof Error ? e.message : String(e);
      console.error("Trello:", row.op, row.task_id, status, message);
      // Token odwołany albo brak dostępu do tablicy: nie ponawiamy w nieskończoność.
      if (row.attempts + 1 < MAX_ATTEMPTS && status !== 401) {
        // Nowsza zmiana z triggera (jeśli w międzyczasie przyszła) ma pierwszeństwo — stąd ignoreDuplicates.
        await admin
          .from("trello_outbox")
          .upsert(
            { task_id: row.task_id, workspace_id: row.workspace_id, op: row.op, card_id: row.card_id, attempts: row.attempts + 1, last_error: `${status} ${message}`.slice(0, 300) },
            { onConflict: "task_id", ignoreDuplicates: true },
          );
      }
    }
  }
  return { sent, failed };
}

async function archiveCard(s: Secrets, cardId: string) {
  try {
    await trello(s.token, `/cards/${encodeURIComponent(cardId)}`, { method: "PUT", body: { closed: true } });
  } catch (e) {
    if (!(e instanceof TrelloError && e.status === 404)) throw e; // karta już usunięta w Trello
  }
}

async function upsertCard(admin: ReturnType<typeof createAdminClient>, s: Secrets, taskId: string) {
  const { data } = await admin
    .from("tasks")
    .select("id, workspace_id, parent_id, title, description, status, due_at, trello_card_id, external_id, checklist_items(label, done, position)")
    .eq("id", taskId)
    .maybeSingle();
  const task = data as TaskRow | null;
  if (!task || task.parent_id) return;

  const fields = {
    name: task.title,
    desc: (task.description ?? "").slice(0, 16000),
    due: task.due_at,
    dueComplete: task.status === "done",
    idBoard: s.boardId,
    idList: s.lists[task.status] ?? s.lists.todo,
  };

  let cardId = task.trello_card_id;
  // Zadanie zaimportowane z tej samej tablicy: przejmujemy jego kartę zamiast tworzyć duplikat.
  // Import zapisuje external_id jako „trello:<id karty>”.
  const importedCard = task.external_id?.startsWith("trello:") ? task.external_id.slice(7) : null;
  if (!cardId && importedCard && /^[0-9a-f]{24}$/.test(importedCard)) {
    const card = await trello<{ idBoard: string }>(s.token, `/cards/${importedCard}?fields=idBoard`).catch(() => null);
    if (card?.idBoard === s.boardId) cardId = importedCard;
  }

  if (cardId) {
    try {
      await trello(s.token, `/cards/${encodeURIComponent(cardId)}`, { method: "PUT", body: { ...fields, closed: false } });
    } catch (e) {
      if (!(e instanceof TrelloError && e.status === 404)) throw e;
      cardId = null; // karta usunięta w Trello — utworzymy nową
    }
  }
  if (!cardId) {
    const card = await trello<{ id: string }>(s.token, "/cards", { method: "POST", body: { ...fields, pos: "bottom" } });
    cardId = card.id;
  }
  if (cardId !== task.trello_card_id) {
    // Zmiana tylko trello_card_id nie uruchamia triggera kolejki (patrz migracja).
    await admin.from("tasks").update({ trello_card_id: cardId }).eq("id", task.id);
  }

  await syncChecklist(s, cardId, [...task.checklist_items].sort((a, b) => a.position - b.position));
}

async function syncChecklist(s: Secrets, cardId: string, items: { label: string; done: boolean }[]) {
  type Remote = { id: string; name: string; checkItems: { name: string; state: "complete" | "incomplete"; pos: number }[] };
  const remote = await trello<Remote[]>(s.token, `/cards/${encodeURIComponent(cardId)}/checklists?fields=name&checkItem_fields=name,state,pos`);
  const ours = remote.find((c) => c.name === CHECKLIST_NAME);
  const current = ours ? [...ours.checkItems].sort((a, b) => a.pos - b.pos).map((i) => ({ label: i.name, done: i.state === "complete" })) : [];
  const same = current.length === items.length && current.every((c, i) => c.label === items[i].label && c.done === items[i].done);
  if (same) return;

  // Najprościej i bez rozjazdów: odtwórz listę w całości (checklisty są krótkie).
  if (ours) await trello(s.token, `/checklists/${ours.id}`, { method: "DELETE" });
  if (!items.length) return;
  const list = await trello<{ id: string }>(s.token, "/checklists", { method: "POST", body: { idCard: cardId, name: CHECKLIST_NAME } });
  for (const item of items) {
    await trello(s.token, `/checklists/${list.id}/checkItems`, { method: "POST", body: { name: item.label.slice(0, 16000), checked: item.done, pos: "bottom" } });
  }
}

/** Dodaje do kolejki wszystkie otwarte zadania workspace'u (i ukończone z ostatnich 14 dni) — po podłączeniu tablicy. */
export async function enqueueExistingTasks(workspaceId: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data } = await admin
    .from("tasks")
    .select("id, trello_card_id")
    .eq("workspace_id", workspaceId)
    .is("parent_id", null)
    .or(`status.neq.done,completed_at.gte.${since}`)
    .limit(500);
  const rows = (data ?? []).map((t) => ({ task_id: t.id, workspace_id: workspaceId, op: "upsert", card_id: t.trello_card_id }));
  if (rows.length) await admin.from("trello_outbox").upsert(rows, { onConflict: "task_id" });
  return rows.length;
}
