"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Synchronizacja na żywo: gdy w którejś z tabel coś się zmieni (na innym urządzeniu albo u innej osoby
 * z workspace'u), wywołuje `onChange` — z opóźnieniem, żeby seria zmian dała jedno odświeżenie.
 * Supabase Realtime filtruje zdarzenia przez RLS, więc dociera tylko to, co użytkownik może widzieć.
 */
export function useRealtime(name: string, tables: string[], onChange: () => void, delay = 500) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), delay);
    };
    let channel = supabase.channel(`cf-${name}-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, fire);
    }
    channel.subscribe();
    // Po powrocie do karty (telefon wyciągnięty z kieszeni) też odświeżamy — mogło coś umknąć.
    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [name, key, delay]);
}
