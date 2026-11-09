"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, Field, Input, PageHeader, Textarea, cx, inputClass } from "@/components/ui";
import { colorVars } from "@/lib/palette";
import { PROJECT_STATUS, type ProjectRow, type ProjectStatus } from "@/lib/projects";
import { createClient } from "@/lib/supabase/client";
import type { ClientRef, WorkspaceRef } from "@/lib/tasks";

export type { ProjectRow, ProjectStatus };

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });
const fmt = (d: string) => dateFmt.format(new Date(`${d}T12:00:00`));

export function ProjectsList({ workspace, rows, clients }: { workspace: WorkspaceRef; rows: ProjectRow[]; clients: ClientRef[] }) {
  const [editing, setEditing] = useState<Partial<ProjectRow> | null>(null);
  const [key, setKey] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const visible = rows.filter((r) => showArchived || r.status !== "archived");

  // Grupy według klienta (bez klienta na końcu).
  const groups = [
    ...clients.map((c) => ({ key: c.id, client: c, items: visible.filter((r) => r.client_id === c.id) })),
    { key: "none", client: undefined, items: visible.filter((r) => !r.client_id || !clientById.has(r.client_id)) },
  ].filter((g) => g.items.length > 0);

  const open = (p: Partial<ProjectRow>) => {
    setKey((k) => k + 1);
    setEditing(p);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Projekty"
        description="Kampanie i zlecenia klientów. Projekt zbiera materiały, zadania i wydarzenia."
        actions={
          <Button variant="primary" onClick={() => open({ status: "active" })}>
            <Plus className="size-4" aria-hidden="true" />
            Nowy projekt
          </Button>
        }
      />

      {rows.some((r) => r.status === "archived") ? (
        <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Pokaż zarchiwizowane
        </label>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-surface-2 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">Załóż pierwszy projekt</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-2">Na przykład „Kampania wiosenna” albo „Pakiet 8 rolek — listopad”. Materiały i zadania przypiszesz do niego później.</p>
          <Button variant="primary" className="mt-6" onClick={() => open({ status: "active" })}>
            <Plus className="size-4" aria-hidden="true" />
            Nowy projekt
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.client?.name ?? "Bez klienta"}>
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                {g.client ? <span className="size-2.5 rounded-full" style={{ background: colorVars(g.client.color).solid }} aria-hidden="true" /> : null}
                {g.client?.name ?? "Bez klienta"}
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {g.items.map((p) => (
                  <li key={p.id}>
                    <Link href={`/w/${workspace.slug}/projekty/${p.id}`} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className={cx("truncate font-medium", p.status === "archived" && "text-ink-3")}>{p.name}</p>
                        <p className="tabular mt-0.5 text-[13px] text-ink-3">
                          {[
                            p.status !== "active" ? PROJECT_STATUS[p.status] : null,
                            p.starts_on || p.ends_on ? `${p.starts_on ? fmt(p.starts_on) : "…"} – ${p.ends_on ? fmt(p.ends_on) : "…"}` : null,
                            `${p.content_count} mat. · ${p.task_count} zad.`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ProjectDialog key={key} project={editing} workspace={workspace} clients={clients} onClose={() => setEditing(null)} />
    </div>
  );
}

export function ProjectDialog({
  project,
  workspace,
  clients,
  onClose,
}: {
  project: Partial<ProjectRow> | null;
  workspace: WorkspaceRef;
  clients: ClientRef[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? ("active" as ProjectStatus),
    client_id: project?.client_id ?? "",
    starts_on: project?.starts_on ?? "",
    ends_on: project?.ends_on ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const id = project?.id;

  const save = async () => {
    if (!f.name.trim()) return setError("Wpisz nazwę projektu.");
    if (f.starts_on && f.ends_on && f.ends_on < f.starts_on) return setError("Koniec nie może być przed początkiem.");
    setBusy(true);
    const row = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      status: f.status,
      client_id: f.client_id || null,
      starts_on: f.starts_on || null,
      ends_on: f.ends_on || null,
    };
    const { data, error } = id
      ? await supabase.from("projects").update(row).eq("id", id).select("id").single()
      : await supabase.from("projects").insert({ ...row, workspace_id: workspace.id }).select("id").single();
    setBusy(false);
    if (error || !data) return setError("Nie udało się zapisać projektu.");
    onClose();
    if (id) router.refresh();
    else router.push(`/w/${workspace.slug}/projekty/${data.id}`);
  };

  const remove = async () => {
    if (!id) return;
    if (!confirm) return setConfirm(true);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return setError("Nie udało się usunąć projektu.");
    onClose();
    router.push(`/w/${workspace.slug}/projekty`);
    router.refresh();
  };

  return (
    <Dialog
      open={Boolean(project)}
      onClose={onClose}
      title={id ? "Projekt" : "Nowy projekt"}
      size="sm"
      footer={
        <>
          {id ? (
            <Button variant="danger" className="h-9 px-3" onClick={remove}>
              {confirm ? "Na pewno usunąć?" : "Usuń"}
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" className="h-9 px-3" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" form="project-form" variant="primary" className="h-9" disabled={busy}>
              {busy ? "Zapisuję…" : "Zapisz"}
            </Button>
          </div>
        </>
      }
    >
      <form
        id="project-form"
        noValidate
        className="flex flex-col gap-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nazwa" htmlFor="pr-name">
          <Input id="pr-name" data-autofocus={!id ? "" : undefined} value={f.name} onChange={(e) => (setF({ ...f, name: e.target.value }), setError(null))} placeholder="Pakiet 8 rolek — listopad" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Klient" htmlFor="pr-client">
            <select id="pr-client" className={inputClass} value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
              <option value="">Bez klienta</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="pr-status">
            <select id="pr-status" className={inputClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectStatus })}>
              {(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Początek" htmlFor="pr-start">
            <Input id="pr-start" type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} />
          </Field>
          <Field label="Koniec" htmlFor="pr-end">
            <Input id="pr-end" type="date" min={f.starts_on || undefined} value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} />
          </Field>
        </div>
        <Field label="Opis" htmlFor="pr-desc">
          <Textarea id="pr-desc" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Zakres, ustalenia, budżet…" />
        </Field>
        {error ? (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
