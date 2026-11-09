"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, Field, cx, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ClientRef, WorkspaceRef } from "@/lib/tasks";

/*
 * Import z Trello na żądanie — z pliku JSON tablicy (Trello: menu tablicy → Drukuj, eksportuj i udostępniaj → Eksportuj jako JSON).
 * Bez klucza API i bez łączenia kont. Karta → zadanie, lista kontrolna → checklista, termin → termin oddania.
 * Ponowny import tej samej tablicy aktualizuje zadania (identyfikator karty w tasks.external_id).
 */

type TrelloBoard = {
  name: string;
  lists: { id: string; name: string; closed: boolean }[];
  cards: { id: string; name: string; desc: string; due: string | null; dueComplete: boolean; idList: string; closed: boolean; shortUrl?: string; idChecklists?: string[] }[];
  checklists?: { id: string; idCard: string; name: string; checkItems: { name: string; state: "complete" | "incomplete"; pos: number }[] }[];
};

const DONE_LIST = /^(done|zrobione|gotowe|ukończone|zakończone|completed)$/i;

export function TrelloImportDialog({
  open,
  onClose,
  workspace,
  clients,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  workspace: WorkspaceRef;
  clients: ClientRef[];
  onImported: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [board, setBoard] = useState<TrelloBoard | null>(null);
  const [lists, setLists] = useState<Set<string>>(new Set());
  const [doneLists, setDoneLists] = useState<Set<string>>(new Set());
  const [client, setClient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const readFile = async (file: File) => {
    setError(null);
    try {
      const json = JSON.parse(await file.text()) as TrelloBoard;
      if (!Array.isArray(json.cards) || !Array.isArray(json.lists)) throw new Error();
      const open = json.lists.filter((l) => !l.closed);
      setBoard(json);
      setLists(new Set(open.filter((l) => !DONE_LIST.test(l.name.trim())).map((l) => l.id)));
      setDoneLists(new Set(open.filter((l) => DONE_LIST.test(l.name.trim())).map((l) => l.id)));
    } catch {
      setError("To nie jest eksport tablicy Trello (plik JSON).");
    }
  };

  const run = async () => {
    if (!board) return;
    const cards = board.cards.filter((c) => !c.closed && (lists.has(c.idList) || doneLists.has(c.idList)));
    if (!cards.length) return setError("Zaznacz listy z kartami do importu.");
    setBusy(true);
    setError(null);
    try {
      const listName = new Map(board.lists.map((l) => [l.id, l.name]));
      const rows = cards.map((c, i) => ({
        workspace_id: workspace.id,
        external_id: `trello:${c.id}`,
        title: c.name.slice(0, 300),
        description: [c.desc?.trim(), `Trello: ${board.name} → ${listName.get(c.idList) ?? ""}`, c.shortUrl].filter(Boolean).join("\n\n"),
        status: c.dueComplete || doneLists.has(c.idList) ? "done" : "todo",
        due_at: c.due,
        due_all_day: false,
        client_id: client || null,
        position: i,
      }));
      const { data, error } = await supabase.from("tasks").upsert(rows, { onConflict: "workspace_id,external_id" }).select("id, external_id");
      if (error || !data) throw new Error("Nie udało się zapisać zadań.");

      // Listy kontrolne → checklisty (przy ponownym imporcie zastępujemy).
      const idByCard = new Map(data.map((t) => [String(t.external_id).replace("trello:", ""), t.id as string]));
      const items = (board.checklists ?? [])
        .filter((cl) => idByCard.has(cl.idCard))
        .flatMap((cl) =>
          [...cl.checkItems]
            .sort((a, b) => a.pos - b.pos)
            .map((it, i) => ({ task_id: idByCard.get(cl.idCard)!, label: it.name.slice(0, 300), done: it.state === "complete", position: i })),
        );
      if (items.length) {
        await supabase.from("checklist_items").delete().in("task_id", [...new Set(items.map((i) => i.task_id))]);
        for (let i = 0; i < items.length; i += 500) await supabase.from("checklist_items").insert(items.slice(i, i + 500));
      }
      setResult(`Zaimportowano ${rows.length} kart z tablicy „${board.name}”${items.length ? ` (${items.length} pozycji checklist)` : ""}.`);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import się nie udał.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string, on: boolean) => {
    const n = new Set(set);
    if (on) n.add(id);
    else n.delete(id);
    setter(n);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import z Trello"
      footer={
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={onClose}>
            {result ? "Zamknij" : "Anuluj"}
          </Button>
          {board && !result ? (
            <Button variant="primary" className="h-9" disabled={busy} onClick={run}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Importuj
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        {result ? (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {result}
          </p>
        ) : !board ? (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
              <li>W Trello otwórz tablicę → menu (⋯) → <strong>Drukuj, eksportuj i udostępniaj</strong>.</li>
              <li>Wybierz <strong>Eksportuj jako JSON</strong> i zapisz plik.</li>
              <li>Wskaż ten plik poniżej.</li>
            </ol>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-6 py-8 text-center hover:bg-surface-2">
              <Upload className="size-6 text-ink-3" aria-hidden="true" />
              <span className="font-medium">Wybierz plik JSON z Trello</span>
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            </label>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              Tablica <strong>{board.name}</strong>: {board.cards.filter((c) => !c.closed).length} kart na {board.lists.filter((l) => !l.closed).length} listach.
            </p>
            <fieldset>
              <legend className="text-sm font-medium">Listy</legend>
              <ul className="mt-2 flex flex-col divide-y divide-line rounded-xl border border-line">
                {board.lists
                  .filter((l) => !l.closed)
                  .map((l) => {
                    const n = board.cards.filter((c) => !c.closed && c.idList === l.id).length;
                    const on = lists.has(l.id) || doneLists.has(l.id);
                    return (
                      <li key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--ink)]"
                            checked={on}
                            onChange={(e) => {
                              toggle(lists, setLists, l.id, e.target.checked && !doneLists.has(l.id));
                              if (!e.target.checked) toggle(doneLists, setDoneLists, l.id, false);
                            }}
                          />
                          <span className="truncate">{l.name}</span>
                          <span className="tabular text-ink-3">{n}</span>
                        </label>
                        {on ? (
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-2">
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--ink)]"
                              checked={doneLists.has(l.id)}
                              onChange={(e) => {
                                toggle(doneLists, setDoneLists, l.id, e.target.checked);
                                toggle(lists, setLists, l.id, !e.target.checked);
                              }}
                            />
                            jako ukończone
                          </label>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </fieldset>
            {clients.length ? (
              <Field label="Przypisz do klienta" htmlFor="trello-client">
                <select id="trello-client" className={cx(inputClass)} value={client} onChange={(e) => setClient(e.target.value)}>
                  <option value="">Bez klienta</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </>
        )}
        {error ? (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
