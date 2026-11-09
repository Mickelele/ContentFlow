import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRefs } from "@/lib/refs";
import { getSession, getWorkspace } from "@/lib/workspace";
import { MaterialLoader } from "./material-loader";
import type { Material } from "./material-editor";

export const metadata: Metadata = { title: "Materiał" };

export default async function MaterialPage({ params }: PageProps<"/w/[slug]/content/[id]">) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ws, refs, { supabase }] = await Promise.all([getWorkspace(slug), getRefs(), getSession()]);

  const [{ data: content }, { data: attachments }] = await Promise.all([
    supabase
      .from("content")
      .select(
        "id, workspace_id, title, type, stage, client_id, project_id, description, content_milestones(id, kind, due_at, done_at), content_publications(id, platform, publish_at, caption, hashtags, status), scripts(body), shots(id, description, done, position)",
      )
      .eq("id", id)
      .eq("workspace_id", ws.id)
      .maybeSingle(),
    supabase.from("attachments").select("id, name, url").eq("entity_type", "content").eq("entity_id", id).order("created_at"),
  ]);
  if (!content) notFound();

  const raw = content as unknown as Omit<Material, "script" | "attachments"> & { scripts: { body: Material["script"] } | { body: Material["script"] }[] | null };
  const script = Array.isArray(raw.scripts) ? raw.scripts[0]?.body : raw.scripts?.body;
  const material: Material = {
    ...raw,
    script: script ?? null,
    attachments: (attachments ?? []) as Material["attachments"],
    shots: [...(raw.shots ?? [])].sort((a, b) => a.position - b.position),
  };

  return (
    <MaterialLoader
      material={material}
      workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }}
      clients={refs.clients.filter((c) => c.workspace_id === ws.id)}
      projects={refs.projects.filter((p) => p.workspace_id === ws.id)}
    />
  );
}
