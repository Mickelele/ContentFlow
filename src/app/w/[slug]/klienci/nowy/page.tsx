import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import type { ClientColor } from "@/lib/palette";
import { getSession, getWorkspace } from "@/lib/workspace";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Nowy klient" };

export default async function NewClientPage({ params }: PageProps<"/w/[slug]/klienci/nowy">) {
  const { slug } = await params;
  const [ws, { supabase }] = await Promise.all([getWorkspace(slug), getSession()]);
  const { data } = await supabase.from("clients").select("color").eq("workspace_id", ws.id).is("archived_at", null);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nowy klient" description={`Dodajesz klienta do workspace'u ${ws.name}.`} />
      <ClientForm
        action={createClientAction.bind(null, slug)}
        cancelHref={`/w/${slug}/klienci`}
        submitLabel="Dodaj klienta"
        usedColors={(data ?? []).map((r) => r.color as ClientColor)}
      />
    </div>
  );
}
