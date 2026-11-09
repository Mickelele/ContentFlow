"use client";

import type { ReactNode } from "react";
import { Check, Flag, ListChecks } from "lucide-react";
import { cx } from "@/components/ui";
import { colorVars } from "@/lib/palette";
import { dueLabel, isOverdue, type ClientRef, type Task } from "@/lib/tasks";

export function TaskCheckbox({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cx(
        "pressable flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        done ? "border-ink bg-ink text-bg" : "border-line-strong hover:border-ink-3",
      )}
    >
      <Check
        className={cx("size-3.5 transition-[opacity,scale] duration-200 ease-[var(--ease-out)]", done ? "scale-100 opacity-100" : "scale-50 opacity-0")}
        strokeWidth={3.2}
        aria-hidden="true"
      />
    </button>
  );
}

export function PriorityFlag({ priority }: { priority: Task["priority"] }) {
  if (priority === "normal" || priority === "low") return null;
  return (
    <Flag
      className="size-3.5 shrink-0"
      style={{ color: priority === "urgent" ? "var(--danger)" : "var(--c-orange-solid)" }}
      fill="currentColor"
      aria-label={priority === "urgent" ? "Pilne" : "Wysoki priorytet"}
    />
  );
}

export function ClientChip({ client }: { client: ClientRef }) {
  const c = colorVars(client.color);
  return (
    <span className="inline-flex max-w-40 items-center gap-1.5 truncate">
      <span className="size-2 shrink-0 rounded-full" style={{ background: c.solid }} aria-hidden="true" />
      <span className="truncate">{client.name}</span>
    </span>
  );
}

/** Wiersz zadania: checkbox, nazwa, termin, klient, checklista, priorytet. */
export function TaskRow({
  task,
  client,
  workspaceBadge,
  onToggle,
  onOpen,
  actions,
  handle,
  showDue = true,
}: {
  task: Task;
  client?: ClientRef;
  workspaceBadge?: ReactNode;
  onToggle: () => void;
  onOpen: () => void;
  actions?: ReactNode;
  handle?: ReactNode;
  showDue?: boolean;
}) {
  const done = task.status === "done";
  const due = showDue ? dueLabel(task) : null;
  const overdue = isOverdue(task);
  const meta = [
    due ? (
      <span key="due" className={cx(overdue && "font-medium text-danger")}>
        {overdue ? `Zaległe · ${due}` : due}
      </span>
    ) : null,
    client ? <ClientChip key="client" client={client} /> : null,
    task.checklist_total > 0 ? (
      <span key="list" className="tabular inline-flex items-center gap-1">
        <ListChecks className="size-3.5" aria-hidden="true" />
        {task.checklist_done}/{task.checklist_total}
      </span>
    ) : null,
    task.status === "in_progress" ? <span key="st">W trakcie</span> : null,
  ].filter(Boolean);

  return (
    <div className="group flex min-h-14 items-center gap-3 bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2 sm:px-4">
      {handle}
      <TaskCheckbox done={done} onToggle={onToggle} label={done ? `Cofnij ukończenie: ${task.title}` : `Ukończ: ${task.title}`} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <PriorityFlag priority={task.priority} />
          <span className={cx("truncate", done && "text-ink-3 line-through decoration-ink-3/70")}>{task.title}</span>
        </span>
        {meta.length > 0 ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-3">{meta}</span>
        ) : null}
      </button>
      {workspaceBadge}
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
