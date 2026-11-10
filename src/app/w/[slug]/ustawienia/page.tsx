import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { googleConfigured } from "@/lib/google";
import { trelloConfigured, type TrelloLists } from "@/lib/trello";
import { getSession, getWorkspace } from "@/lib/workspace";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Ustawienia" };

export default async function SettingsPage({ params }: PageProps<"/w/[slug]/ustawienia">) {
  const { slug } = await params;
  const [ws, { supabase, profile, user }] = await Promise.all([getWorkspace(slug), getSession()]);
  const { data: status } = await supabase.rpc("integration_status", { ws: ws.id }).maybeSingle<{
    slack_connected: boolean;
    slack_channel: string | null;
    slack_reminders: boolean;
    trello_connected: boolean;
    trello_member: string | null;
    trello_board_id: string | null;
    trello_board_name: string | null;
    trello_lists: TrelloLists | null;
    trello_sync: boolean;
  }>();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ustawienia" description={`Workspace ${ws.name}, integracje i Twoje konto.`} />
      <SettingsView
        workspace={{ name: ws.name, slug: ws.slug, color: ws.color, isOwner: ws.role === "owner" }}
        slack={{ connected: Boolean(status?.slack_connected), channel: status?.slack_channel ?? null, reminders: Boolean(status?.slack_reminders) }}
        trello={{
          configured: trelloConfigured,
          connected: Boolean(status?.trello_connected),
          member: status?.trello_member ?? null,
          boardId: status?.trello_board_id ?? null,
          boardName: status?.trello_board_name ?? null,
          lists: status?.trello_lists ?? null,
          sync: Boolean(status?.trello_sync),
        }}
        googleReady={googleConfigured}
        account={{ email: profile?.email ?? user.email ?? "", name: profile?.full_name ?? null }}
      />
    </div>
  );
}
