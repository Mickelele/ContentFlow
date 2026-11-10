import type { Metadata } from "next";
import type { Layer, WorkspaceLayers } from "@/lib/calendar";
import type { ClientColor } from "@/lib/palette";
import { getRefs } from "@/lib/refs";
import { getSession, getWorkspace } from "@/lib/workspace";
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
  google_calendar_id: string | null;
  clients: { archived_at: string | null } | null;
};

const KIND_ORDER: Record<Layer["kind"], number> = { client: 0, custom: 1, google: 2, tasks: 3 };

export default async function CalendarPage({ params }: PageProps<"/w/[slug]/kalendarz">) {
  const { slug } = await params;
  const [current, { supabase, user }] = await Promise.all([getWorkspace(slug), getSession()]);

  const [{ data: calendars }, { data: visibility }] = await Promise.all([
    supabase
      .from("calendars")
      .select("id, workspace_id, kind, name, color, position, client_id, google_calendar_id, clients(archived_at)")
      .eq("workspace_id", current.id),
    supabase.from("calendar_visibility").select("calendar_id, visible").eq("user_id", user.id),
  ]);

  const hidden = new Set((visibility ?? []).filter((v) => !v.visible).map((v) => v.calendar_id));
  const rows = ((calendars ?? []) as unknown as CalendarRow[]).filter((c) => !c.clients?.archived_at);

  // Tylko bieżący workspace (D-34): wpisy z innych workspace'ów nie mają tu warstw, więc kalendarz ich nie pokaże.
  // Inny workspace = przełącznik na górze panelu.
  const ordered = [current];
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
        clientId: c.client_id,
        googleCalendarId: c.google_calendar_id,
      })),
  }));

  const { projects } = await getRefs();
  return <CalendarLoader groups={groups} currentWorkspaceId={current.id} projects={projects} />;
}
