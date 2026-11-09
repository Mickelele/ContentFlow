"use server";

import { z } from "zod";
import { pushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Odpowiedź klienta na prośbę o akceptację. Klient nie ma konta — dostęp daje wyłącznie token z linku,
 * sprawdzany tutaj kluczem serwisowym (prośba musi czekać na odpowiedź i nie może być przeterminowana).
 */
const schema = z.object({
  token: z.string().regex(/^[0-9a-f]{40,80}$/),
  decision: z.enum(["approved", "changes_requested"]),
  name: z.string().trim().max(120),
  comment: z.string().trim().max(5000),
});

export type RespondResult = { ok: true } | { ok: false; error: string };

export async function respondAction(input: z.input<typeof schema>): Promise<RespondResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };
  const { token, decision, name, comment } = parsed.data;
  if (decision === "changes_requested" && !comment) return { ok: false, error: "Napisz, co poprawić." };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("approval_requests")
    .select("id, status, expires_at, content_id, created_by, content(title, stage, workspaces(slug))")
    .eq("token", token)
    .maybeSingle();
  if (!req) return { ok: false, error: "Ten link jest nieprawidłowy." };
  if (req.status !== "pending") return { ok: false, error: "Na tę prośbę już odpowiedziano." };
  if (new Date(req.expires_at) < new Date()) return { ok: false, error: "Link wygasł. Poproś o nowy." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("approval_requests")
    .update({ status: decision, client_name: name || null, client_comment: comment || null, responded_at: now })
    .eq("id", req.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: "Nie udało się zapisać odpowiedzi. Spróbuj ponownie." };

  // Skutki w materiale: akceptacja odhacza termin akceptacji i przesuwa etap dalej; poprawki wracają do montażu.
  const content = req.content as unknown as { title: string; stage: string; workspaces: { slug: string } | null } | null;
  if (decision === "approved") {
    await admin.from("content_milestones").update({ done_at: now }).eq("content_id", req.content_id).eq("kind", "approval").is("done_at", null);
    if (content?.stage === "approval") await admin.from("content").update({ stage: "scheduled" }).eq("id", req.content_id);
  } else if (content?.stage === "approval") {
    await admin.from("content").update({ stage: "editing" }).eq("id", req.content_id);
  }

  if (req.created_by && content) {
    await pushToUser(req.created_by, {
      title: decision === "approved" ? `Zaakceptowano: ${content.title}` : `Poprawki: ${content.title}`,
      body: decision === "approved" ? `${name || "Klient"} zaakceptował materiał.` : comment.slice(0, 140),
      url: content.workspaces ? `/w/${content.workspaces.slug}/content/${req.content_id}` : "/",
      tag: `review-${req.id}`,
    });
  }
  return { ok: true };
}
