"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Plus, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, Field, Input, Textarea, cx, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  PRIORITIES,
  STATUSES,
  addDaysKey,
  dueFromInputs,
  dueToInputs,
  todayKey,
  type ChecklistItem,
  type ClientRef,
  type ProjectRef,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type WorkspaceRef,
} from "@/lib/tasks";
import { TaskCheckbox } from "./task-row";

export type TaskDraft = Partial<Task> & { workspace_id: string };

/**
 * Szczegóły zadania: nazwa, opis, status, priorytet, termin, plan dnia, klient i checklista.
 * Nowe zadanie zapisuje się dopiero przyciskiem „Zapisz”; checklista działa od razu dla zapisanego zadania.
 */
export function TaskDialog({
  draft,
  workspaces,
  clients,
  projects = [],
  onClose,
  onSaved,
  onDeleted,
}: {
  draft: TaskDraft | null;
  workspaces: WorkspaceRef[];
  clients: ClientRef[];
  projects?: ProjectRef[];
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const due = dueToInputs({ due_at: draft?.due_at ?? null, due_all_day: draft?.due_all_day ?? true });
  const [f, setF] = useState({
    title: draft?.title ?? "",
    description: draft?.description ?? "",
    status: (draft?.status ?? "todo") as TaskStatus,
    priority: (draft?.priority ?? "normal") as TaskPriority,
    workspace_id: draft?.workspace_id ?? workspaces[0]?.id ?? "",
    client_id: draft?.client_id ?? "",
    project_id: draft?.project_id ?? "",
    due_date: due.date,
    due_time: due.time,
    planned_on: draft?.planned_on ?? "",
  });
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = draft?.id;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    supabase
      .from("checklist_items")
      .select("id, task_id, label, done, position")
      .eq("task_id", id)
      .order("position")
      .then(({ data }) => {
        if (!alive) return;
        // Łączymy z pozycjami dodanymi, zanim odpowiedź wróciła — nic nie znika.
        const loaded = (data ?? []) as ChecklistItem[];
        const ids = new Set(loaded.map((i) => i.id));
        setItems((prev) => [...loaded, ...prev.filter((p) => !ids.has(p.id))]);
      });
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const wsClients = clients.filter((c) => c.workspace_id === f.workspace_id);
  const wsProjects = projects.filter(
    (p) => p.workspace_id === f.workspace_id && (!f.client_id || !p.client_id || p.client_id === f.client_id),
  );

  const save = async () => {
    if (!f.title.trim()) return setError("Wpisz nazwę zadania.");
    setBusy(true);
    const row = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      status: f.status,
      priority: f.priority,
      workspace_id: f.workspace_id,
      client_id: f.client_id || null,
      project_id: f.project_id || null,
      planned_on: f.planned_on || null,
      ...dueFromInputs(f.due_date, f.due_time),
    };
    const q = id
      ? supabase.from("tasks").update(row).eq("id", id)
      : supabase.from("tasks").insert({ ...row, position: Date.now() % 2147483647 });
    const { data, error } = await q.select("id, workspace_id, client_id, project_id, title, description, status, priority, due_at, due_all_day, planned_on, position, board_position, completed_at").single();
    if (error || !data) {
      setBusy(false);
      return setError("Nie udało się zapisać zadania. Spróbuj ponownie.");
    }
    // Nowe zadanie: pozycje checklisty dodane przed zapisem trafiają do bazy razem z nim.
    if (!id && items.length) {
      const { error: itemsError } = await supabase
        .from("checklist_items")
        .insert(items.map((i, n) => ({ task_id: data.id, label: i.label, done: i.done, position: n })));
      if (itemsError) setError("Zadanie zapisane, ale checklisty nie udało się zapisać.");
    }
    setBusy(false);
    onSaved({ ...data, checklist_total: items.length, checklist_done: items.filter((i) => i.done).length } as Task);
  };

  const remove = async () => {
    if (!id) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    setBusy(false);
    if (error) return setError("Nie udało się usunąć zadania.");
    onDeleted(id);
  };

  // ── Checklista (od razu w bazie) ──
  const addItem = async () => {
    const label = newItem.trim();
    if (!label) return;
    setNewItem("");
    // Zadanie jeszcze niezapisane: pozycja czeka lokalnie i zapisze się razem z zadaniem.
    if (!id) {
      setItems((xs) => [...xs, { id: `local-${crypto.randomUUID()}`, task_id: "", label, done: false, position: xs.length }]);
      return;
    }
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({ task_id: id, label, position: items.length })
      .select("id, task_id, label, done, position")
      .single();
    if (error || !data) return setError("Nie udało się dodać pozycji.");
    setItems((xs) => [...xs, data as ChecklistItem]);
  };
  const toggleItem = async (item: ChecklistItem) => {
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)));
    if (id) await supabase.from("checklist_items").update({ done: !item.done }).eq("id", item.id);
  };
  const deleteItem = async (item: ChecklistItem) => {
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    if (id) await supabase.from("checklist_items").delete().eq("id", item.id);
  };

  const today = todayKey();
  const planOptions = [
    { key: "", label: "Bez planu" },
    { key: today, label: "Dziś" },
    { key: addDaysKey(today, 1), label: "Jutro" },
  ];

  return (
    <Dialog
      open={Boolean(draft)}
      onClose={onClose}
      title={id ? "Zadanie" : "Nowe zadanie"}
      footer={
        <>
          {id ? (
            <Button type="button" variant="danger" onClick={remove} disabled={busy} className="h-9 px-3">
              <Trash2 className="size-4" aria-hidden="true" />
              {confirmDelete ? "Na pewno usunąć?" : "Usuń"}
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-9 px-3">
              Anuluj
            </Button>
            <Button type="submit" form="task-form" variant="primary" disabled={busy} className="h-9">
              {busy ? "Zapisuję…" : "Zapisz"}
            </Button>
          </div>
        </>
      }
    >
      <form
        id="task-form"
        noValidate
        className="flex flex-col gap-5 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nazwa" htmlFor="task-title">
          <Input
            id="task-title"
            value={f.title}
            data-autofocus={!id ? "" : undefined}
            onChange={(e) => {
              set("title", e.target.value);
              setError(null);
            }}
            placeholder="Zmontować rolkę PPL(H)"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {workspaces.length > 1 ? (
            <Field label="Workspace" htmlFor="task-ws">
              <select
                id="task-ws"
                className={inputClass}
                value={f.workspace_id}
                onChange={(e) => setF((p) => ({ ...p, workspace_id: e.target.value, client_id: "", project_id: "" }))}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Klient" htmlFor="task-client">
            <select
              id="task-client"
              className={inputClass}
              value={f.client_id}
              onChange={(e) => setF((p) => ({ ...p, client_id: e.target.value, project_id: "" }))}
            >
              <option value="">Bez klienta</option>
              {wsClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {wsProjects.length > 0 || f.project_id ? (
            <Field label="Projekt" htmlFor="task-project">
              <select id="task-project" className={inputClass} value={f.project_id} onChange={(e) => set("project_id", e.target.value)}>
                <option value="">Bez projektu</option>
                {wsProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Priorytet" htmlFor="task-prio">
            <select id="task-prio" className={inputClass} value={f.priority} onChange={(e) => set("priority", e.target.value as TaskPriority)}>
              {(Object.keys(PRIORITIES) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITIES[p].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="task-status">
            <select id="task-status" className={inputClass} value={f.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
              {(Object.keys(STATUSES) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUSES[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="flex items-center gap-2 text-sm font-medium">
            <CalendarCheck className="size-4 text-ink-2" aria-hidden="true" />
            Kiedy to zrobisz
          </legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {planOptions.map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={f.planned_on === o.key}
                onClick={() => set("planned_on", o.key)}
                className={cx(
                  "pressable h-8 rounded-full border px-3 text-sm",
                  f.planned_on === o.key ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:bg-surface-2",
                )}
              >
                {o.label}
              </button>
            ))}
            <input
              type="date"
              aria-label="Inny dzień"
              value={planOptions.some((o) => o.key === f.planned_on) ? "" : f.planned_on}
              onChange={(e) => set("planned_on", e.target.value)}
              className={cx(inputClass, "h-8 w-auto rounded-full px-3")}
            />
          </div>
          <p className="text-sm text-ink-3">Zadanie pojawi się w planie dnia na „Dziś”. To nie jest termin oddania.</p>
        </fieldset>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] gap-4">
          <Field label="Termin oddania" htmlFor="task-due">
            <Input id="task-due" type="date" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </Field>
          <Field label="Godzina" htmlFor="task-due-time">
            <Input
              id="task-due-time"
              type="time"
              value={f.due_time}
              disabled={!f.due_date}
              onChange={(e) => set("due_time", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Opis" htmlFor="task-desc">
          <Textarea id="task-desc" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <section aria-label="Checklista">
          <h3 className="text-sm font-medium">
            Checklista
            {items.length > 0 ? (
              <span className="tabular ml-2 font-normal text-ink-3">
                {items.filter((i) => i.done).length}/{items.length}
              </span>
            ) : null}
          </h3>
          <ul className="mt-2 flex flex-col">
            {items.map((item) => (
              <li key={item.id} className="group flex min-h-10 items-center gap-3 rounded-lg px-1 hover:bg-surface-2">
                <TaskCheckbox done={item.done} onToggle={() => toggleItem(item)} label={item.label} />
                <span className={cx("min-w-0 flex-1 text-sm", item.done && "text-ink-3 line-through")}>{item.label}</span>
                <button
                  type="button"
                  onClick={() => deleteItem(item)}
                  aria-label={`Usuń: ${item.label}`}
                  className="rounded-md p-1.5 text-ink-3 opacity-100 hover:bg-surface-3 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center gap-2">
            <Plus className="ml-1.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="Dodaj pozycję i naciśnij Enter"
              aria-label="Nowa pozycja checklisty"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm placeholder:text-ink-3 focus:outline-none"
            />
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
