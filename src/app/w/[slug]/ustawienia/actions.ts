"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CLIENT_COLORS } from "@/lib/palette";
import { SLACK_WEBHOOK_RE, getWorkspaceWebhook, postToSlack, slackEscape } from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTrelloList,
  enqueueExistingTasks,
  flushTrelloOutbox,
  getTrelloBoards,
  getTrelloLists,
  getTrelloMember,
  guessLists,
  trelloConfigured,
  type TrelloLists,
} from "@/lib/trello";
import { getSession, getWorkspace } from "@/lib/workspace";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const wsSchema = z.object({
  name: z.string().trim().min(1, "Wpisz nazwę.").max(80, "Nazwa może mieć najwyżej 80 znaków."),
  color: z.enum(CLIENT_COLORS.map((c) => c.key) as [string, ...string[]]),
});

export async function updateWorkspaceAction(slug: string, input: { name: string; color: string }): Promise<Result> {
  const ws = await getWorkspace(slug);
  if (ws.role !== "owner") return { ok: false, error: "Tylko właściciel może zmieniać workspace." };
  const parsed = wsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase } = await getSession();
  const { error } = await supabase.from("workspaces").update(parsed.data).eq("id", ws.id);
  if (error) return { ok: false, error: "Nie udało się zapisać zmian." };
  revalidatePath(`/w/${slug}`, "layout");
  return { ok: true, message: "Zapisano." };
}

