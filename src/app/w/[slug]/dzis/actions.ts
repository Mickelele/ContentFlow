"use server";

import { z } from "zod";
import { getWorkspaceWebhook, postToSlack, slackEscape } from "@/lib/slack";
import { getWorkspace } from "@/lib/workspace";

const schema = z.object({
  dateLabel: z.string().max(60),
  tasks: z.array(z.object({ title: z.string().max(300), done: z.boolean(), client: z.string().max(120).nullable() })).max(50),
  events: z.array(z.object({ time: z.string().max(30), title: z.string().max(300), link: z.string().url().max(500).nullable() })).max(30),
});

/** Plan dnia na Slacka. Daty i godziny formatuje przeglądarka (jej strefa czasowa), serwer tylko składa wiadomość. */
export async function sendDayPlanAction(slug: string, input: z.input<typeof schema>) {
  const ws = await getWorkspace(slug); // sprawdza członkostwo
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Nieprawidłowe dane planu." };
  const webhook = await getWorkspaceWebhook(ws.id);
  if (!webhook) return { ok: false as const, error: "Slack nie jest podłączony. Zrób to w Ustawieniach." };

  const { dateLabel, tasks, events } = parsed.data;
  const e = slackEscape;
  const taskLines = tasks.length
    ? tasks.map((t) => `${t.done ? ":white_check_mark:" : ":white_large_square:"} ${e(t.title)}${t.client ? ` _(${e(t.client)})_` : ""}`).join("\n")
    : "_Plan jest pusty._";
  const eventLines = events.length
    ? events.map((ev) => `• *${e(ev.time)}* ${e(ev.title)}${ev.link ? ` — <${ev.link}|dołącz>` : ""}`).join("\n")
    : "_Brak wydarzeń._";

  const blocks = [
    { type: "header", text: { type: "plain_text", text: `Plan dnia · ${dateLabel}` } },
    { type: "section", text: { type: "mrkdwn", text: `*Zadania* (${tasks.filter((t) => t.done).length}/${tasks.length})\n${taskLines}` } },
    { type: "section", text: { type: "mrkdwn", text: `*Wydarzenia*\n${eventLines}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: `Wysłano z ContentFlow · ${e(ws.name)}` }] },
  ];
  const ok = await postToSlack(webhook, `Plan dnia · ${dateLabel}`, blocks);
  return ok ? { ok: true as const } : { ok: false as const, error: "Slack odrzucił wiadomość." };
}
