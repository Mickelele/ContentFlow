import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import type { ClientColor } from "@/lib/palette";
import { getSession, getWorkspace } from "@/lib/workspace";
import { setArchivedAction, updateClientAction } from "../actions";
import { ClientForm, type ClientValues } from "../client-form";

export const metadata: Metadata = { title: "Klient" };

export default async function ClientPage({ params }: PageProps<"/w/[slug]/klienci/[id]">) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ws, { supabase }] = await Promise.all([getWorkspace(slug), getSession()]);

  const [{ data: client }, { data: others }] = await Promise.all([
    supabase
      .from("clients")
      .select("name, color, contact_person, email, phone, website, notes, socials, archived_at")
      .eq("id", id)
      .eq("workspace_id", ws.id)
      .maybeSingle<ClientValues & { archived_at: string | null }>(),
    supabase.from("clients").select("color").eq("workspace_id", ws.id).is("archived_at", null).neq("id", id),
  ]);
  if (!client) notFound();

  const archived = Boolean(client.archived_at);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={client.name}
        description={archived ? "Klient jest w archiwum — nie pojawia się w kalendarzu." : "Dane klienta i jego kolor w kalendarzu."}
        actions={
          <form action={setArchivedAction.bind(null, slug, id, !archived)}>
            <Button type="submit" variant="secondary">
              {archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
              {archived ? "Przywróć" : "Archiwizuj"}
            </Button>
          </form>
        }
      />
      <ClientForm
        action={updateClientAction.bind(null, slug, id)}
        initial={client}
        cancelHref={`/w/${slug}/klienci${archived ? "?archiwum=1" : ""}`}
        submitLabel="Zapisz zmiany"
        usedColors={(others ?? []).map((r) => r.color as ClientColor)}
      />
    </div>
  );
}
