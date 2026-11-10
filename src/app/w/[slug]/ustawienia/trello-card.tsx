"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button, Field, Input, inputClass } from "@/components/ui";
import {
  connectTrelloAction,
  disconnectTrelloAction,
  saveTrelloBoardAction,
  trelloBoardsAction,
  trelloListsAction,
  type Result,
  type TrelloOption,
} from "./actions";

type Lists = { todo: string; in_progress: string; done: string };
export type TrelloState = {
  configured: boolean;
  connected: boolean;
  member: string | null;
  boardId: string | null;
  boardName: string | null;
  lists: Lists | null;
  sync: boolean;
};

const COLUMNS: { key: keyof Lists; label: string }[] = [
  { key: "todo", label: "Do zrobienia" },
  { key: "in_progress", label: "W trakcie" },
  { key: "done", label: "Ukończone" },
];

/** Adres autoryzacji Trello: po zgodzie Trello wraca na tę stronę z tokenem w #fragmencie adresu. */
function authorizeUrl(withReturn: boolean) {
  const params = new URLSearchParams({
    expiration: "never",
    name: "ContentFlow",
    scope: "read,write",
    response_type: "token",
    key: process.env.NEXT_PUBLIC_TRELLO_API_KEY ?? "",
  });
  if (withReturn) {
    params.set("callback_method", "fragment");
    params.set("return_url", `${window.location.origin}${window.location.pathname}`);
  }
  return `https://trello.com/1/authorize?${params}`;
}

function Feedback({ result }: { result: Result | null }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="inline-flex items-center gap-1.5 text-sm text-ink-2">
      <Check className="size-4 shrink-0" aria-hidden="true" />
      {result.message}
    </p>
  ) : (
    <p role="alert" className="text-sm text-danger">
      {result.error}
    </p>
  );
}

