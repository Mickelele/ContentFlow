import { redirect } from "next/navigation";
import { getSession, getWorkspaces } from "@/lib/workspace";

export default async function Home() {
  const [{ profile }, workspaces] = await Promise.all([getSession(), getWorkspaces()]);
  if (workspaces.length === 0) redirect("/nowy-workspace");

  const last = workspaces.find((w) => w.id === profile?.last_workspace_id) ?? workspaces[0];
  redirect(`/w/${last.slug}/dzis`);
}

// Cała aplikacja zależy od sesji użytkownika, więc renderujemy ją na żądanie.
export const instant = false;
