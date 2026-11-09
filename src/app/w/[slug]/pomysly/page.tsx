import type { Metadata } from "next";
import { getRefs } from "@/lib/refs";
import { getWorkspace } from "@/lib/workspace";
import { NotesLoader } from "./notes-loader";

export const metadata: Metadata = { title: "Notatki i pomysły" };

export default async function NotesPage({ params }: PageProps<"/w/[slug]/pomysly">) {
  const { slug } = await params;
  const [ws, refs] = await Promise.all([getWorkspace(slug), getRefs()]);
  return (
    <NotesLoader
      workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }}
      clients={refs.clients.filter((c) => c.workspace_id === ws.id)}
    />
  );
}
