"use client";

import { useRealtime } from "@/lib/use-realtime";

/**
 * Trello: po zmianie zadania lub checklisty (trigger w bazie dopisuje ją do kolejki) prosi serwer o wysłanie
 * kolejki od razu, zamiast czekać na cron (co minutę). Seria zmian (np. przeciąganie na tablicy) daje jedno wywołanie.
 * Gdy Trello nie jest podłączone, kolejka jest pusta i serwer odpowiada od razu.
 */
export function TrelloAutoSync() {
  useRealtime(
    "trello-sync",
    ["tasks", "checklist_items"],
    () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/trello/flush", { method: "POST", keepalive: true }).catch(() => null);
    },
    2000,
  );
  return null;
}
