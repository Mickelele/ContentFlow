import type { Metadata } from "next";
import { connection } from "next/server";
import { Logo } from "@/components/logo";
import { LinkRow } from "@/components/link-chip";
import { CONTENT_TYPES, PLATFORM_LIST, formatHashtags, type ContentType, type Platform } from "@/lib/content";
import { docToHtml } from "@/lib/doc-html";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewForm } from "./review-form";
import "@/components/editor/rich-text.css";

export const metadata: Metadata = { title: "Akceptacja materiału", robots: { index: false, follow: false } };

const dtFmt = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });

type Req = {
  id: string;
  status: "pending" | "approved" | "changes_requested" | "cancelled";
  message: string | null;
  client_name: string | null;
  client_comment: string | null;
  responded_at: string | null;
  expires_at: string;
  content_id: string;
  script_versions: { body: unknown } | null;
  content: {
    title: string;
    type: ContentType;
    description: string | null;
    clients: { name: string } | null;
    workspaces: { name: string } | null;
    content_publications: { platform: Platform; publish_at: string; caption: string | null; hashtags: string[]; status: string }[];
  } | null;
};

/** Publiczna strona akceptacji: klient bez konta ogląda materiał i odpowiada. Dostęp tylko przez token z linku. */
export default async function ReviewPage({ params }: PageProps<"/akceptacja/[token]">) {
  await connection();
  const { token } = await params;
  const admin = createAdminClient();
  const { data } = /^[0-9a-f]{40,80}$/.test(token)
    ? await admin
        .from("approval_requests")
        .select(
          "id, status, message, client_name, client_comment, responded_at, expires_at, content_id, script_versions(body), content(title, type, description, clients(name), workspaces(name), content_publications(platform, publish_at, caption, hashtags, status))",
        )
        .eq("token", token)
        .maybeSingle()
    : { data: null };
  const req = data as unknown as Req | null;
  const { data: links } = req
    ? await admin.from("attachments").select("id, name, url").eq("entity_type", "content").eq("entity_id", req.content_id).order("created_at")
    : { data: [] };

  const expired = req ? new Date(req.expires_at) < new Date() : false;
  const c = req?.content;
  const html = docToHtml(req?.script_versions?.body);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Logo />
        {c?.workspaces ? <p className="text-sm text-ink-3">od {c.workspaces.name}</p> : null}
      </header>

      {!req || !c || req.status === "cancelled" ? (
        <section className="rounded-2xl bg-surface-2 px-6 py-12 text-center">
          <h1 className="text-xl font-semibold">Ten link jest nieaktywny</h1>
          <p className="mt-2 text-ink-2">Prośba została wycofana albo adres jest niepełny. Poproś o nowy link.</p>
        </section>
      ) : (
        <>
          <section className="mb-10">
            <p className="text-sm text-ink-2">
              {CONTENT_TYPES[c.type].label}
              {c.clients ? ` · ${c.clients.name}` : ""}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{c.title}</h1>
            {req.message ? <p className="mt-4 max-w-2xl rounded-xl bg-surface-2 px-4 py-3 whitespace-pre-line">{req.message}</p> : null}
          </section>

          {html ? (
            <section className="mb-10" aria-labelledby="script-h">
              <h2 id="script-h" className="mb-3 text-lg font-semibold">
                Scenariusz
              </h2>
              <div className="cf-prose rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6" dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          ) : null}

          {c.content_publications.filter((p) => p.status !== "cancelled").length ? (
            <section className="mb-10" aria-labelledby="pub-h">
              <h2 id="pub-h" className="mb-3 text-lg font-semibold">
                Publikacja
              </h2>
              <ul className="flex flex-col gap-3">
                {c.content_publications
                  .filter((p) => p.status !== "cancelled")
                  .sort((a, b) => a.publish_at.localeCompare(b.publish_at))
                  .map((p, i) => (
                    <li key={i} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                      <p className="font-medium first-letter:uppercase">
                        {PLATFORM_LIST.find((x) => x.key === p.platform)?.label} · {dtFmt.format(new Date(p.publish_at))}
                      </p>
                      {p.caption ? <p className="mt-2 whitespace-pre-line text-ink-2">{p.caption}</p> : null}
                      {p.hashtags.length ? <p className="mt-2 text-sm text-ink-3">{formatHashtags(p.hashtags)}</p> : null}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {links?.length ? (
            <section className="mb-10" aria-labelledby="links-h">
              <h2 id="links-h" className="mb-2 text-lg font-semibold">
                Pliki
              </h2>
              <ul>
                {links.map((l) => (
                  <li key={l.id}>
                    <LinkRow url={l.url} name={l.name} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="decision-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="decision-h" className="text-lg font-semibold">
              Twoja decyzja
            </h2>
            {req.status !== "pending" ? (
              <p className="mt-2 text-ink-2">
                {req.status === "approved" ? "Materiał został zaakceptowany" : "Poproszono o poprawki"}
                {req.client_name ? ` przez ${req.client_name}` : ""}
                {req.responded_at ? ` · ${dtFmt.format(new Date(req.responded_at))}` : ""}. Dziękujemy!
              </p>
            ) : expired ? (
              <p className="mt-2 text-ink-2">Link wygasł. Poproś o nowy.</p>
            ) : (
              <ReviewForm token={token} />
            )}
          </section>
        </>
      )}
    </main>
  );
}

// Strona zależy od tokenu z adresu i danych z bazy — renderowana na żądanie.
export const instant = false;
