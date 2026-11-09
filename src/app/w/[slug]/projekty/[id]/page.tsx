import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { CONTENT_TYPES, STAGE_LABEL, type ContentStage, type ContentType } from "@/lib/content";
import { colorVars } from "@/lib/palette";
import { getRefs } from "@/lib/refs";
import { getSession, getWorkspace } from "@/lib/workspace";
import { PROJECT_STATUS, type ProjectRow } from "@/lib/projects";
import { EditProjectButton } from "./edit-project";

export const metadata: Metadata = { title: "Projekt" };

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });
const dtFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });

export default async function ProjectPage({ params }: PageProps<"/w/[slug]/projekty/[id]">) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ws, refs, { supabase }] = await Promise.all([getWorkspace(slug), getRefs(), getSession()]);

  const [{ data: project }, { data: content }, { data: tasks }, { data: events }] = await Promise.all([
    supabase.from("projects").select("id, name, description, status, client_id, starts_on, ends_on").eq("id", id).eq("workspace_id", ws.id).maybeSingle(),
    supabase.from("content").select("id, title, type, stage").eq("project_id", id).order("updated_at", { ascending: false }),
    supabase.from("tasks").select("id, title, status, due_at").eq("project_id", id).is("parent_id", null).order("status").order("due_at", { nullsFirst: false }),
    supabase.from("events").select("id, title, starts_at, all_day").eq("project_id", id).gte("ends_at", new Date().toISOString()).order("starts_at").limit(10),
  ]);
  if (!project) notFound();
  const p = project as Omit<ProjectRow, "content_count" | "task_count">;
  const client = refs.clients.find((c) => c.id === p.client_id);
  const base = `/w/${slug}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`${base}/projekty`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Projekty
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4 pb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{p.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            {client ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: colorVars(client.color).solid }} aria-hidden="true" />
                {client.name}
              </span>
            ) : null}
            <span>{PROJECT_STATUS[p.status]}</span>
            {p.starts_on || p.ends_on ? (
              <span className="tabular">
                {p.starts_on ? dateFmt.format(new Date(`${p.starts_on}T12:00:00Z`)) : "…"} – {p.ends_on ? dateFmt.format(new Date(`${p.ends_on}T12:00:00Z`)) : "…"}
              </span>
            ) : null}
          </p>
          {p.description ? <p className="mt-3 max-w-2xl whitespace-pre-line text-ink-2">{p.description}</p> : null}
        </div>
        <EditProjectButton project={p} workspace={{ id: ws.id, name: ws.name, slug: ws.slug, color: ws.color }} clients={refs.clients.filter((c) => c.workspace_id === ws.id)} />
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="pc-h">
          <h2 id="pc-h" className="mb-3 text-lg font-semibold">
            Materiały <span className="tabular text-sm font-normal text-ink-3">{content?.length ?? 0}</span>
          </h2>
          {content?.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {(content as { id: string; title: string; type: ContentType; stage: ContentStage }[]).map((c) => {
                const T = CONTENT_TYPES[c.type];
                return (
                  <li key={c.id}>
                    <Link href={`${base}/content/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <T.icon className="size-4 shrink-0 text-ink-2" aria-label={T.label} />
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      <span className="shrink-0 text-[13px] text-ink-3">{STAGE_LABEL[c.stage]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-surface-2 px-5 py-5 text-sm text-ink-2">
              Brak materiałów. Projekt wybierzesz przy tworzeniu materiału albo na jego stronie.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="pt-h">
            <h2 id="pt-h" className="mb-3 text-lg font-semibold">
              Zadania <span className="tabular text-sm font-normal text-ink-3">{tasks?.length ?? 0}</span>
            </h2>
            {tasks?.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {(tasks as { id: string; title: string; status: string; due_at: string | null }[]).map((t) => (
                  <li key={t.id}>
                    <Link href={`${base}/zadania?zadanie=${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      {t.status === "done" ? (
                        <CheckCircle2 className="size-4 shrink-0 text-ink-3" aria-label="Ukończone" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-ink-3" aria-label="Do zrobienia" />
                      )}
                      <span className={t.status === "done" ? "min-w-0 flex-1 truncate text-ink-3 line-through" : "min-w-0 flex-1 truncate"}>{t.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-surface-2 px-5 py-5 text-sm text-ink-2">Brak zadań. Projekt ustawisz w szczegółach zadania.</p>
            )}
          </section>

          <section aria-labelledby="pe-h">
            <h2 id="pe-h" className="mb-3 text-lg font-semibold">
              Nadchodzące wydarzenia
            </h2>
            {events?.length ? (
              <ul className="flex flex-col gap-1">
                {(events as { id: string; title: string; starts_at: string; all_day: boolean }[]).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate">{e.title}</span>
                    <span className="tabular shrink-0 text-ink-3">{dtFmt.format(new Date(e.starts_at))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">Brak. Projekt wybierzesz w edytorze wydarzenia w kalendarzu.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
