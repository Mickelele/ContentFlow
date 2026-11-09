"use server";

import { z } from "zod";
import { getWorkspaceWebhook, postToSlack, slackEscape } from "@/lib/slack";
import { getWorkspace } from "@/lib/workspace";

/** Podsumowanie tygodnia na Slacka. Tekst składa przeglądarka (jej strefa czasowa), serwer tylko wysyła. */
export async function sendWeeklySummaryAction(slug: string, input: { title: string; lines: string[] }) {
  const ws = await getWorkspace(slug);
  const parsed = z.object({ title: z.string().max(120), lines: z.array(z.string().max(300)).max(30) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Nieprawidłowe dane." };
  const webhook = await getWorkspaceWebhook(ws.id);
  if (!webhook) return { ok: false as const, error: "Slack nie jest podłączony. Zrób to w Ustawieniach." };
  const { title, lines } = parsed.data;
  const ok = await postToSlack(webhook, title, [
    { type: "header", text: { type: "plain_text", text: title } },
    { type: "section", text: { type: "mrkdwn", text: lines.map((l) => `• ${slackEscape(l)}`).join("\n") } },
    { type: "context", elements: [{ type: "mrkdwn", text: `ContentFlow · ${slackEscape(ws.name)}` }] },
  ]);
  return ok ? { ok: true as const } : { ok: false as const, error: "Slack odrzucił wiadomość." };
}
