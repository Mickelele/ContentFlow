"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui";

type Mode = "light" | "dark" | "system";
const KEY = "cf-theme";
const ORDER: Mode[] = ["system", "light", "dark"];
const LABEL: Record<Mode, string> = { system: "Motyw: systemowy", light: "Motyw: jasny", dark: "Motyw: ciemny" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

const listeners = new Set<() => void>();
function read(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function write(mode: Mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  apply(mode);
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => read() === "system" && apply("system");
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSystem);
  };
}

export function ThemeToggle({ large = false }: { large?: boolean }) {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);
  const Icon = ICON[mode];
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => write(next)}
      className={cx(
        "flex items-center gap-3 rounded-lg px-3 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
        large ? "h-12 gap-4 text-[15px] active:bg-surface-2" : "h-9 text-sm",
      )}
    >
      <Icon className={large ? "size-5" : "size-[18px]"} strokeWidth={1.8} aria-hidden="true" />
      {LABEL[mode]}
    </button>
  );
}
