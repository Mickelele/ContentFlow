"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CLIENT_COLORS } from "@/lib/palette";
import { SLACK_WEBHOOK_RE, getWorkspaceWebhook, postToSlack, slackEscape } from "@/lib/slack";
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

export async function testSlackAction(slug: string): Promise<Result> {
  const ws = await getWorkspace(slug); // sprawdza członkostwo
  const webhook = await getWorkspaceWebhook(ws.id);
  if (!webhook) return { ok: false, error: "Slack nie jest podłączony." };
  const ok = await postToSlack(webhook, `Test z ContentFlow (${slackEscape(ws.name)}). Wszystko działa.`);
  return ok ? { ok: true, message: "Wysłano wiadomość testową." } : { ok: false, error: "Slack odrzucił wiadomość." };
}
