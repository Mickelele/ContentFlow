"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronRight, Columns3, List, Plus, Search } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { ClientChip } from "@/components/tasks/task-row";
import { Button, Field, Input, PageHeader, cx, inputClass } from "@/components/ui";
import { CONTENT_TYPES, PLATFORM_LIST, STAGES, STAGE_LABEL, stageIndex, type ContentStage, type ContentType, type Platform } from "@/lib/content";
import { createClient } from "@/lib/supabase/client";
import type { ClientRef, ProjectRef, WorkspaceRef } from "@/lib/tasks";
import { ContentBoard } from "./content-board";

export type ContentRow = {
  id: string;
  title: string;
  type: ContentType;
  stage: ContentStage;
  client_id: string | null;
  project_id: string | null;
  board_position: number | null;
  platforms: Platform[];
  next: { label: string; at: string } | null;
};

const NEXT_LABEL: Record<string, string> = {
  recording: "Nagranie",
  editing: "Montaż",
  approval: "Akceptacja",
  publication: "Publikacja",
};
const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });

// Widok (tablica / lista) zapamiętany w przeglądarce; serwer renderuje tablicę.
const VIEW_KEY = "cf-content-view";
const viewListeners = new Set<() => void>();
const readView = (): "board" | "list" => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board";
  } catch {
    return "board";
  }
};
const writeView = (v: "board" | "list") => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {}
  viewListeners.forEach((l) => l());
};
const subscribeView = (cb: () => void) => {
  viewListeners.add(cb);
  return () => viewListeners.delete(cb);
};

