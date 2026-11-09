import type { Metadata } from "next";
import type { ContentStage, ContentType, MilestoneKind, Platform } from "@/lib/content";
import { getRefs } from "@/lib/refs";
import { getSession, getWorkspace } from "@/lib/workspace";
import { ContentList, type ContentRow } from "./content-list";

export const metadata: Metadata = { title: "Content" };

type Raw = {
  id: string;
  title: string;
  type: ContentType;
  stage: ContentStage;
  client_id: string | null;
  project_id: string | null;
  updated_at: string;
  board_position: number | null;
  content_milestones: { kind: MilestoneKind; due_at: string; done_at: string | null }[];
  content_publications: { platform: Platform; publish_at: string; status: string }[];
};

export default async function ContentPage({ params }: PageProps<"/w/[slug]/content">) {
  const { slug } = await params;
  const [ws, refs, { supabase }] = await Promise.all([getWorkspace(slug), getRefs(), getSession()]);
  const { data } = await supabase
    .from("content")
    .select(
      "id, title, type, stage, client_id, project_id, updated_at, board_position, content_milestones(kind, due_at, done_at), content_publications(platform, publish_at, status)",
    )
    .eq("workspace_id", ws.id)
    .order("updated_at", { ascending: false });

  const now = new Date().toISOString();
  const rows: ContentRow[] = ((data ?? []) as Raw[]).map((c) => {
    // Najbliższy niezamknięty termin: etap produkcji albo publikacja.
    const upcoming = [
      ...c.content_milestones.filter((m) => !m.done_at).map((m) => ({ label: m.kind, at: m.due_at })),
      ...c.content_publications.filter((p) => p.status === "planned").map((p) => ({ label: "publication" as const, at: p.publish_at })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    const next = upcoming.find((u) => u.at >= now.slice(0, 10)) ?? upcoming.at(-1) ?? null;
    return {
      id: c.id,
      title: c.title,
      type: c.type,
      stage: c.stage,
      client_id: c.client_id,
      project_id: c.project_id,
      board_position: c.board_position,
      platforms: [...new Set(c.content_publications.map((p) => p.platform))],
      next,
    };
  });

  return (
    <ContentList
      workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }}
      rows={rows}
      clients={refs.clients.filter((c) => c.workspace_id === ws.id)}
      projects={refs.projects.filter((p) => p.workspace_id === ws.id)}
    />
  );
}
