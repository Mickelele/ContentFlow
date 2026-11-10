import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader, buttonClass, cx } from "@/components/ui";
import { colorVars, type ClientColor } from "@/lib/palette";
import { getSession, getWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Klienci" };

type Row = {
  id: string;
  name: string;
  color: ClientColor;
  contact_person: string | null;
  email: string | null;
  socials: Record<string, string>;
  archived_at: string | null;
};

const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export default async function ClientsPage({ params, searchParams }: PageProps<"/w/[slug]/klienci">) {
  const { slug } = await params;
  const archive = (await searchParams).archiwum === "1";
  const [ws, { supabase }] = await Promise.all([getWorkspace(slug), getSession()]);

  let query = supabase
    .from("clients")
    .select("id, name, color, contact_person, email, socials, archived_at")
    .eq("workspace_id", ws.id)
    .order("name");
  query = archive ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data } = await query;
  const clients = (data ?? []) as Row[];
  const base = `/w/${slug}/klienci`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={archive ? "Zarchiwizowani klienci" : "Klienci"}
        description={
          archive
            ? "Historia projektów zostaje zachowana. Przywróć klienta, żeby znów pojawiał się w kalendarzu."
            : `Każdy klient ma własny kolor i własną warstwę w kalendarzu workspace'u ${ws.name}.`
        }
        actions={
          archive ? null : (
            <Link href={`${base}/nowy`} className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden="true" />
              Nowy klient
            </Link>
          )
        }
      />

      <div className="mb-4 flex gap-1 text-sm" role="tablist" aria-label="Filtr klientów">
        <Link
          href={base}
          role="tab"
          aria-selected={!archive}
          className={cx("rounded-lg px-3 py-1.5", !archive ? "bg-surface-3 font-medium" : "text-ink-2 hover:bg-surface-2")}
        >
          Aktywni
        </Link>
        <Link
          href={`${base}?archiwum=1`}
          role="tab"
          aria-selected={archive}
          className={cx("rounded-lg px-3 py-1.5", archive ? "bg-surface-3 font-medium" : "text-ink-2 hover:bg-surface-2")}
        >
          Archiwum
        </Link>
      </div>

      {clients.length === 0 ? (
        <EmptyState archive={archive} newHref={`${base}/nowy`} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {clients.map((c) => {
            const v = colorVars(c.color);
            const socials = Object.keys(c.socials ?? {}).filter((k) => c.socials[k]);
            return (
              <li key={c.id}>
                <Link href={`${base}/${c.id}`} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2 sm:px-5">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                    style={{ background: v.fill, color: v.ink }}
                    aria-hidden="true"
                  >
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-sm text-ink-2">
                      {[c.contact_person, c.email].filter(Boolean).join(" · ") || "Brak danych kontaktowych"}
                    </p>
                  </div>
                  {socials.length > 0 ? (
                    <p className="hidden text-sm text-ink-3 sm:block">{socials.map((s) => SOCIAL_LABEL[s] ?? s).join(", ")}</p>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ archive, newHref }: { archive: boolean; newHref: string }) {
  if (archive) {
    return <p className="rounded-2xl bg-surface-2 px-6 py-10 text-center text-ink-2">Archiwum jest puste.</p>;
  }
  return (
    <div className="rounded-2xl bg-surface-2 px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">Dodaj pierwszego klienta</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-2">
        Klient dostaje kolor, którym będą oznaczone jego nagrania, montaże i publikacje w kalendarzu.
      </p>
      <Link href={newHref} className={buttonClass("primary", "mt-6")}>
        <Plus className="size-4" aria-hidden="true" />
        Nowy klient
      </Link>
    </div>
  );
}
