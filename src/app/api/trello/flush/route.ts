import { flushTrelloOutbox, trelloConfigured } from "@/lib/trello";
import { getWorkspaces } from "@/lib/workspace";

/**
 * Wysyłka kolejki zmian do Trello zaraz po zmianie zadania. Wywołuje ją przeglądarka (TrelloAutoSync)
 * z opóźnieniem po serii zmian; obsługuje tylko workspace'y zalogowanej osoby. Resztę dobiera cron co minutę.
 */
export const maxDuration = 60;

export async function POST() {
  if (!trelloConfigured) return Response.json({ sent: 0, failed: 0 });
  const workspaces = await getWorkspaces();
  if (!workspaces.length) return Response.json({ sent: 0, failed: 0 });
  try {
    return Response.json(await flushTrelloOutbox(workspaces.map((w) => w.id)));
  } catch (e) {
    console.error("Trello flush:", e);
    return Response.json({ error: "flush failed" }, { status: 500 });
  }
}
