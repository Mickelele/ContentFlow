"use client";

import Link from "next/link";
import { createContext, use, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AlarmClock, BadgeCheck, Bell, CalendarClock, CircleAlert, Send, X } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Kind = "reminder" | "due_today" | "overdue" | "publication" | "approval";
export type Notice = {
  key: string;
  kind: Kind;
  workspace_id: string;
  source_type: "event" | "task" | "publication" | "milestone";
  source_id: string;
  title: string;
  at: string;
  read: boolean;
};

const POLL_MS = 60_000;
const ICONS = { reminder: AlarmClock, due_today: CalendarClock, overdue: CircleAlert, publication: Send, approval: BadgeCheck };
const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });

function describe(n: Notice) {
  const at = new Date(n.at);
  const mins = Math.round((at.getTime() - Date.now()) / 60000);
  switch (n.kind) {
    case "reminder":
      return mins > 0 ? `Za ${mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} godz.`} · ${timeFmt.format(at)}` : `Rozpoczęło się o ${timeFmt.format(at)}`;
    case "due_today":
      return "Termin dziś";
    case "overdue":
      return `Zaległe od ${dateFmt.format(at)}`;
    case "publication":
      return `Publikacja dziś o ${timeFmt.format(at)}`;
    case "approval":
      return "Czeka na akceptację";
  }
}

type Ctx = {
  items: Notice[];
  unread: number;
  markRead: (keys: string[]) => void;
  hrefFor: (n: Notice) => string;
};
const NotificationsContext = createContext<Ctx | null>(null);

/**
 * Powiadomienia w aplikacji: lista wyliczana w bazie (`notifications_feed`), odświeżana co minutę
 * i po powrocie do karty. Nowe przypomnienie o wydarzeniu pokazuje się dodatkowo jako dymek.
 */
export function NotificationsProvider({ slugs, children }: { slugs: Record<string, string>; children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notice[]>([]);
  const [toasts, setToasts] = useState<Notice[]>([]);
  const seen = useRef<Set<string> | null>(null);

  const fetchFeed = useCallback(async () => {
    const { data, error } = await supabase.rpc("notifications_feed");
    return error ? null : ((data ?? []) as Notice[]);
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetchFeed().then((list) => {
        if (!alive || !list) return;
        const known = seen.current;
        if (known) {
          const fresh = list.filter((n) => n.kind === "reminder" && !n.read && !known.has(n.key));
          if (fresh.length) setToasts((t) => [...t, ...fresh].slice(-3));
        }
        seen.current = new Set(list.map((n) => n.key));
        setItems(list);
      });
    tick();
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchFeed]);

  const markRead = useCallback(
    (keys: string[]) => {
      if (!keys.length) return;
      const set = new Set(keys);
      setItems((xs) => xs.map((x) => (set.has(x.key) ? { ...x, read: true } : x)));
      setToasts((t) => t.filter((x) => !set.has(x.key)));
      supabase
        .from("notification_reads")
        .upsert(
          keys.map((key) => ({ key })),
          { onConflict: "user_id,key" },
        )
        .then(() => undefined);
    },
    [supabase],
  );

  const hrefFor = useCallback(
    (n: Notice) => {
      const slug = slugs[n.workspace_id];
      if (!slug) return "/";
      return n.source_type === "task" ? `/w/${slug}/zadania?zadanie=${n.source_id}` : `/w/${slug}/kalendarz`;
    },
    [slugs],
  );

  const value = useMemo(() => ({ items, unread: items.filter((n) => !n.read).length, markRead, hrefFor }), [items, markRead, hrefFor]);

  return (
    <NotificationsContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.key}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.35)] transition-[translate,opacity] duration-300 ease-[var(--ease-out)] starting:translate-y-3 starting:opacity-0"
          >
            <AlarmClock className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden="true" />
            <Link href={hrefFor(t)} onClick={() => markRead([t.key])} className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.title}</p>
              <p className="text-sm text-ink-2">{describe(t)}</p>
            </Link>
            <button
              type="button"
              aria-label="Zamknij"
              onClick={() => markRead([t.key])}
              className="-m-1 rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext>
  );
}

function NoticeList({ onNavigate }: { onNavigate: () => void }) {
  const ctx = use(NotificationsContext)!;
  if (ctx.items.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-ink-3">Brak powiadomień. Przypomnienia o wydarzeniach i terminach pojawią się tutaj.</p>;
  }
  return (
    <ul className="flex flex-col">
      {ctx.items.map((n) => {
        const Icon = ICONS[n.kind];
        return (
          <li key={n.key}>
            <Link
              href={ctx.hrefFor(n)}
              onClick={() => {
                ctx.markRead([n.key]);
                onNavigate();
              }}
              className="flex items-start gap-3 rounded-xl px-2.5 py-2.5 hover:bg-surface-2"
            >
              <Icon className={cx("mt-0.5 size-[18px] shrink-0", n.kind === "overdue" ? "text-danger" : "text-ink-2")} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate text-sm", !n.read && "font-semibold")}>{n.title}</span>
                <span className="block text-[13px] text-ink-3">{describe(n)}</span>
              </span>
              {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-focus" aria-label="Nieprzeczytane" /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BellIcon({ unread }: { unread: number }) {
  return (
    <span className="relative inline-flex">
      <Bell className="size-5" aria-hidden="true" />
      {unread > 0 ? (
        <span className="tabular absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </span>
  );
}

/** Dzwonek: na komputerze rozwijany panel, na telefonie okno od dołu. */
export function NotificationsBell({ variant }: { variant: "popover" | "sheet" }) {
  const ctx = use(NotificationsContext);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open || variant !== "popover") return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  if (!ctx) return null;
  const label = ctx.unread ? `Powiadomienia, nieprzeczytane: ${ctx.unread}` : "Powiadomienia";
  const unreadKeys = ctx.items.filter((n) => !n.read).map((n) => n.key);
  const markAll = unreadKeys.length ? (
    <button
      type="button"
      onClick={() => ctx.markRead(unreadKeys)}
      aria-label="Oznacz wszystkie powiadomienia jako przeczytane"
      className="text-sm whitespace-nowrap text-ink-2 hover:text-ink hover:underline"
    >
      Oznacz wszystkie
    </button>
  ) : null;

  const trigger = (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={variant === "popover" ? panelId : undefined}
      onClick={() => setOpen((o) => !o)}
      className="pressable inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <BellIcon unread={ctx.unread} />
    </button>
  );

  if (variant === "sheet") {
    return (
      <>
        {trigger}
        <Dialog open={open} onClose={() => setOpen(false)} title="Powiadomienia" size="sm" footer={markAll}>
          <NoticeList onNavigate={() => setOpen(false)} />
        </Dialog>
      </>
    );
  }

  return (
    <div ref={root} className="relative">
      {trigger}
      <div
        id={panelId}
        hidden={!open}
        className={cx(
          "absolute top-full left-0 z-50 mt-1 w-[22rem] origin-top-left rounded-2xl border border-line bg-surface p-2",
          "shadow-[0_16px_40px_-12px_rgb(0_0_0/0.3),0_2px_6px_rgb(0_0_0/0.06)]",
          "transition-[opacity,scale] duration-150 ease-[var(--ease-out)] starting:scale-95 starting:opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5 pb-2">
          <h2 className="font-semibold">Powiadomienia</h2>
          {markAll}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <NoticeList onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );
}
