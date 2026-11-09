import { redirect } from "next/navigation";
import { getSession, getWorkspace } from "@/lib/workspace";

// Wejście do workspace'u (np. z przełącznika): zapamiętaj go jako ostatni i otwórz „Dziś”.
export default async function WorkspaceEntry({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const ws = await getWorkspace(slug);
  const { supabase, user, profile } = await getSession();
  if (profile?.last_workspace_id !== ws.id) {
    await supabase.from("profiles").update({ last_workspace_id: ws.id }).eq("id", user.id);
  }
  redirect(`/w/${ws.slug}/dzis`);
}

// Cała aplikacja zależy od sesji użytkownika, więc renderujemy ją na żądanie.
export const instant = false;