export function ContentList({
  workspace,
  rows,
  clients,
  projects,
}: {
  workspace: WorkspaceRef;
  rows: ContentRow[];
  clients: ClientRef[];
  projects: ProjectRef[];
}) {
  const [stage, setStage] = useState<ContentStage | "active" | "all">("active");
  const [client, setClient] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const view = useSyncExternalStore(subscribeView, readView, () => "board" as const);

  const filtered = rows.filter(
    (r) =>
      (stage === "all" || (stage === "active" ? r.stage !== "published" : r.stage === stage)) &&
      (!client || r.client_id === client) &&
      (!query || r.title.toLowerCase().includes(query.toLowerCase())),
  );
  // Tablica pokazuje wszystkie etapy; filtrują ją tylko klient i wyszukiwarka.
  const boardRows = rows.filter((r) => (!client || r.client_id === client) && (!query || r.title.toLowerCase().includes(query.toLowerCase())));
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, rows.filter((r) => r.stage === s.key).length]));

  return (
    <div className={cx("mx-auto", view === "board" ? "max-w-none" : "max-w-4xl")}>
      <PageHeader
        title="Content"
        description="Materiały od pomysłu do publikacji. Terminy produkcji i publikacji trafiają do kalendarza."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nowy materiał
          </Button>
        }
      />

      {view === "list" ? (
      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5" role="tablist" aria-label="Etap produkcji">
          {(
            [
              { key: "active", label: "W toku", n: rows.filter((r) => r.stage !== "published").length },
              ...STAGES.map((s) => ({ key: s.key, label: s.label, n: counts[s.key] })),
              { key: "all", label: "Wszystkie", n: rows.length },
            ] as { key: typeof stage; label: string; n: number }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={stage === t.key}
              onClick={() => setStage(t.key)}
              className={cx(
                "pressable inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap",
                stage === t.key ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:bg-surface-2",
              )}
            >
              {t.label}
              <span className={cx("tabular text-xs", stage === t.key ? "opacity-70" : "text-ink-3")}>{t.n}</span>
            </button>
          ))}
        </div>
      </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Widok">
          {(
            [
              ["board", "Tablica", Columns3],
              ["list", "Lista", List],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={view === k}
              onClick={() => writeView(k)}
              className={cx(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm",
                view === k ? "bg-surface font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj materiału" aria-label="Szukaj materiału" className="pl-9" />
        </div>
        {clients.length > 0 ? (
          <select aria-label="Filtruj według klienta" value={client} onChange={(e) => setClient(e.target.value)} className={cx(inputClass, "w-auto")}>
            <option value="">Wszyscy klienci</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {view === "board" && rows.length > 0 ? (
        <ContentBoard
          key={boardRows.map((r) => r.id + r.stage).join("|")}
          slug={workspace.slug}
          rows={boardRows}
          clients={clients}
        />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-surface-2 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">Dodaj pierwszy materiał</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-2">
            Rolka, post, karuzela albo film. Ustawisz w nim scenariusz, listę ujęć, terminy nagrania i montażu oraz publikacje na każdej platformie.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nowy materiał
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-6 py-10 text-center text-ink-2">Żaden materiał nie pasuje do filtrów.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((r) => {
            const T = CONTENT_TYPES[r.type];
            const c = r.client_id ? clientById.get(r.client_id) : undefined;
            const pct = (stageIndex(r.stage) + 1) / STAGES.length;
            return (
              <li key={r.id}>
                <Link href={`/w/${workspace.slug}/content/${r.id}`} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2 sm:px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2 group-hover:bg-surface-3">
                    <T.icon className="size-5" aria-label={T.label} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-3">
                      {c ? <ClientChip client={c} /> : null}
                      {r.next ? (
                        <span className="tabular">
                          {NEXT_LABEL[r.next.label]} · {dateFmt.format(new Date(r.next.at))}
                        </span>
                      ) : null}
                      {r.platforms.length ? <span>{r.platforms.map((p) => PLATFORM_LIST.find((x) => x.key === p)?.label).join(", ")}</span> : null}
                    </p>
                  </div>
                  <div className="hidden w-32 shrink-0 sm:block" aria-label={`Etap: ${STAGE_LABEL[r.stage]}`}>
                    <p className="mb-1 text-right text-[13px] text-ink-2">{STAGE_LABEL[r.stage]}</p>
                    <div className="h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                      <div className="h-full origin-left rounded-full bg-ink" style={{ transform: `scaleX(${pct})` }} />
                    </div>
                  </div>
                  <span className="text-[13px] text-ink-2 sm:hidden">{STAGE_LABEL[r.stage]}</span>
                  <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <NewContentDialog
        open={creating}
        onClose={() => setCreating(false)}
        workspace={workspace}
        clients={clients}
        projects={projects}
        defaultClient={client}
      />
    </div>
  );
}

function NewContentDialog({
  open,
  onClose,
  workspace,
  clients,
  projects,
  defaultClient,
}: {
  open: boolean;
  onClose: () => void;
  workspace: WorkspaceRef;
  clients: ClientRef[];
  projects: ProjectRef[];
  defaultClient: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ContentType>("reel");
  const [client, setClient] = useState(defaultClient);
  const [project, setProject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clientProjects = projects.filter((p) => !client || !p.client_id || p.client_id === client);

  const create = async () => {
    if (!title.trim()) return setError("Wpisz nazwę materiału.");
    setBusy(true);
    const { data, error } = await supabase
      .from("content")
      .insert({ workspace_id: workspace.id, title: title.trim(), type, client_id: client || null, project_id: project || null })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return setError("Nie udało się utworzyć materiału.");
    }
    router.push(`/w/${workspace.slug}/content/${data.id}`);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nowy materiał"
      size="sm"
      footer={
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" form="new-content" variant="primary" className="h-9" disabled={busy}>
            {busy ? "Tworzę…" : "Utwórz"}
          </Button>
        </div>
      }
    >
      <form
        id="new-content"
        noValidate
        className="flex flex-col gap-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <Field label="Nazwa" htmlFor="nc-title" error={error ?? undefined}>
          <Input id="nc-title" data-autofocus="" value={title} onChange={(e) => (setTitle(e.target.value), setError(null))} placeholder="Rolka – szkolenie PPL(H)" />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium">Rodzaj</legend>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(Object.keys(CONTENT_TYPES) as ContentType[]).map((t) => {
              const T = CONTENT_TYPES[t];
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={cx(
                    "pressable flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm",
                    type === t ? "border-ink bg-surface-2 font-medium" : "border-line text-ink-2 hover:bg-surface-2",
                  )}
                >
                  <T.icon className="size-5" aria-hidden="true" />
                  {T.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Klient" htmlFor="nc-client">
          <select id="nc-client" className={inputClass} value={client} onChange={(e) => (setClient(e.target.value), setProject(""))}>
            <option value="">Bez klienta</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {clientProjects.length > 0 ? (
          <Field label="Projekt" htmlFor="nc-project">
            <select id="nc-project" className={inputClass} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Bez projektu</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}
