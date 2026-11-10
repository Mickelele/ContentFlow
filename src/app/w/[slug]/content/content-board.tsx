"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";
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
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";
import { ClientChip } from "@/components/tasks/task-row";
import { cx } from "@/components/ui";
import { CONTENT_TYPES, PLATFORM_LIST, STAGES, type ContentStage } from "@/lib/content";
import { createClient } from "@/lib/supabase/client";
import type { ClientRef } from "@/lib/tasks";
import type { ContentRow } from "./content-list";

/*
 * Tablica materiałów: kolumna = etap produkcji (pomysł → … → opublikowano).
 * Przeciągnięcie zmienia etap; kolejność w kolumnie trzyma content.board_position.
 */

const STEP = 1024;
const NEXT_LABEL: Record<string, string> = { recording: "Nagranie", editing: "Montaż", approval: "Akceptacja", publication: "Publikacja" };
const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
let lastDrop = 0;

type Columns = Record<ContentStage, string[]>;

export function ContentBoard({ slug, rows, clients }: { slug: string; rows: ContentRow[]; clients: ClientRef[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const [byId, setById] = useState(() => new Map(rows.map((r) => [r.id, r])));
  const [cols, setCols] = useState<Columns>(() => {
    const c = Object.fromEntries(STAGES.map((s) => [s.key, [] as string[]])) as unknown as Columns;
    const sorted = [...rows].sort((a, b) =>
      a.board_position === null && b.board_position === null ? 0 : a.board_position === null ? 1 : b.board_position === null ? -1 : a.board_position - b.board_position,
    );
    for (const r of sorted) c[r.stage].push(r.id);
    return c;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerOf = (id: string): ContentStage | null =>
    (STAGES.find((s) => s.key === id)?.key ?? STAGES.find((s) => cols[s.key].includes(id))?.key) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragOver = (e: DragOverEvent) => {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = containerOf(id);
    const to = containerOf(overId);
    if (!from || !to || from === to) return;
    setCols((c) => {
      const target = [...c[to]];
      const i = target.indexOf(overId);
      target.splice(i >= 0 ? i : target.length, 0, id);
      return { ...c, [from]: c[from].filter((x) => x !== id), [to]: target };
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    setActiveId(null);
    lastDrop = Date.now();
    const overId = e.over ? String(e.over.id) : null;
    const to = overId ? containerOf(overId) : null;
    const row = byId.get(id);
    if (!to || !row) return;
    let column = cols[to];
    const from = column.indexOf(id);
    const toIndex = overId && overId !== to ? column.indexOf(overId) : column.length - 1;
    if (from >= 0 && toIndex >= 0 && from !== toIndex) column = arrayMove(column, from, toIndex);
    setCols((c) => ({ ...c, [to]: column }));

    const stageChanged = row.stage !== to;
    const updates = column
      .map((cid, i) => ({ cid, pos: (i + 1) * STEP }))
      .filter(({ cid, pos }) => byId.get(cid)?.board_position !== pos || (cid === id && stageChanged));
    setById((m) => {
      const n = new Map(m);
      for (const { cid, pos } of updates) {
        const r = n.get(cid);
        if (r) n.set(cid, { ...r, board_position: pos, stage: cid === id ? to : r.stage });
      }
      return n;
    });
    const results = await Promise.all(
      updates.map(({ cid, pos }) =>
        supabase.from("content").update(cid === id && stageChanged ? { board_position: pos, stage: to } : { board_position: pos }).eq("id", cid),
      ),
    );
    if (results.some((r) => r.error)) {
      setError("Nie udało się zapisać zmiany na tablicy.");
      router.refresh();
    }
  };

  const active = activeId ? byId.get(activeId) : null;

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:snap-none lg:px-10">
          {STAGES.map((s) => (
            <Column key={s.key} stage={s.key} label={s.label} ids={cols[s.key]} byId={byId} clientById={clientById} slug={slug} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
          {active ? <Card row={active} client={active.client_id ? clientById.get(active.client_id) : undefined} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function Column({
  stage,
  label,
  ids,
  byId,
  clientById,
  slug,
}: {
  stage: ContentStage;
  label: string;
  ids: string[];
  byId: Map<string, ContentRow>;
  clientById: Map<string, ClientRef>;
  slug: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      aria-label={label}
      className={cx("flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-2xl bg-surface-2 p-2.5 transition-colors sm:w-64", isOver && "bg-surface-3")}
    >
      <header className="mb-2.5 flex items-baseline gap-2 rounded-lg bg-band px-2.5 py-1.5">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="tabular text-sm text-ink-3">{ids.length}</span>
      </header>
      <SortableContext id={stage} items={ids} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
          {ids.map((id) => {
            const r = byId.get(id)!;
            return <SortableCard key={id} row={r} client={r.client_id ? clientById.get(r.client_id) : undefined} slug={slug} />;
          })}
          {ids.length === 0 ? (
            <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line-strong py-6 text-sm text-ink-3">Przeciągnij tutaj</li>
          ) : null}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ row, client, slug }: { row: ContentRow; client?: ClientRef; slug: string }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const open = () => router.push(`/w/${slug}/content/${row.id}`);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onKeyDown={(e: KeyboardEvent<HTMLLIElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          open();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      onClick={() => Date.now() - lastDrop > 250 && open()}
      aria-roledescription="Karta materiału"
      aria-label={`${row.title}. Enter otwiera, spacja przenosi.`}
    >
      <Card row={row} client={client} />
    </li>
  );
}

function Card({ row, client, overlay = false }: { row: ContentRow; client?: ClientRef; overlay?: boolean }) {
  const T = CONTENT_TYPES[row.type];
  return (
    <div
      className={cx(
        "cursor-grab rounded-xl border border-line bg-surface p-3 select-none hover:border-line-strong active:cursor-grabbing",
        overlay && "rotate-[1.5deg] shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)]",
      )}
    >
      <p className="flex items-start gap-2 text-sm leading-snug font-medium">
        <T.icon className="mt-0.5 size-4 shrink-0 text-ink-2" aria-label={T.label} />
        <span>{row.title}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
        {row.next ? (
          <span className="tabular inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {NEXT_LABEL[row.next.label]} · {dateFmt.format(new Date(row.next.at))}
          </span>
        ) : null}
        {row.platforms.length ? <span>{row.platforms.map((p) => PLATFORM_LIST.find((x) => x.key === p)?.label).join(", ")}</span> : null}
        {client ? <ClientChip client={client} /> : null}
      </div>
    </div>
  );
}
