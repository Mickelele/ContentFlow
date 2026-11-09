import type { Metadata } from "next";
import { getRefs } from "@/lib/refs";
import { getWorkspace } from "@/lib/workspace";
import { TasksLoader } from "./tasks-loader";

export const metadata: Metadata = { title: "Zadania" };

export default async function TasksPage({ params }: PageProps<"/w/[slug]/zadania">) {
  const { slug } = await params;
  const [ws, refs] = await Promise.all([getWorkspace(slug), getRefs()]);
  return (
    <TasksLoader
      workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }}
      workspaces={refs.workspaces}
      clients={refs.clients}
    />
  );
}