export async function saveSlackAction(slug: string, input: { url: string; channel: string }): Promise<Result> {
  const ws = await getWorkspace(slug);
  if (ws.role !== "owner") return { ok: false, error: "Tylko właściciel może podłączyć Slacka." };
  const url = input.url.trim();
  if (!SLACK_WEBHOOK_RE.test(url)) {
    return { ok: false, error: "To nie jest adres webhooka Slacka. Powinien zaczynać się od https://hooks.slack.com/services/" };
  }
  // Najpierw sprawdzamy, czy webhook działa — dopiero potem zapisujemy.
  const ok = await postToSlack(url, `ContentFlow połączony z workspace'em *${slackEscape(ws.name)}*. Tutaj będą trafiać plany dnia i przypomnienia.`);
  if (!ok) return { ok: false, error: "Slack odrzucił wiadomość. Sprawdź, czy webhook jest aktywny i skopiowany w całości." };

  const { supabase } = await getSession();
  const { error } = await supabase.rpc("set_slack_webhook", { ws: ws.id, url, channel: input.channel.trim().replace(/^#/, "") || null });
  if (error) return { ok: false, error: "Nie udało się zapisać połączenia." };
  revalidatePath(`/w/${slug}/ustawienia`);
  return { ok: true, message: "Połączono. Na kanale pojawiła się wiadomość testowa." };
}

export async function removeSlackAction(slug: string): Promise<Result> {
  const ws = await getWorkspace(slug);
  if (ws.role !== "owner") return { ok: false, error: "Tylko właściciel może odłączyć Slacka." };
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("set_slack_webhook", { ws: ws.id, url: null, channel: null });
  if (error) return { ok: false, error: "Nie udało się odłączyć Slacka." };
  revalidatePath(`/w/${slug}/ustawienia`);
  return { ok: true, message: "Slack odłączony." };
}

export async function setSlackRemindersAction(slug: string, enabled: boolean): Promise<Result> {
  const ws = await getWorkspace(slug);
  if (ws.role !== "owner") return { ok: false, error: "Tylko właściciel może zmieniać to ustawienie." };
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("set_slack_reminders", { ws: ws.id, enabled });
  if (error) return { ok: false, error: "Nie udało się zapisać ustawienia." };
  return { ok: true, message: enabled ? "Przypomnienia będą trafiać na Slacka." : "Przypomnienia na Slacka wyłączone." };
}

// ─── Powiadomienia push (Web Push) ───────────────────────────

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function savePushSubscriptionAction(sub: unknown, userAgent: string): Promise<Result> {
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, error: "Przeglądarka zwróciła nieprawidłową subskrypcję." };
  const { supabase, user } = await getSession();
  const { endpoint, keys } = parsed.data;
  // Ta sama przeglądarka mogła być wcześniej zapisana — zastępujemy wpis.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: userAgent.slice(0, 300) });
  if (error) return { ok: false, error: "Nie udało się zapisać urządzenia." };
  return { ok: true, message: "Powiadomienia włączone na tym urządzeniu." };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<Result> {
  const { supabase, user } = await getSession();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: true, message: "Powiadomienia wyłączone na tym urządzeniu." };
}

export async function sendTestPushAction(): Promise<Result> {
  const { user } = await getSession();
  const { pushToUser, pushConfigured } = await import("@/lib/push");
  if (!pushConfigured()) return { ok: false, error: "Serwer nie ma kluczy VAPID (zob. docs/KONFIGURACJA.md)." };
  const sent = await pushToUser(user.id, { title: "ContentFlow", body: "Powiadomienia działają.", url: "/", tag: "test" });
  return sent ? { ok: true, message: `Wysłano na ${sent} ${sent === 1 ? "urządzenie" : "urządzenia"}.` } : { ok: false, error: "Brak zapisanych urządzeń." };
}

export async function testSlackAction(slug: string): Promise<Result> {
  const ws = await getWorkspace(slug); // sprawdza członkostwo
  const webhook = await getWorkspaceWebhook(ws.id);
  if (!webhook) return { ok: false, error: "Slack nie jest podłączony." };
  const ok = await postToSlack(webhook, `Test z ContentFlow (${slackEscape(ws.name)}). Wszystko działa.`);
  return ok ? { ok: true, message: "Wysłano wiadomość testową." } : { ok: false, error: "Slack odrzucił wiadomość." };
}

// ─── Trello (wysyłka zadań na tablicę) ───────────────────────

const TRELLO_TOKEN_RE = /^[A-Za-z0-9]{32,200}$/;
const TRELLO_ID_RE = /^[0-9a-f]{24}$/;

async function trelloOwner(slug: string) {
  const ws = await getWorkspace(slug);
  if (ws.role !== "owner") return { ws, error: "Trello może podłączyć właściciel workspace'u." };
  if (!trelloConfigured) return { ws, error: "Brakuje klucza NEXT_PUBLIC_TRELLO_API_KEY (zob. docs/KONFIGURACJA.md)." };
  return { ws, error: null };
}

async function trelloToken(workspaceId: string) {
  const { data } = await createAdminClient().from("workspace_secrets").select("trello_token").eq("workspace_id", workspaceId).maybeSingle();
  return (data?.trello_token as string | null) ?? null;
}

export type TrelloOption = { id: string; name: string };
type ListsResult = { ok: true; lists: TrelloOption[]; guess: Partial<TrelloLists> } | { ok: false; error: string };

export async function connectTrelloAction(slug: string, token: string): Promise<Result & { member?: string }> {
  const { ws, error } = await trelloOwner(slug);
  if (error) return { ok: false, error };
  const t = token.trim();
  if (!TRELLO_TOKEN_RE.test(t)) return { ok: false, error: "To nie wygląda na token Trello. Skopiuj go w całości." };
  let member: string;
  try {
    const me = await getTrelloMember(t);
    member = me.fullName || me.username;
  } catch {
    return { ok: false, error: "Trello nie przyjął tokenu. Autoryzuj ContentFlow jeszcze raz." };
  }
  const { error: dbError } = await createAdminClient()
    .from("workspace_secrets")
    .upsert({ workspace_id: ws.id, trello_token: t, trello_member: member, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
  if (dbError) return { ok: false, error: "Nie udało się zapisać połączenia." };
  revalidatePath(`/w/${slug}/ustawienia`);
  return { ok: true, message: `Połączono z kontem ${member}. Wybierz tablicę.`, member };
}

export async function trelloBoardsAction(slug: string): Promise<{ ok: true; boards: TrelloOption[] } | { ok: false; error: string }> {
  const { ws, error } = await trelloOwner(slug);
  if (error) return { ok: false, error };
  const token = await trelloToken(ws.id);
  if (!token) return { ok: false, error: "Najpierw połącz konto Trello." };
  try {
    return { ok: true, boards: (await getTrelloBoards(token)).map(({ id, name }) => ({ id, name })) };
  } catch {
    return { ok: false, error: "Nie udało się pobrać tablic z Trello. Spróbuj połączyć konto ponownie." };
  }
}

export async function trelloListsAction(slug: string, boardId: string, create = false): Promise<ListsResult> {
  const { ws, error } = await trelloOwner(slug);
  if (error) return { ok: false, error };
  if (!TRELLO_ID_RE.test(boardId)) return { ok: false, error: "Nieprawidłowa tablica." };
  const token = await trelloToken(ws.id);
  if (!token) return { ok: false, error: "Najpierw połącz konto Trello." };
  try {
    // create: dodaj na tablicy trzy listy jak kolumny w ContentFlow.
    if (create) for (const name of ["Do zrobienia", "W trakcie", "Ukończone"]) await createTrelloList(token, boardId, name);
    const lists = (await getTrelloLists(token, boardId)).map(({ id, name }) => ({ id, name }));
    return { ok: true, lists, guess: guessLists(lists) };
  } catch {
    return { ok: false, error: create ? "Nie udało się utworzyć list w Trello." : "Nie udało się pobrać list tej tablicy." };
  }
}

const trelloBoardSchema = z.object({
  boardId: z.string().regex(TRELLO_ID_RE),
  lists: z.object({ todo: z.string().regex(TRELLO_ID_RE), in_progress: z.string().regex(TRELLO_ID_RE), done: z.string().regex(TRELLO_ID_RE) }),
  sync: z.boolean(),
});

export async function saveTrelloBoardAction(slug: string, input: { boardId: string; lists: TrelloLists; sync: boolean }): Promise<Result> {
  const { ws, error } = await trelloOwner(slug);
  if (error) return { ok: false, error };
  const parsed = trelloBoardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Wybierz tablicę i wszystkie trzy listy." };
  const token = await trelloToken(ws.id);
  if (!token) return { ok: false, error: "Najpierw połącz konto Trello." };

  // Sprawdzamy w Trello, że listy należą do tej tablicy.
  let boardName = "";
  try {
    const [boards, lists] = await Promise.all([getTrelloBoards(token), getTrelloLists(token, parsed.data.boardId)]);
    boardName = boards.find((b) => b.id === parsed.data.boardId)?.name ?? "";
    const ids = new Set(lists.map((l) => l.id));
    if (!boardName || !Object.values(parsed.data.lists).every((id) => ids.has(id))) {
      return { ok: false, error: "Wybrane listy nie należą do tej tablicy. Odśwież stronę." };
    }
  } catch {
    return { ok: false, error: "Nie udało się sprawdzić tablicy w Trello." };
  }

  const admin = createAdminClient();
  const { data: before } = await admin.from("workspace_secrets").select("trello_sync, trello_board_id").eq("workspace_id", ws.id).maybeSingle();
  const { error: dbError } = await admin
    .from("workspace_secrets")
    .update({
      trello_board_id: parsed.data.boardId,
      trello_board_name: boardName,
      trello_lists: parsed.data.lists,
      trello_sync: parsed.data.sync,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", ws.id);
  if (dbError) return { ok: false, error: "Nie udało się zapisać ustawień." };

  // Po włączeniu (albo zmianie tablicy) wysyłamy też zadania, które już są w ContentFlow.
  let queued = 0;
  if (parsed.data.sync && (!before?.trello_sync || before.trello_board_id !== parsed.data.boardId)) {
    queued = await enqueueExistingTasks(ws.id);
    await flushTrelloOutbox([ws.id], 15).catch(() => null);
  }
  revalidatePath(`/w/${slug}/ustawienia`);
  return {
    ok: true,
    message: !parsed.data.sync
      ? "Zapisano. Wysyłka do Trello jest wyłączona."
      : queued
        ? `Zapisano. Wysyłam ${queued} zadań na tablicę „${boardName}”; reszta dotrze w ciągu minuty.`
        : `Zapisano. Nowe i zmienione zadania trafią na tablicę „${boardName}”.`,
  };
}

export async function disconnectTrelloAction(slug: string): Promise<Result> {
  const { ws, error } = await trelloOwner(slug);
  if (error) return { ok: false, error };
  const admin = createAdminClient();
  const { error: dbError } = await admin
    .from("workspace_secrets")
    .update({ trello_token: null, trello_member: null, trello_board_id: null, trello_board_name: null, trello_lists: null, trello_sync: false })
    .eq("workspace_id", ws.id);
  if (dbError) return { ok: false, error: "Nie udało się odłączyć Trello." };
  await admin.from("trello_outbox").delete().eq("workspace_id", ws.id);
  revalidatePath(`/w/${slug}/ustawienia`);
  return { ok: true, message: "Trello odłączone. Karty na tablicy zostają." };
}
