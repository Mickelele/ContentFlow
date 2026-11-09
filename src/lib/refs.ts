import "server-only";
import type { ClientRef, WorkspaceRef } from "@/lib/tasks";
import { getSession, getWorkspaces } from "@/lib/workspace";

/** Workspace'y użytkownika i ich aktywni klienci — do list, filtrów i formularzy. */
export async function getRefs(): Promise<{ workspaces: WorkspaceRef[]; clients: ClientRef[] }> {
  const [workspaces, { supabase }] = await Promise.all([getWorkspaces(), getSession()]);
  const { data } = await supabase
    .from("clients")
    .select("id, workspace_id, name, color")
    .in("workspace_id", workspaces.map((w) => w.id))
    .is("archived_at", null)
    .order("name");
  return {
    workspaces: workspaces.map(({ id, name, slug, color }) => ({ id, name, slug, color })),
    clients: (data ?? []) as ClientRef[],
  };
}
