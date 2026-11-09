"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Zapis automatyczny z opóźnieniem: `schedule(value)` po każdej zmianie,
 * zapis rusza po `delay` ms bez zmian. Niezapisane zmiany są wysyłane przy zamknięciu karty.
 */
export function useAutosave<T>(save: (value: T) => Promise<boolean>, delay = 800) {
  const [state, setState] = useState<SaveState>("idle");
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setState("saving");
    const ok = await saveRef.current(p.value);
    setState(ok ? "saved" : "error");
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    const onHide = () => {
      if (pending.current) flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (pending.current) flush();
    };
  }, [flush]);

  return { state, schedule, flush };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  const text = { idle: "", saving: "Zapisywanie…", saved: "Zapisano", error: "Nie udało się zapisać" }[state];
  return (
    <span role="status" className={state === "error" ? "text-sm text-danger" : "text-sm text-ink-3"}>
      {text}
    </span>
  );
}
