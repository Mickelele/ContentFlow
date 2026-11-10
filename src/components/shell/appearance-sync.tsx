"use client";

import { useEffect, useRef } from "react";
import { applySavedAppearance, setAppearancePersist, type SavedAppearance } from "@/lib/appearance";
import { createClient } from "@/lib/supabase/client";

/**
 * Wygląd na koncie (D-36): po wejściu do aplikacji ustawienia z profilu nadpisują te z urządzenia,
 * a każda zmiana stylu, koloru lub trybu zapisuje się w profiles.settings.appearance.
 * localStorage zostaje jako szybki start (skrypt w <head> maluje stronę od razu we właściwych kolorach).
 */
export function AppearanceSync({ userId, settings }: { userId: string; settings: Record<string, unknown> | null }) {
  const latest = useRef<Record<string, unknown>>(settings ?? {});

  useEffect(() => {
    const saved = (settings?.appearance ?? null) as SavedAppearance | null;
    if (saved) applySavedAppearance(saved);

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    setAppearancePersist((a) => {
      // Kilka kliknięć z rzędu (np. przeglądanie kolorów) = jeden zapis.
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const next = { ...latest.current, appearance: a };
        const { error } = await supabase.from("profiles").update({ settings: next }).eq("id", userId);
        if (!error) latest.current = next;
      }, 500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      setAppearancePersist(null);
    };
    // Ustawienia z serwera stosujemy raz, przy wejściu do aplikacji.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
