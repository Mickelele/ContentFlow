import { NextResponse, type NextRequest } from "next/server";
import { pushToUser } from "@/lib/push";
import { postToSlack, slackEscape } from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMeeting } from "@/lib/calendar";

/**
 * Wysyłka przypomnień o wydarzeniach: push na urządzenia + (opcjonalnie) Slack.
 * Wywoływane co minutę przez pg_cron w Supabase (zob. docs/KONFIGURACJA.md), z nagłówkiem
 * Authorization: Bearer <CRON_SECRET>. Przypomnienia starsze niż 2 godziny pomijamy (np. po awarii).
 */
const tz = "Europe/Warsaw";
const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: tz });

type Row = {
  id: string;
  user_id: string;
  remind_at: string;
  events: {
    id: string;
    title: string;
    starts_at: string;
    all_day: boolean;
    status: string;
    url: string | null;
    location: string | null;
    description: string | null;
    workspace_id: string;
    slack_notified_at: string | null;
    workspaces: { slug: string; name: string } | null;
  } | null;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const { data, error } = await admin
    .from("reminders")
    .select(
      "id, user_id, remind_at, events(id, title, starts_at, all_day, status, url, location, description, workspace_id, slack_notified_at, workspaces(slug, name))",
    )
    .is("sent_at", null)
    .not("event_id", "is", null)
    .lte("remind_at", now.toISOString())
    .gte("remind_at", new Date(now.getTime() - 2 * 3600_000).toISOString())
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  let pushed = 0;
  let slack = 0;

  // Slack: tylko workspace'y z włączonymi przypomnieniami, jedno powiadomienie na wydarzenie.
  const wsIds = [...new Set(rows.map((r) => r.events?.workspace_id).filter(Boolean))] as string[];
  const { data: secrets } = wsIds.length
    ? await admin.from("workspace_secrets").select("workspace_id, slack_webhook_url").in("workspace_id", wsIds).eq("slack_reminders", true)
    : { data: [] };
  const hooks = new Map((secrets ?? []).filter((s) => s.slack_webhook_url).map((s) => [s.workspace_id as string, s.slack_webhook_url as string]));
  const slackDone = new Set<string>();

  for (const r of rows) {
    const e = r.events;
    if (e && e.status !== "cancelled") {
      const start = new Date(e.starts_at);
      const mins = Math.round((start.getTime() - now.getTime()) / 60000);
      const when = e.all_day ? "Dziś, cały dzień" : mins > 1 ? `Za ${mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} godz.`} · ${timeFmt.format(start)}` : `Teraz · ${timeFmt.format(start)}`;
      const slug = e.workspaces?.slug;
      pushed += await pushToUser(r.user_id, {
        title: e.title,
        body: when,
        url: slug ? `/w/${slug}/kalendarz` : "/",
        tag: `event-${e.id}`,
      });

      const hook = hooks.get(e.workspace_id);
      if (hook && !e.slack_notified_at && !slackDone.has(e.id)) {
        slackDone.add(e.id);
        const meeting = findMeeting(e.url, e.location, e.description);
        const ok = await postToSlack(
          hook,
          `:alarm_clock: *${slackEscape(e.title)}* — ${slackEscape(when)}${meeting ? ` · <${meeting.url}|dołącz (${meeting.provider})>` : ""}`,
        );
        if (ok) {
          slack++;
          await admin.from("events").update({ slack_notified_at: now.toISOString() }).eq("id", e.id);
        }
      }
    }
    await admin.from("reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
  }

  return NextResponse.json({ checked: rows.length, pushed, slack });
}
