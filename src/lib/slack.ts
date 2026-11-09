import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

type Block = Record<string, unknown>;

export async function postToSlack(webhook: string, text: string, blocks?: Block[]) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blocks ? { text, blocks } : { text }),
    cache: "no-store",
  });
  return res.ok;
}

/** Webhook workspace'u — czytany kluczem serwisowym; wywołujący musi wcześniej sprawdzić członkostwo. */
export async function getWorkspaceWebhook(workspaceId: string) {
  const { data } = await createAdminClient()
    .from("workspace_secrets")
    .select("slack_webhook_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data?.slack_webhook_url as string | null) ?? null;
}

/** Slack mrkdwn: znaki &, <, > muszą być zakodowane. */
export const slackEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