export function TrelloSection({ slug, initial, isOwner }: { slug: string; initial: TrelloState; isOwner: boolean }) {
  const [state, setState] = useState(initial);
  const [boards, setBoards] = useState<TrelloOption[] | null>(null);
  const [lists, setLists] = useState<TrelloOption[] | null>(null);
  const [boardId, setBoardId] = useState(initial.boardId ?? "");
  const [mapping, setMapping] = useState<Partial<Lists>>(initial.lists ?? {});
  const [sync, setSync] = useState(initial.sync || !initial.boardId);
  const [token, setToken] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  function loadBoards() {
    start(async () => {
      const r = await trelloBoardsAction(slug);
      if (!r.ok) return setResult(r);
      setBoards(r.boards);
      if (boardId) {
        const l = await trelloListsAction(slug, boardId);
        if (l.ok) setLists(l.lists);
      }
    });
  }

  function connect(t: string) {
    start(async () => {
      const r = await connectTrelloAction(slug, t);
      setResult(r);
      if (!r.ok) return;
      setState((s) => ({ ...s, connected: true, member: r.ok && "member" in r ? (r.member ?? s.member) : s.member }));
      setToken("");
      const b = await trelloBoardsAction(slug);
      if (b.ok) setBoards(b.boards);
    });
  }

  // Powrót z autoryzacji Trello: token jest w #fragmencie adresu (nie trafia do serwera w adresie).
  useEffect(() => {
    const m = window.location.hash.match(/token=([A-Za-z0-9]+)/);
    if (!m) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    connect(m[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickBoard(id: string, create = false) {
    setBoardId(id);
    setLists(null);
    setResult(null);
    if (!id) return;
    start(async () => {
      const r = await trelloListsAction(slug, id, create);
      if (!r.ok) return setResult(r);
      setLists(r.lists);
      setMapping(r.guess);
    });
  }

  const complete = Boolean(boardId && mapping.todo && mapping.in_progress && mapping.done);
  const editing = boards !== null;

  let body: ReactNode;
  if (!state.configured) {
    body = (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
        Wymaga klucza API Trello (<code>NEXT_PUBLIC_TRELLO_API_KEY</code>). Instrukcja jest w pliku <code>docs/KONFIGURACJA.md</code>.
      </p>
    );
  } else if (!isOwner) {
    body = (
      <p className="text-sm text-ink-2">
        {state.boardName && state.sync ? (
          <>
            Zadania trafiają na tablicę <strong>{state.boardName}</strong>.
          </>
        ) : (
          "Trello może podłączyć właściciel workspace'u."
        )}
      </p>
    );
  } else if (!state.connected) {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          Nowe i zmienione zadania z ContentFlow będą automatycznie trafiać na wybraną tablicę Trello: tytuł, opis, termin, checklista, a kolumna
          wyznacza listę. Zmiany zrobione w Trello nie wracają do ContentFlow.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={pending} onClick={() => (window.location.href = authorizeUrl(true))}>
            {pending ? "Łączę…" : "Połącz z Trello"}
          </Button>
          <Feedback result={result} />
        </div>
        <details className="text-sm text-ink-2">
          <summary className="cursor-pointer">Trello nie wróciło do ContentFlow?</summary>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              connect(token);
            }}
          >
            <p>
              <a href={authorizeUrl(false)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                Otwórz autoryzację w nowej karcie
              </a>
              , kliknij „Zezwól” i wklej pokazany token.
            </p>
            <Field label="Token Trello" htmlFor="trello-token">
              <Input id="trello-token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} />
            </Field>
            <div>
              <Button type="submit" variant="secondary" disabled={pending || !token.trim()}>
                Połącz
              </Button>
            </div>
          </form>
        </details>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Konto Trello: <strong>{state.member ?? "połączone"}</strong>
          {state.boardName && !editing ? (
            <>
              {" "}
              · tablica <strong>{state.boardName}</strong> · wysyłka {state.sync ? "włączona" : "wyłączona"}
            </>
          ) : null}
        </p>

        {editing ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!complete) return;
              start(async () => {
                const r = await saveTrelloBoardAction(slug, { boardId, lists: mapping as Lists, sync });
                setResult(r);
                if (r.ok) {
                  setState((s) => ({ ...s, boardId, boardName: boards?.find((b) => b.id === boardId)?.name ?? s.boardName, lists: mapping as Lists, sync }));
                  setBoards(null);
                }
              });
            }}
          >
            <Field label="Tablica" htmlFor="trello-board">
              <select id="trello-board" className={inputClass} value={boardId} onChange={(e) => pickBoard(e.target.value)} disabled={pending}>
                <option value="">Wybierz tablicę…</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>

            {boardId && lists ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-medium">Kolumna w ContentFlow → lista w Trello</legend>
                {COLUMNS.map((c) => (
                  <div key={c.key} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
                    <label htmlFor={`trello-${c.key}`} className="text-sm text-ink-2">
                      {c.label}
                    </label>
                    <select
                      id={`trello-${c.key}`}
                      className={inputClass}
                      value={mapping[c.key] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [c.key]: e.target.value }))}
                    >
                      <option value="">Wybierz listę…</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => pickBoard(boardId, true)}>
                    Utwórz na tablicy listy „Do zrobienia”, „W trakcie”, „Ukończone”
                  </Button>
                </div>
              </fieldset>
            ) : boardId && pending ? (
              <p className="text-sm text-ink-3">Pobieram listy…</p>
            ) : null}

            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={sync} onChange={(e) => setSync(e.target.checked)} />
              Wysyłaj zadania do Trello automatycznie
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={pending || !complete}>
                {pending ? "Zapisuję…" : "Zapisz"}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setBoards(null)}>
                Anuluj
              </Button>
              <Feedback result={result} />
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={state.boardId ? "secondary" : "primary"} disabled={pending} onClick={loadBoards}>
              {pending ? "Wczytuję…" : state.boardId ? "Zmień tablicę lub listy" : "Wybierz tablicę"}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await disconnectTrelloAction(slug);
                  setResult(r);
                  if (r.ok) setState((s) => ({ ...s, connected: false, member: null, boardId: null, boardName: null, lists: null, sync: false }));
                })
              }
            >
              Odłącz
            </Button>
            <Feedback result={result} />
          </div>
        )}
        <p className="text-sm text-ink-3">Zmiany zrobione w Trello nie wracają do ContentFlow. Usunięte zadanie archiwizuje kartę.</p>
      </div>
    );
  }

  return body;
}
