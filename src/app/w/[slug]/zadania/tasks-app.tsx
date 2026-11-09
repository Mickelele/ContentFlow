"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Sun } from "lucide-react";
import { Button, PageHeader, cx, inputClass } from "@/components/ui";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskDialog, type TaskDraft } from "@/components/tasks/task-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { createClient } from "@/lib/supabase/client";
import {
  TASK_SELECT,
  addDaysKey,
  compareTasks,
  dateKey,
  setTaskDone,
  toTasks,
  todayKey,
  type ClientRef,
  type Task,
  type WorkspaceRef,
} from "@/lib/tasks";

type Tab = "active" | "done";

const GROUPS = [
  { key: "overdue", label: "Zaległe" },
  { key: "today", label: "Dziś" },
  { key: "tomorrow", label: "Jutro" },
  { key: "week", label: "Najbliższe 7 dni" },
  { key: "later", label: "Później" },
  { key: "none", label: "Bez terminu" },
] as const;

function groupOf(t: Task, today: string) {
  if (!t.due_at) return "none";
  const k = dateKey(new Date(t.due_at));
  if (k < today) return "overdue";
  if (k === today) return "today";
  if (k === addDaysKey(today, 1)) return "tomorrow";
  if (k <= addDaysKey(today, 7)) return "week";
  return "later";
}

