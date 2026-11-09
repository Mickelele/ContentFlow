"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cx } from "@/components/ui";
import { colorVars } from "@/lib/palette";
import type { Workspace } from "@/lib/workspace";

export function WorkspaceBadge({ ws, size = 28 }: { ws: Pick<Workspace, "name" | "color">; size?: number }) {
  const c = colorVars(ws.color);
  const initials = ws.name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
      style={{ width: size, height: size, background: c.fill, color: c.ink }}
    >
      {initials}
    </span>
  );
}

export function WorkspaceSwitcher({
  current,
  workspaces,
  compact = false,
}: {
  current: Workspace;
  workspaces: Workspace[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "pressable flex w-full items-center gap-2.5 rounded-lg text-left hover:bg-surface-2",
          compact ? "h-10 px-1" : "h-11 border border-line px-2",
        )}
      >
        <WorkspaceBadge ws={current} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      </button>

      <div
        id={menuId}
        hidden={!open}
        className={cx(
          "absolute top-full right-0 left-0 z-50 mt-1 min-w-60 origin-top rounded-xl border border-line bg-surface p-1.5",
          "shadow-[0_12px_32px_-8px_rgb(0_0_0/0.18),0_2px_6px_rgb(0_0_0/0.06)]",
          "transition-[opacity,scale] duration-150 ease-[var(--ease-out)] starting:scale-95 starting:opacity-0",
        )}
      >
        <p className="px-2.5 pt-1.5 pb-1 text-xs text-ink-3">Twoje workspace&apos;y</p>
        <ul className="flex flex-col">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link
                href={`/w/${ws.slug}`}
                onClick={() => setOpen(false)}
                aria-current={ws.id === current.id ? "true" : undefined}
                className="flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-surface-2"
              >
                <WorkspaceBadge ws={ws} size={24} />
                <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                {ws.id === current.id ? <Check className="size-4 text-ink" aria-hidden="true" /> : null}
              </Link>
            </li>
          ))}
        </ul>
        <div className="my-1 h-px bg-line" />
        <Link
          href="/nowy-workspace"
          onClick={() => setOpen(false)}
          className="flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <span className="inline-flex size-6 items-center justify-center rounded-md border border-dashed border-line-strong">
            <Plus className="size-3.5" aria-hidden="true" />
          </span>
          Nowy workspace
        </Link>
      </div>
    </div>
  );
}
