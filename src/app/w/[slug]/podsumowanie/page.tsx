import type { Metadata } from "next";
import { getRefs } from "@/lib/refs";
import { getSession, getWorkspace } from "@/lib/workspace";
import { StatsLoader } from "./stats-loader";

export const metadata: Metadata = { title: "Podsumowanie" };

export default async function StatsPage({ params }: PageProps<"/w/[slug]/podsumowanie">) {
  const { slug } = await params;
  const [ws, refs, { supabase }] = await Promise.all([getWorkspace(slug), getRefs(), getSession()]);
  const { data: status } = await supabase.rpc("integration_status", { ws: ws.id }).maybeSingle<{ slack_connected: boolean }>();
  return (
    <StatsLoader
      workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }}
      clients={refs.clients.filter((c) => c.workspace_id === ws.id)}
      slackConnected={Boolean(status?.slack_connected)}
    />
  );
}