export function TasksApp({
  workspace,
  workspaces,
  clients,
}: {
  workspace: WorkspaceRef;
  workspaces: WorkspaceRef[];
  clients: ClientRef[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("active");
  const [clientFilter, setClientFilter] = useState("");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const today = todayKey();
  const wsClients = clients.filter((c) => c.workspace_id === workspace.id);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const fetchList = useCallback(
    async (which: Tab) => {
      let q = supabase.from("tasks").select(TASK_SELECT).eq("workspace_id", workspace.id).is("parent_id", null);
      q = which === "active" ? q.neq("status", "done") : q.eq("status", "done").order("completed_at", { ascending: false }).limit(100);
      const { data, error } = await q;
      return error ? null : toTasks(data);
    },
    [supabase, workspace.id],
  );

  const apply = (list: Task[] | null) => {
    if (!list) return setError("Nie udało się pobrać zadań. Odśwież stronę.");
    setError(null);
    setTasks(list);
  };
  const load = async (which: Tab) => apply(await fetchList(which));

  // Pierwsze wczytanie; ?zadanie=<id> (np. z kalendarza lub powiadomienia) od razu otwiera zadanie.
  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get("zadanie");
    fetchList("active").then(async (list) => {
      if (list) {
        setTasks(list);
      } else {
        setError("Nie udało się pobrać zadań. Odśwież stronę.");
      }
      if (!wanted) return;
      history.replaceState(null, "", location.pathname);
      let t = list?.find((x) => x.id === wanted);
      if (!t) {
        const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("id", wanted).maybeSingle();
        t = data ? toTasks([data])[0] : undefined;
      }
      if (t) {
        setDialogKey((k) => k + 1);
        setDraft(t);
      }
    });
  }, [fetchList, supabase]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setTasks(null);
    load(t);
  };

  const open = (d: TaskDraft) => {
    setDialogKey((k) => k + 1);
    setDraft(d);
  };

  const patch = (id: string, p: Partial<Task>) => setTasks((xs) => xs?.map((x) => (x.id === id ? { ...x, ...p } : x)) ?? xs);

  const toggle = async (t: Task) => {
    const done = t.status !== "done";
    patch(t.id, { status: done ? "done" : "todo" });
    const { error } = await setTaskDone(supabase, t.id, done);
    if (error) {
      patch(t.id, { status: t.status });
      setError("Nie udało się zapisać zmiany.");
    }
  };

  const togglePlan = async (t: Task) => {
    const planned_on = t.planned_on === today ? null : today;
    patch(t.id, { planned_on });
    const { error } = await supabase.from("tasks").update({ planned_on }).eq("id", t.id);
    if (error) patch(t.id, { planned_on: t.planned_on });
  };

  const quickAdd = async (title: string) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, workspace_id: workspace.id, client_id: clientFilter || null, position: Date.now() % 2147483647 })
      .select(TASK_SELECT)
      .single();
    if (error || !data) return setError("Nie udało się dodać zadania.");
    if (tab === "active") setTasks((xs) => [...toTasks([data]), ...(xs ?? [])]);
  };

  const visible = (tasks ?? []).filter((t) => !clientFilter || t.client_id === clientFilter);
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: visible.filter((t) => groupOf(t, today) === g.key).sort(compareTasks),
  })).filter((g) => g.items.length > 0);

  const row = (t: Task) => (
    <li key={t.id}>
      <TaskRow
        task={t}
        client={t.client_id ? clientById.get(t.client_id) : undefined}
        onToggle={() => toggle(t)}
        onOpen={() => open(t)}
        actions={
          t.status !== "done" ? (
            <button
              type="button"
              onClick={() => togglePlan(t)}
              aria-pressed={t.planned_on === today}
              aria-label={t.planned_on === today ? "Usuń z planu dnia" : "Dodaj do planu dnia"}
              title={t.planned_on === today ? "W planie dnia" : "Dodaj do planu dnia"}
              className={cx(
                "pressable rounded-lg p-2",
                t.planned_on === today ? "text-[var(--c-amber-solid)]" : "text-ink-3 opacity-100 hover:bg-surface-3 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              )}
            >
              <Sun className="size-[18px]" fill={t.planned_on === today ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          ) : null
        }
      />
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Zadania"
        description={`Wszystko do zrobienia w ${workspace.name}. Słoneczko dodaje zadanie do planu dnia.`}
        actions={
          <Button variant="primary" onClick={() => open({ workspace_id: workspace.id, client_id: clientFilter || null })}>
            <Plus className="size-4" aria-hidden="true" />
            Nowe zadanie
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface-2 p-0.5" role="tablist" aria-label="Rodzaj zadań">
          {(
            [
              ["active", "Do zrobienia"],
              ["done", "Ukończone"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => switchTab(k)}
              className={cx("h-8 rounded-md px-3 text-sm", tab === k ? "bg-surface font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
        {wsClients.length > 0 ? (
          <select
            aria-label="Filtruj według klienta"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className={cx(inputClass, "h-9 w-auto")}
          >
            <option value="">Wszyscy klienci</option>
            {wsClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {tab === "active" ? <QuickAdd onAdd={quickAdd} className="mb-6" /> : null}

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {tasks === null ? (
        <div className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : tab === "done" ? (
        visible.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-6 py-10 text-center text-ink-2">Nie ma jeszcze ukończonych zadań.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">{visible.map(row)}</ul>
        )
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl bg-surface-2 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">Nic do zrobienia</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-2">Dodaj zadanie polem powyżej. Termin i checklistę ustawisz po kliknięciu w zadanie.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map((g) => (
            <section key={g.key} aria-labelledby={`grp-${g.key}`}>
              <h2 id={`grp-${g.key}`} className={cx("mb-2 flex items-baseline gap-2 font-semibold", g.key === "overdue" && "text-danger")}>
                {g.label}
                <span className="tabular text-sm font-normal text-ink-3">{g.items.length}</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">{g.items.map(row)}</ul>
            </section>
          ))}
        </div>
      )}

      <TaskDialog
        key={dialogKey}
        draft={draft}
        workspaces={workspaces.filter((w) => w.id === workspace.id)}
        clients={clients}
        onClose={() => setDraft(null)}
        onSaved={(t) => {
          setDraft(null);
          setTasks((xs) => {
            if (!xs) return xs;
            const belongs = tab === "active" ? t.status !== "done" : t.status === "done";
            const rest = xs.filter((x) => x.id !== t.id);
            return belongs ? [t, ...rest] : rest;
          });
        }}
        onDeleted={(id) => {
          setDraft(null);
          setTasks((xs) => xs?.filter((x) => x.id !== id) ?? xs);
        }}
      />
    </div>
  );
}
