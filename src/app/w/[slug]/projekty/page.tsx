import type { Metadata } from "next";
import { getRefs } from "@/lib/refs";
import { getSession, getWorkspace } from "@/lib/workspace";
import type { ProjectRow } from "@/lib/projects";
import { ProjectsList } from "./projects-list";

export const metadata: Metadata = { title: "Projekty" };

export default async function ProjectsPage({ params }: PageProps<"/w/[slug]/projekty">) {
  const { slug } = await params;
  const [ws, refs, { supabase }] = await Promise.all([getWorkspace(slug), getRefs(), getSession()]);
  const { data } = await supabase
    .from("projects")
    .select("id, name, description, status, client_id, starts_on, ends_on, content(count), tasks(count)")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });

  type Raw = Omit<ProjectRow, "content_count" | "task_count"> & { content: { count: number }[]; tasks: { count: number }[] };
  const rows: ProjectRow[] = ((data ?? []) as unknown as Raw[]).map(({ content, tasks, ...p }) => ({
    ...p,
    content_count: content?.[0]?.count ?? 0,
    task_count: tasks?.[0]?.count ?? 0,
  }));

  return (
    <ProjectsList
      workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }}
      rows={rows}
      clients={refs.clients.filter((c) => c.workspace_id === ws.id)}
    />
  );
}
