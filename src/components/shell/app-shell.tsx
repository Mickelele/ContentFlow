"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ellipsis, LogOut, Plus, X } from "lucide-react";
import { signOut } from "@/app/logowanie/actions";
import { Logo } from "@/components/logo";
import { cx } from "@/components/ui";
import { NEW_EVENT } from "@/lib/calendar";
import type { Workspace } from "@/lib/workspace";
import { MOBILE_PRIMARY, NAV, SETTINGS, type NavItem } from "./nav";
import { NotificationsBell, NotificationsProvider } from "./notifications";
import { ThemeToggle } from "./theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";

type User = { name: string; email: string; avatar: string | null };

export function AppShell({
  workspace,
  workspaces,
  user,
  children,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  user: User;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/w/${workspace.slug}`;
  const isActive = (item: NavItem) => pathname === `${base}/${item.href}` || pathname.startsWith(`${base}/${item.href}/`);

  const slugs = Object.fromEntries(workspaces.map((w) => [w.id, w.slug]));

  return (
    <NotificationsProvider slugs={slugs}>
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop: panel boczny */}
      <aside className="sticky top-0 z-40 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-14 items-center justify-between pr-2 pl-5">
          <Link href="/" className="rounded-md">
            <Logo />
          </Link>
          <NotificationsBell variant="popover" />
        </div>
        <div className="px-3">
          <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
        </div>
        <nav aria-label="Główna" className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <SideLink key={item.href} item={item} href={`${base}/${item.href}`} active={isActive(item)} />
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-line px-3 py-3">
          <SideLink item={SETTINGS} href={`${base}/${SETTINGS.href}`} active={isActive(SETTINGS)} />
          <ThemeToggle />
          <UserRow user={user} />
        </div>
      </aside>

      {/* Telefon: górny pasek */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="min-w-0 flex-1">
          <WorkspaceSwitcher current={workspace} workspaces={workspaces} compact />
        </div>
        <NotificationsBell variant="sheet" />
        <Avatar user={user} />
      </header>

      <main className="min-w-0 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">{children}</main>

      <MobileTabBar base={base} isActive={isActive} user={user} />
    </div>
    </NotificationsProvider>
  );
}

function SideLink({ item, href, active }: { item: NavItem; href: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        active ? "bg-surface-3 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar} alt="" width={size} height={size} className="shrink-0 rounded-full" referrerPolicy="no-referrer" />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-medium text-ink-2"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function UserRow({ user }: { user: User }) {
  return (
    <div className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2">
      <Avatar user={user} size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-ink-3">{user.email}</p>
      </div>
      <form action={signOut}>
        <button type="submit" aria-label="Wyloguj" className="pressable rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function MobileTabBar({ base, isActive, user }: { base: string; isActive: (i: NavItem) => boolean; user: User }) {
  const [sheet, setSheet] = useState<null | "more" | "add">(null);
  const pathname = usePathname();
  // Zamknij arkusz po nawigacji.
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setSheet(null);
    }
  }, [pathname]);

  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const rest = [...NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href)), SETTINGS];
  const moreActive = rest.some(isActive);

  const tab = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={`${base}/${item.href}`}
        aria-current={active ? "page" : undefined}
        className={cx("flex flex-1 flex-col items-center gap-1 py-2 text-[11px]", active ? "font-medium text-ink" : "text-ink-3")}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Główna"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {primary.slice(0, 2).map(tab)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => setSheet("add")}
            aria-label="Dodaj"
            className="pressable inline-flex size-12 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Plus className="size-6" aria-hidden="true" />
          </button>
        </div>
        {primary.slice(2).map(tab)}
        <button
          type="button"
          onClick={() => setSheet("more")}
          className={cx("flex flex-1 flex-col items-center gap-1 py-2 text-[11px]", moreActive ? "font-medium text-ink" : "text-ink-3")}
        >
          <Ellipsis className="size-[22px]" aria-hidden="true" />
          Więcej
        </button>
      </nav>

      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title="Więcej">
        <div className="flex flex-col">
          {rest.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={`${base}/${item.href}`}
                className="flex h-12 items-center gap-4 rounded-lg px-3 text-[15px] active:bg-surface-2"
              >
                <Icon className="size-5 text-ink-2" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle large />
          <form action={signOut}>
            <button type="submit" className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-[15px] text-ink-2 active:bg-surface-2">
              <LogOut className="size-5" aria-hidden="true" />
              Wyloguj ({user.email})
            </button>
          </form>
        </div>
      </Sheet>

      <Sheet open={sheet === "add"} onClose={() => setSheet(null)} title="Dodaj">
        <div className="flex flex-col">
          {[
            { href: `${base}/kalendarz?nowe=1`, label: "Wydarzenie" },
            { href: `${base}/zadania`, label: "Zadanie" },
            { href: `${base}/content`, label: "Materiał" },
            { href: `${base}/klienci/nowy`, label: "Klient" },
          ].map((a) => (
            <Link
              key={a.label}
              href={a.href}
              onClick={(e) => {
                // Kalendarz już otwarty: zamiast nawigacji od razu otwórz edytor.
                if (a.label === "Wydarzenie" && pathname === `${base}/kalendarz`) {
                  e.preventDefault();
                  setSheet(null);
                  window.dispatchEvent(new Event(NEW_EVENT));
                }
              }}
              className="flex h-12 items-center rounded-lg px-3 text-[15px] active:bg-surface-2"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/** Dolny arkusz na telefon — natywny <dialog>, więc focus i Esc działają same. */
function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cx(
        "m-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-black/40 lg:hidden",
        "translate-y-0 transition-transform duration-300 ease-[var(--ease-drawer)] starting:translate-y-full",
      )}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Zamknij" className="rounded-full p-2 text-ink-3 active:bg-surface-2">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
