"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, Check, Copy, ExternalLink, GripVertical, Hash, Send, Sun, Undo2, Video } from "lucide-react";
import { sendDayPlanAction } from "./actions";
import { WorkspaceBadge } from "@/components/shell/workspace-switcher";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskDialog, type TaskDraft } from "@/components/tasks/task-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { buttonClass, cx } from "@/components/ui";
import { PLATFORMS, findMeeting, type CalendarItem } from "@/lib/calendar";
import { colorVars, type ClientColor } from "@/lib/palette";
import { createClient } from "@/lib/supabase/client";
import {
  TASK_SELECT,
  addDaysKey,
  dateKey,
  keyToDate,
  setTaskDone,
  toTasks,
  todayKey,
  type ClientRef,
  type ProjectRef,
  type Task,
  type WorkspaceRef,
} from "@/lib/tasks";

const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" });
const shortDay = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric" });

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 5) return "Dobranoc";
  if (h < 12) return "Dzień dobry";
  if (h < 18) return "Cześć";
  return "Dobry wieczór";
}

type Data = {
  plan: Task[];
  carry: Task[];
  dueToday: Task[];
  overdue: Task[];
  items: CalendarItem[];
  layerColors: Map<string, ClientColor>;
};

export function DayApp({
  workspace,
  workspaces,
  clients,
  projects,
  firstName,
  slackConnected,
}: {
  workspace: WorkspaceRef;
  workspaces: WorkspaceRef[];
  clients: ClientRef[];
  projects: ProjectRef[];
  firstName: string | null;
  slackConnected: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const today = todayKey();
  const now = new Date();
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const wsById = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);
  const multi = workspaces.length > 1;

  useEffect(() => {
    let alive = true;
    const start = keyToDate(today);
    const tomorrow = keyToDate(addDaysKey(today, 1));
    const weekEnd = keyToDate(addDaysKey(today, 8));
    const base = () => supabase.from("tasks").select(TASK_SELECT).is("parent_id", null);

    Promise.all([
      base().not("planned_on", "is", null).lte("planned_on", today).or(`planned_on.eq.${today},status.neq.done`),
      base().neq("status", "done").lt("due_at", tomorrow.toISOString()),
      supabase.rpc("calendar_items", { p_from: start.toISOString(), p_to: weekEnd.toISOString() }),
      supabase.from("calendars").select("id, color"),
    ]).then(([planned, due, cal, layers]) => {
      if (!alive) return;
      if (planned.error || due.error || cal.error) return setError("Nie udało się wczytać planu dnia. Odśwież stronę.");
      const plannedTasks = toTasks(planned.data);
      const dueTasks = toTasks(due.data);
      const plan = plannedTasks.filter((t) => t.planned_on === today).sort((a, b) => a.position - b.position);
      const planIds = new Set(plan.map((t) => t.id));
      setData({
        plan,
        carry: plannedTasks.filter((t) => t.planned_on! < today && t.status !== "done"),
        dueToday: dueTasks.filter((t) => dateKey(new Date(t.due_at!)) === today && !planIds.has(t.id)),
        overdue: dueTasks.filter((t) => dateKey(new Date(t.due_at!)) < today),
        items: (cal.data ?? []) as CalendarItem[],
        layerColors: new Map(((layers.data ?? []) as { id: string; color: ClientColor }[]).map((l) => [l.id, l.color])),
      });
    });
    return () => {
      alive = false;
    };
  }, [supabase, today]);

  // ── Zmiany w zadaniach (optymistycznie) ──
  const update = (fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d));
  const mapAll = (fn: (t: Task) => Task) =>
    update((d) => ({ ...d, plan: d.plan.map(fn), carry: d.carry.map(fn), dueToday: d.dueToday.map(fn), overdue: d.overdue.map(fn) }));

  const toggle = async (t: Task) => {
    const done = t.status !== "done";
    mapAll((x) => (x.id === t.id ? { ...x, status: done ? "done" : "todo" } : x));
    const { error } = await setTaskDone(supabase, t.id, done);
    if (error) {
      mapAll((x) => (x.id === t.id ? { ...x, status: t.status } : x));
      setError("Nie udało się zapisać zmiany.");
    }
  };

  const planToday = async (tasks: Task[]) => {
    const ids = new Set(tasks.map((t) => t.id));
    const maxPos = Math.max(0, ...(data?.plan.map((t) => t.position) ?? [0]));
    const moved = tasks.map((t, i) => ({ ...t, planned_on: today, position: maxPos + i + 1 }));
    update((d) => ({
      ...d,
      plan: [...d.plan, ...moved],
      carry: d.carry.filter((t) => !ids.has(t.id)),
      dueToday: d.dueToday.filter((t) => !ids.has(t.id)),
    }));
    await Promise.all(moved.map((t) => supabase.from("tasks").update({ planned_on: today, position: t.position }).eq("id", t.id)));
  };

  const unplan = async (t: Task) => {
    update((d) => ({ ...d, plan: d.plan.filter((x) => x.id !== t.id), carry: d.carry.filter((x) => x.id !== t.id) }));
    await supabase.from("tasks").update({ planned_on: null }).eq("id", t.id);
  };

  const quickAdd = async (title: string) => {
    const position = Math.max(0, ...(data?.plan.map((t) => t.position) ?? [0])) + 1;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert({ title, workspace_id: workspace.id, planned_on: today, position })
      .select(TASK_SELECT)
      .single();
    if (error || !row) return setError("Nie udało się dodać zadania.");
    update((d) => ({ ...d, plan: [...d.plan, ...toTasks([row])] }));
  };

  // ── Kolejność planu (przeciąganie) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = async (e: DragEndEvent) => {
    if (!data || !e.over || e.active.id === e.over.id) return;
    const from = data.plan.findIndex((t) => t.id === e.active.id);
    const to = data.plan.findIndex((t) => t.id === e.over!.id);
    const next = arrayMove(data.plan, from, to).map((t, i) => ({ ...t, position: i + 1 }));
    update((d) => ({ ...d, plan: next }));
    await Promise.all(
      next.filter((t, i) => data.plan[i]?.id !== t.id).map((t) => supabase.from("tasks").update({ position: t.position }).eq("id", t.id)),
    );
  };

  const open = (d: TaskDraft) => {
    setDialogKey((k) => k + 1);
    setDraft(d);
  };

  const badge = (t: Task) => (multi ? <WorkspaceBadge ws={wsById.get(t.workspace_id) ?? workspace} size={22} /> : null);
  const plan = data?.plan ?? [];
  const doneCount = plan.filter((t) => t.status === "done").length;
  const todayEvents = (data?.items ?? [])
    .filter((i) => i.source_type === "event" && dateKey(new Date(i.starts_at)) <= today && dateKey(new Date(i.ends_at)) >= today)
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at));
  const publications = (data?.items ?? []).filter((i) => i.source_type === "publication").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const hasClients = clients.some((c) => c.workspace_id === workspace.id);

  // Plan dnia na Slacka: daty formatujemy tutaj (strefa przeglądarki), serwer składa wiadomość.
  const [slackState, setSlackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const sendToSlack = async () => {
    setSlackState("sending");
    const res = await sendDayPlanAction(workspace.slug, {
      dateLabel: dayFmt.format(now),
      tasks: plan.map((t) => ({ title: t.title, done: t.status === "done", client: t.client_id ? (clientById.get(t.client_id)?.name ?? null) : null })),
      events: todayEvents.map((e) => ({
        time: e.all_day ? "cały dzień" : `${timeFmt.format(new Date(e.starts_at))}–${timeFmt.format(new Date(e.ends_at))}`,
        title: e.title,
        link: findMeeting(e.url, e.location, e.description)?.url ?? null,
      })),
    });
    setSlackState(res.ok ? "sent" : "error");
    if (!res.ok) setError(res.error);
    setTimeout(() => setSlackState("idle"), 3000);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="pb-8">
        <p className="text-ink-2 first-letter:uppercase">{dayFmt.format(now)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting(now)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      {!hasClients ? (
        <section className="mb-8 flex flex-col gap-4 rounded-2xl bg-ink p-6 text-bg sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-lg font-semibold">Zacznij od klientów</h2>
            <p className="mt-1 max-w-lg opacity-80">Każdy klient dostaje kolor i warstwę w kalendarzu. Zadania i wydarzenia przypiszesz do nich później.</p>
          </div>
          <Link
            href={`/w/${workspace.slug}/klienci/nowy`}
            className="pressable inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-bg px-4 text-sm font-medium text-ink sm:self-auto"
          >
            Dodaj klienta
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
        {/* ── Plan dnia ── */}
        <div className="flex flex-col gap-8">
          <section aria-labelledby="plan-h">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="plan-h" className="text-xl font-semibold">
                Plan dnia
              </h2>
              <div className="flex items-center gap-3">
                {plan.length > 0 ? (
                  <p className="tabular text-sm text-ink-2">
                    {doneCount} z {plan.length} zrobione
                  </p>
                ) : null}
                {slackConnected && data ? (
                  <button
                    type="button"
                    disabled={slackState === "sending"}
                    onClick={sendToSlack}
                    className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}
                    aria-live="polite"
                  >
                    <Hash className="size-3.5" aria-hidden="true" />
                    {slackState === "sending" ? "Wysyłam…" : slackState === "sent" ? "Wysłano" : slackState === "error" ? "Nie wysłano" : "Na Slacka"}
                  </button>
                ) : null}
              </div>
            </div>
            {plan.length > 0 ? (
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div
                  className="h-full origin-left rounded-full bg-ink transition-transform duration-500 ease-[var(--ease-out)]"
                  style={{ transform: `scaleX(${plan.length ? doneCount / plan.length : 0})` }}
                />
              </div>
            ) : null}

            {data === null ? (
              <div className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-surface-2" />
                ))}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={plan.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {plan.length > 0 ? (
                    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                      {plan.map((t) => (
                        <SortableTask key={t.id} id={t.id}>
                          {(handle) => (
                            <TaskRow
                              task={t}
                              client={t.client_id ? clientById.get(t.client_id) : undefined}
                              workspaceBadge={badge(t)}
                              onToggle={() => toggle(t)}
                              onOpen={() => open(t)}
                              handle={handle}
                              actions={
                                <button
                                  type="button"
                                  onClick={() => unplan(t)}
                                  aria-label={`Usuń z planu: ${t.title}`}
                                  title="Usuń z planu dnia"
                                  className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                >
                                  <Undo2 className="size-4" aria-hidden="true" />
                                </button>
                              }
                            />
                          )}
                        </SortableTask>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-2xl bg-surface-2 px-5 py-6 text-ink-2">
                      Plan na dziś jest pusty. Wpisz, co chcesz dziś zrobić, albo dodaj zadania z listy obok.
                    </p>
                  )}
                </SortableContext>
              </DndContext>
            )}
            <QuickAdd onAdd={quickAdd} placeholder="Co dziś zrobisz? Wpisz i Enter" className="mt-3" />
          </section>

          {data && data.carry.length > 0 ? (
            <section aria-labelledby="carry-h">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="carry-h" className="text-lg font-semibold">
                  Z poprzednich dni
                </h2>
                <button type="button" onClick={() => planToday(data.carry)} className={buttonClass("secondary", "h-9 px-3")}>
                  <Sun className="size-4" aria-hidden="true" />
                  Przenieś wszystkie na dziś
                </button>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {data.carry.map((t) => (
                  <li key={t.id}>
                    <TaskRow
                      task={t}
                      client={t.client_id ? clientById.get(t.client_id) : undefined}
                      workspaceBadge={badge(t)}
                      onToggle={() => toggle(t)}
                      onOpen={() => open(t)}
                      actions={
                        <>
                          <span className="tabular hidden text-[13px] text-ink-3 sm:inline">{shortDay.format(keyToDate(t.planned_on!))}</span>
                          <button
                            type="button"
                            onClick={() => planToday([t])}
                            aria-label={`Przenieś na dziś: ${t.title}`}
                            title="Przenieś na dziś"
                            className="rounded-lg p-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
                          >
                            <Sun className="size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => unplan(t)}
                            aria-label={`Odłóż: ${t.title}`}
                            title="Odłóż (usuń z planu)"
                            className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"
                          >
                            <Undo2 className="size-4" aria-hidden="true" />
                          </button>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* ── Kolumna boczna ── */}
        <aside className="flex flex-col gap-4" aria-label="Dzisiaj w skrócie">
          <Panel title="Wydarzenia dziś" href={`/w/${workspace.slug}/kalendarz`} cta="Kalendarz">
            {data && todayEvents.length === 0 ? <Empty>Nic w kalendarzu na dziś.</Empty> : null}
            <ul className="flex flex-col gap-1">
              {todayEvents.map((e) => (
                <EventLine key={e.source_id} item={e} color={data?.layerColors.get(e.calendar_id)} />
              ))}
            </ul>
          </Panel>

          <Panel title="Terminy na dziś" href={`/w/${workspace.slug}/zadania`} cta="Zadania">
            {data && data.dueToday.length === 0 ? <Empty>Brak innych terminów na dziś.</Empty> : null}
            <ul className="flex flex-col">
              {data?.dueToday.map((t) => (
                <SideTask key={t.id} task={t} onOpen={() => open(t)} onPlan={() => planToday([t])} />
              ))}
            </ul>
          </Panel>

          {data && data.overdue.length > 0 ? (
            <Panel title={`Zaległe · ${data.overdue.length}`} tone="danger" href={`/w/${workspace.slug}/zadania`} cta="Wszystkie">
              <ul className="flex flex-col">
                {data.overdue.slice(0, 5).map((t) => (
                  <SideTask key={t.id} task={t} onOpen={() => open(t)} onPlan={() => planToday([t])} />
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Publikacje w tym tygodniu">
            {data && publications.length === 0 ? <Empty>Brak zaplanowanych publikacji.</Empty> : null}
            <ul className="flex flex-col gap-1">
              {publications.map((p) => (
                <li key={p.source_id} className="flex items-center gap-3 py-1.5 text-sm">
                  <Send className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                  {p.content_id ? (
                    <Link
                      href={`/w/${wsById.get(p.workspace_id)?.slug ?? workspace.slug}/content/${p.content_id}`}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {p.title}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  )}
                  <span className="tabular shrink-0 text-ink-3">
                    {shortDay.format(new Date(p.starts_at))}
                    {p.platform ? ` · ${PLATFORMS[p.platform] ?? p.platform}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>

      <TaskDialog
        key={dialogKey}
        draft={draft}
        workspaces={workspaces}
        clients={clients}
        projects={projects}
        onClose={() => setDraft(null)}
        onSaved={(t) => {
          setDraft(null);
          update((d) => {
            const replace = (xs: Task[]) => xs.map((x) => (x.id === t.id ? { ...x, ...t } : x));
            const inPlan = t.planned_on === today;
            const plan = inPlan
              ? d.plan.some((x) => x.id === t.id)
                ? replace(d.plan)
                : [...d.plan, t]
              : d.plan.filter((x) => x.id !== t.id);
            return { ...d, plan, carry: replace(d.carry), dueToday: replace(d.dueToday), overdue: replace(d.overdue) };
          });
        }}
        onDeleted={(id) => {
          setDraft(null);
          const drop = (xs: Task[]) => xs.filter((x) => x.id !== id);
          update((d) => ({ ...d, plan: drop(d.plan), carry: drop(d.carry), dueToday: drop(d.dueToday), overdue: drop(d.overdue) }));
        }}
      />
    </div>
  );
}

function SortableTask({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx("relative", isDragging && "z-10 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.3)]")}
    >
      {children(
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Zmień kolejność"
          className="-ml-1.5 cursor-grab touch-none rounded p-1 text-ink-3 hover:text-ink active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>,
      )}
    </li>
  );
}

function Panel({
  title,
  href,
  cta,
  tone,
  children,
}: {
  title: string;
  href?: string;
  cta?: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className={cx("font-semibold", tone === "danger" && "text-danger")}>{title}</h2>
        {href && cta ? (
          <Link href={href} className={buttonClass("ghost", "h-8 px-2.5 text-ink-2")}>
            {cta}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-ink-3">{children}</p>;

function SideTask({ task, onOpen, onPlan }: { task: Task; onOpen: () => void; onPlan: () => void }) {
  return (
    <li className="group flex items-center gap-2 py-1">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate py-1 text-left text-sm hover:underline">
        {task.title}
      </button>
      <button
        type="button"
        onClick={onPlan}
        className={buttonClass("ghost", "h-8 shrink-0 px-2 text-[13px]")}
        aria-label={`Dodaj do planu dnia: ${task.title}`}
      >
        <Sun className="size-3.5" aria-hidden="true" />
        Do planu
      </button>
    </li>
  );
}

function EventLine({ item, color }: { item: CalendarItem; color?: ClientColor }) {
  const meeting = findMeeting(item.url, item.location, item.description);
  const [copied, setCopied] = useState(false);
  const c = colorVars(color ?? "brown");
  const start = new Date(item.starts_at);
  const end = new Date(item.ends_at);
  const past = !item.all_day && end < new Date();

  return (
    <li className={cx("flex items-center gap-3 rounded-lg py-1.5", past && "opacity-55")}>
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: c.solid }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="tabular text-[13px] text-ink-3">{item.all_day ? "cały dzień" : `${timeFmt.format(start)}–${timeFmt.format(end)}`}</p>
      </div>
      {meeting ? (
        <>
          <button
            type="button"
            aria-label={copied ? "Skopiowano link" : `Kopiuj link: ${meeting.provider}`}
            title="Kopiuj link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(meeting.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
            className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          </button>
          <a href={meeting.url} target="_blank" rel="noreferrer" className={buttonClass("primary", "h-8 px-2.5 text-[13px]")}>
            <Video className="size-3.5" aria-hidden="true" />
            Dołącz
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </>
      ) : null}
    </li>
  );
}
