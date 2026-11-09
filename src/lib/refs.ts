import "server-only";
import type { ClientRef, ProjectRef, WorkspaceRef } from "@/lib/tasks";
import { getSession, getWorkspaces } from "@/lib/workspace";

/** Workspace'y użytkownika, ich aktywni klienci i aktywne projekty — do list, filtrów i formularzy. */
export async function getRefs(): Promise<{ workspaces: WorkspaceRef[]; clients: ClientRef[]; projects: ProjectRef[] }> {
  const [workspaces, { supabase }] = await Promise.all([getWorkspaces(), getSession()]);
  const ids = workspaces.map((w) => w.id);
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, workspace_id, name, color").in("workspace_id", ids).is("archived_at", null).order("name"),
    supabase.from("projects").select("id, workspace_id, client_id, name").in("workspace_id", ids).neq("status", "archived").order("name"),
  ]);
  return {
    workspaces: workspaces.map(({ id, name, slug, color }) => ({ id, name, slug, color })),
    clients: (clients ?? []) as ClientRef[],
    projects: (projects ?? []) as ProjectRef[],
  };
}
