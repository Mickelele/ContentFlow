"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, ListChecks, Plus } from "lucide-react";
import { cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { compareTasks, dueLabel, isOverdue, TASK_SELECT, toTasks, type ClientRef, type Task, type TaskStatus } from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";
import { ClientChip, PriorityFlag } from "./task-row";

/*
 * Tablica Kanban zadań (jak w Jirze): Do zrobienia → W trakcie → Ukończone.
 * Przeciągnięcie między kolumnami zmienia status, w obrębie kolumny — kolejność (tasks.board_position).
 * Mysz, palec (przytrzymanie) i klawiatura (spacja, strzałki, spacja).
 */

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Do zrobienia" },
  { status: "in_progress", label: "W trakcie" },
  { status: "done", label: "Ukończone" },
];
const DONE_LIMIT = 30;
// Po upuszczeniu przeglądarka wysyła jeszcze „click” — nie otwieramy wtedy karty.
let lastDrop = 0;
const STEP = 1024;

type Columns = Record<TaskStatus, string[]>;

const order = (a: Task, b: Task) =>
  a.board_position === null && b.board_position === null
    ? compareTasks(a, b)
    : a.board_position === null
      ? 1
      : b.board_position === null
        ? -1
        : a.board_position - b.board_position;

export function TaskBoard({
  workspaceId,
  clients,
  clientFilter,
  refreshKey,
  onOpen,
  onError,
}: {
  workspaceId: string;
  clients: ClientRef[];
  clientFilter: string;
  refreshKey: number;
  onOpen: (t: Task) => void;
  onError: (m: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [byId, setById] = useState<Map<string, Task> | null>(null);
  const [cols, setCols] = useState<Columns>({ todo: [], in_progress: [], done: [] });
  const [activeId, setActiveId] = useState<string | null>(null);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const fetchBoard = useCallback(async () => {
    const base = () => supabase.from("tasks").select(TASK_SELECT).eq("workspace_id", workspaceId).is("parent_id", null);
    const [open, done] = await Promise.all([
      base().neq("status", "done"),
      base().eq("status", "done").order("completed_at", { ascending: false }).limit(DONE_LIMIT),
    ]);
    if (open.error || done.error) return null;
    return [...toTasks(open.data), ...toTasks(done.data)];
  }, [supabase, workspaceId]);

  const apply = (list: Task[] | null) => {
    if (!list) return onError("Nie udało się pobrać zadań.");
    setById(new Map(list.map((t) => [t.id, t])));
    const next: Columns = { todo: [], in_progress: [], done: [] };
    for (const c of COLUMNS) next[c.status] = list.filter((t) => t.status === c.status).sort(order).map((t) => t.id);
    setCols(next);
  };

  useEffect(() => {
    let alive = true;
    fetchBoard().then((list) => alive && apply(list));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBoard, refreshKey]);

  // Zmiany z innych urządzeń — ale nie w trakcie przeciągania.
  useRealtime("board", ["tasks", "checklist_items"], () => {
    if (!activeId) fetchBoard().then(apply);
  });

  const containerOf = (id: string): TaskStatus | null =>
    (COLUMNS.find((c) => c.status === id)?.status ?? COLUMNS.find((c) => cols[c.status].includes(id))?.status) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  // Podgląd na żywo: karta przeskakuje do kolumny, nad którą jest.
  const onDragOver = (e: DragOverEvent) => {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = containerOf(id);
    const to = containerOf(overId);
    if (!from || !to || from === to) return;
    setCols((c) => {
      const target = [...c[to]];
      const overIndex = target.indexOf(overId);
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, id);
      return { ...c, [from]: c[from].filter((x) => x !== id), [to]: target };
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    setActiveId(null);
    lastDrop = Date.now();
    const overId = e.over ? String(e.over.id) : null;
    const to = overId ? containerOf(overId) : null;
    const task = byId?.get(id);
    if (!to || !task) return;

    // Kolejność w kolumnie docelowej po upuszczeniu.
    let column = cols[to];
    const from = column.indexOf(id);
    const toIndex = overId && overId !== to ? column.indexOf(overId) : column.length - 1;
    if (from >= 0 && toIndex >= 0 && from !== toIndex) column = arrayMove(column, from, toIndex);
    setCols((c) => ({ ...c, [to]: column }));

    const statusChanged = task.status !== to;
    // Numeracja co 1024 — zapisujemy tylko karty, których pozycja się zmieniła.
    const updates = column
      .map((cid, i) => ({ cid, pos: (i + 1) * STEP }))
      .filter(({ cid, pos }) => byId?.get(cid)?.board_position !== pos || (cid === id && statusChanged));
    setById((m) => {
      const n = new Map(m);
      for (const { cid, pos } of updates) {
        const t = n.get(cid);
        if (t) n.set(cid, { ...t, board_position: pos, status: cid === id ? to : t.status });
      }
      return n;
    });
    const results = await Promise.all(
      updates.map(({ cid, pos }) =>
        supabase
          .from("tasks")
          .update(cid === id && statusChanged ? { board_position: pos, status: to } : { board_position: pos })
          .eq("id", cid),
      ),
    );
    if (results.some((r) => r.error)) {
      onError("Nie udało się zapisać zmiany na tablicy.");
      fetchBoard().then(apply);
    }
  };

  const addCard = async (status: TaskStatus, title: string) => {
    const last = cols[status].length;
    const { data, error } = await supabase
      .from("tasks")
      .insert({ workspace_id: workspaceId, title, status, client_id: clientFilter || null, board_position: (last + 1) * STEP })
      .select(TASK_SELECT)
      .single();
    if (error || !data) return onError("Nie udało się dodać zadania.");
    const t = toTasks([data])[0];
    setById((m) => new Map(m).set(t.id, t));
    setCols((c) => ({ ...c, [status]: [...c[status], t.id] }));
  };

  if (!byId) {
    return (
      <div className="grid animate-pulse gap-4 motion-reduce:animate-none md:grid-cols-3" aria-busy="true" aria-label="Ładowanie">
        {COLUMNS.map((c) => (
          <div key={c.status} className="h-72 rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  const visible = (ids: string[]) => ids.filter((id) => !clientFilter || byId.get(id)?.client_id === clientFilter);
  const active = activeId ? byId.get(activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => (setActiveId(null), fetchBoard().then(apply))}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0">
        {COLUMNS.map((c) => (
          <Column
            key={c.status}
            status={c.status}
            label={c.label}
            ids={visible(cols[c.status])}
            byId={byId}
            clientById={clientById}
            onOpen={onOpen}
            onAdd={(title) => addCard(c.status, title)}
            hint={c.status === "done" ? `Ostatnie ${DONE_LIMIT}` : undefined}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {active ? <Card task={active} client={active.client_id ? clientById.get(active.client_id) : undefined} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  ids,
  byId,
  clientById,
  onOpen,
  onAdd,
  hint,
}: {
  status: TaskStatus;
  label: string;
  ids: string[];
  byId: Map<string, Task>;
  clientById: Map<string, ClientRef>;
  onOpen: (t: Task) => void;
  onAdd: (title: string) => Promise<void>;
  hint?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <section
      aria-label={label}
      className={cx(
        "flex w-[82vw] max-w-sm shrink-0 snap-start flex-col rounded-2xl bg-surface-2 p-2.5 transition-colors md:w-auto md:max-w-none",
        isOver && "bg-surface-3",
      )}
    >
      <header className="mb-2.5 flex items-baseline gap-2 rounded-lg bg-band px-2.5 py-1.5">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="tabular text-sm text-ink-3">{ids.length}</span>
        {hint ? <span className="ml-auto text-xs text-ink-3">{hint}</span> : null}
      </header>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
          {ids.map((id) => {
            const t = byId.get(id)!;
            return <SortableCard key={id} task={t} client={t.client_id ? clientById.get(t.client_id) : undefined} onOpen={() => onOpen(t)} />;
          })}
          {ids.length === 0 ? <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line-strong py-6 text-sm text-ink-3">Przeciągnij tutaj</li> : null}
        </ul>
      </SortableContext>
      {adding ? (
        <form
          className="mt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = title.trim();
            if (!t) return setAdding(false);
            setTitle("");
            await onAdd(t);
          }}
        >
          <textarea
            autoFocus
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title.trim() && setAdding(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Co trzeba zrobić?"
            aria-label={`Nowe zadanie w kolumnie ${label}`}
            className="w-full resize-none rounded-xl border border-line-strong bg-surface p-3 text-sm placeholder:text-ink-3 focus:border-focus focus:outline-none"
          />
          {/* Widoczny przycisk: na telefonie (np. klawiatura Androida) Enter nie zawsze wysyła formularz. */}
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="submit"
              onMouseDown={(e) => e.preventDefault()}
              className="pressable inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-on-primary"
            >
              Dodaj
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (setTitle(""), setAdding(false))}
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm text-ink-2 hover:bg-surface-3"
            >
              Anuluj
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-ink-2 hover:bg-surface-3 hover:text-ink"
        >
          <Plus className="size-4" aria-hidden="true" />
          Dodaj zadanie
        </button>
      )}
    </section>
  );
}

function SortableCard({ task, client, onOpen }: { task: Task; client?: ClientRef; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onKeyDown={(e: KeyboardEvent<HTMLLIElement>) => {
        // Enter otwiera kartę; spacja (dnd-kit) podnosi ją do przeniesienia.
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      onClick={() => Date.now() - lastDrop > 250 && onOpen()}
      aria-roledescription="Karta zadania"
      aria-label={`${task.title}. Enter otwiera, spacja przenosi.`}
    >
      <Card task={task} client={client} />
    </li>
  );
}

function Card({ task, client, overlay = false }: { task: Task; client?: ClientRef; overlay?: boolean }) {
  const done = task.status === "done";
  const due = dueLabel(task);
  const overdue = isOverdue(task);
  return (
    <div
      className={cx(
        "cursor-grab rounded-xl border border-line bg-surface p-3 text-left select-none hover:border-line-strong active:cursor-grabbing",
        overlay && "rotate-[1.5deg] shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)]",
      )}
    >
      <p className={cx("text-sm leading-snug font-medium", done && "text-ink-3 line-through")}>{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
        <PriorityFlag priority={task.priority} />
        {due ? (
          <span className={cx("inline-flex items-center gap-1", overdue && "font-medium text-danger")}>
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {due}
          </span>
        ) : null}
        {task.checklist_total > 0 ? (
          <span className="tabular inline-flex items-center gap-1">
            <ListChecks className="size-3.5" aria-hidden="true" />
            {task.checklist_done}/{task.checklist_total}
          </span>
        ) : null}
        {client ? <ClientChip client={client} /> : null}
      </div>
    </div>
  );
}
