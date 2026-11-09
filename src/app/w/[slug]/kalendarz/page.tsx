import type { Metadata } from "next";
import type { Layer, WorkspaceLayers } from "@/lib/calendar";
import type { ClientColor } from "@/lib/palette";
import { getSession, getWorkspace, getWorkspaces } from "@/lib/workspace";
import { CalendarLoader } from "./calendar-loader";

export const metadata: Metadata = { title: "Kalendarz" };

type CalendarRow = {
  id: string;
  workspace_id: string;
  kind: Layer["kind"];
  name: string;
  color: ClientColor;
  position: number;
  client_id: string | null;
  clients: { archived_at: string | null } | null;
};

const KIND_ORDER: Record<Layer["kind"], number> = { client: 0, custom: 1, google: 2, tasks: 3 };

export default async function CalendarPage({ params }: PageProps<"/w/[slug]/kalendarz">) {
  const { slug } = await params;
  const [current, workspaces, { supabase, user }] = await Promise.all([getWorkspace(slug), getWorkspaces(), getSession()]);

  const [{ data: calendars }, { data: visibility }] = await Promise.all([
    supabase
      .from("calendars")
      .select("id, workspace_id, kind, name, color, position, client_id, clients(archived_at)")
      .in("workspace_id", workspaces.map((w) => w.id)),
    supabase.from("calendar_visibility").select("calendar_id, visible").eq("user_id", user.id),
  ]);

  const hidden = new Set((visibility ?? []).filter((v) => !v.visible).map((v) => v.calendar_id));
  const rows = ((calendars ?? []) as unknown as CalendarRow[]).filter((c) => !c.clients?.archived_at);

  // Bieżący workspace na górze, potem pozostałe w kolejności dołączenia.
  const ordered = [current, ...workspaces.filter((w) => w.id !== current.id)];
  const groups: WorkspaceLayers[] = ordered.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    color: w.color,
    layers: rows
      .filter((c) => c.workspace_id === w.id)
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.position - b.position || a.name.localeCompare(b.name, "pl"))
      .map((c) => ({
        id: c.id,
        workspaceId: c.workspace_id,
        kind: c.kind,
        name: c.name,
        color: c.color,
        position: c.position,
        visible: !hidden.has(c.id),
      })),
  }));

  return <CalendarLoader groups={groups} currentWorkspaceId={current.id} />;
}
