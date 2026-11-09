import type { Metadata } from "next";
import { getRefs } from "@/lib/refs";
import { getSession, getWorkspace } from "@/lib/workspace";
import { DayLoader } from "./day-loader";

export const metadata: Metadata = { title: "Dziś" };

export default async function TodayPage({ params }: PageProps<"/w/[slug]/dzis">) {
  const { slug } = await params;
  const [ws, refs, { profile }] = await Promise.all([getWorkspace(slug), getRefs(), getSession()]);

  // Bieżący workspace pierwszy — do niego trafiają zadania z szybkiego dodawania.
  const workspaces = [...refs.workspaces].sort((a, b) => Number(b.id === ws.id) - Number(a.id === ws.id));
  return (
    <DayLoader
      workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }}
      workspaces={workspaces}
      clients={refs.clients}
      projects={refs.projects}
      firstName={profile?.full_name?.split(" ")[0] ?? null}
    />
  );
}
