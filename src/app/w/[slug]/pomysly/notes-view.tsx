"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Pin, Plus, Search, Trash2 } from "lucide-react";
import { RichText, type JSONContent } from "@/components/editor/rich-text";
import { SaveIndicator, useAutosave } from "@/components/editor/use-autosave";
import { Button, Input, buttonClass, cx, inputClass } from "@/components/ui";
import { colorVars } from "@/lib/palette";
import { createClient } from "@/lib/supabase/client";
import type { ClientRef, WorkspaceRef } from "@/lib/tasks";

type NoteRow = {
  id: string;
  title: string;
  body_text: string;
  pinned: boolean;
  client_id: string | null;
  event_id: string | null;
  updated_at: string;
};
type Note = NoteRow & { body: JSONContent | null; events: { title: string; starts_at: string } | null };

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
const LIST_SELECT = "id, title, body_text, pinned, client_id, event_id, updated_at";

export function NotesView({ workspace, clients, initialNoteId }: { workspace: WorkspaceRef; clients: ClientRef[]; initialNoteId: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initialNoteId);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("notes")
      .select(LIST_SELECT)
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError("Nie udało się wczytać notatek.");
        setNotes((data ?? []) as NoteRow[]);
      });
    if (initialNoteId) history.replaceState(null, "", location.pathname);
    return () => {
      alive = false;
    };
  }, [supabase, workspace.id, initialNoteId]);

  const create = async () => {
    const { data, error } = await supabase.from("notes").insert({ workspace_id: workspace.id }).select(LIST_SELECT).single();
    if (error || !data) return setError("Nie udało się utworzyć notatki.");
    setNotes((xs) => [data as NoteRow, ...(xs ?? [])]);
    setActiveId(data.id);
  };

  const onChanged = useCallback((id: string, p: Partial<NoteRow>) => {
    setNotes((xs) => xs?.map((x) => (x.id === id ? { ...x, ...p, updated_at: new Date().toISOString() } : x)) ?? xs);
  }, []);

  const q = query.trim().toLowerCase();
  const visible = (notes ?? [])
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body_text.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={cx("flex min-w-0 flex-col gap-3", activeId && "max-lg:hidden")} aria-label="Lista notatek">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj w notatkach" aria-label="Szukaj w notatkach" className="pl-9" />
          </div>
          <Button variant="primary" className="w-10 shrink-0 px-0" aria-label="Nowa notatka" onClick={create}>
            <Plus className="size-5" aria-hidden="true" />
          </Button>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {notes === null ? (
          <div className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">
            {notes.length === 0 ? "Nie ma jeszcze notatek. Kliknij +, żeby dodać pierwszą." : "Nic nie pasuje do wyszukiwania."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {visible.map((n) => {
              const c = n.client_id ? clientById.get(n.client_id) : undefined;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(n.id)}
                    aria-current={activeId === n.id ? "true" : undefined}
                    className={cx("w-full rounded-xl px-3 py-2.5 text-left", activeId === n.id ? "bg-surface-3" : "hover:bg-surface-2")}
                  >
                    <span className="flex items-center gap-1.5">
                      {n.pinned ? <Pin className="size-3.5 shrink-0 text-ink-2" fill="currentColor" aria-label="Przypięta" /> : null}
                      {n.event_id ? <CalendarDays className="size-3.5 shrink-0 text-ink-3" aria-label="Ze spotkania" /> : null}
                      <span className="truncate font-medium">{n.title || "Bez tytułu"}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[13px] text-ink-3">{n.body_text || "Pusta notatka"}</span>
                    <span className="tabular mt-1 flex items-center gap-2 text-xs text-ink-3">
                      {dateFmt.format(new Date(n.updated_at))}
                      {c ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-full" style={{ background: colorVars(c.color).solid }} aria-hidden="true" />
                          {c.name}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className={cx("min-w-0", !activeId && "max-lg:hidden")} aria-label="Notatka">
        {activeId ? (
          <NoteEditor
            key={activeId}
            id={activeId}
            workspace={workspace}
            clients={clients}
            onBack={() => setActiveId(null)}
            onChanged={onChanged}
            onDeleted={(id) => {
              setNotes((xs) => xs?.filter((x) => x.id !== id) ?? xs);
              setActiveId(null);
            }}
          />
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-2xl bg-surface-2 px-6 py-12 text-center">
            <p className="text-ink-2">Wybierz notatkę z listy albo utwórz nową.</p>
            <Button variant="secondary" className="mt-4" onClick={create}>
              <Plus className="size-4" aria-hidden="true" />
              Nowa notatka
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function NoteEditor({
  id,
  workspace,
  clients,
  onBack,
  onChanged,
  onDeleted,
}: {
  id: string;
  workspace: WorkspaceRef;
  clients: ClientRef[];
  onBack: () => void;
  onChanged: (id: string, p: Partial<NoteRow>) => void;
  onDeleted: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [note, setNote] = useState<Note | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("notes")
      .select(`${LIST_SELECT}, body, events(title, starts_at)`)
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (!data) setMissing(true);
        else setNote(data as unknown as Note);
      });
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  // Zmiany w kilku polach (tytuł, treść, klient) łączymy w jeden zapis.
  type Patch = Partial<NoteRow> & { body?: JSONContent };
  const pending = useRef<Patch>({});
  const { state, schedule } = useAutosave<Patch>(async (p) => {
    pending.current = {};
    const { error } = await supabase.from("notes").update(p).eq("id", id);
    return !error;
  });
  const change = (p: Patch) => {
    pending.current = { ...pending.current, ...p };
    schedule(pending.current);
    const { body: _body, ...listPart } = p;
    void _body;
    onChanged(id, listPart);
  };

  const savePin = async (pinned: boolean) => {
    setNote((n) => (n ? { ...n, pinned } : n));
    onChanged(id, { pinned });
    await supabase.from("notes").update({ pinned }).eq("id", id);
  };

  const remove = async () => {
    if (!confirm) return setConfirm(true);
    await supabase.from("notes").delete().eq("id", id);
    onDeleted(id);
  };

  if (missing) return <p className="rounded-2xl bg-surface-2 px-6 py-10 text-center text-ink-2">Ta notatka nie istnieje albo została usunięta.</p>;
  if (!note) return <div className="h-72 animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={buttonClass("ghost", "h-9 px-2 lg:hidden")}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Notatki
        </button>
        <select
          aria-label="Klient"
          className={cx(inputClass, "h-9 w-auto max-w-52")}
          defaultValue={note.client_id ?? ""}
          onChange={(e) => change({ client_id: e.target.value || null })}
        >
          <option value="">Bez klienta</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={note.pinned}
          onClick={() => savePin(!note.pinned)}
          className={buttonClass("ghost", cx("h-9 px-2.5", note.pinned && "text-ink"))}
        >
          <Pin className="size-4" fill={note.pinned ? "currentColor" : "none"} aria-hidden="true" />
          {note.pinned ? "Przypięta" : "Przypnij"}
        </button>
        <span className="ml-auto">
          <SaveIndicator state={state} />
        </span>
        <Button variant="danger" className="h-9 px-3" onClick={remove}>
          <Trash2 className="size-4" aria-hidden="true" />
          {confirm ? "Na pewno usunąć?" : "Usuń"}
        </Button>
      </div>

      {note.events ? (
        <Link
          href={`/w/${workspace.slug}/kalendarz`}
          className="flex items-center gap-2 self-start rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          Ze spotkania: {note.events.title} · {dateFmt.format(new Date(note.events.starts_at))}
        </Link>
      ) : null}

      <input
        defaultValue={note.title}
        onChange={(e) => change({ title: e.target.value })}
        placeholder="Tytuł notatki"
        aria-label="Tytuł notatki"
        data-autofocus=""
        autoFocus={!note.title}
        className="w-full bg-transparent text-2xl font-semibold tracking-tight placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
      />
      <RichText
        label="Treść notatki"
        content={note.body}
        placeholder="Ustalenia, pomysły, lista rzeczy do zrobienia…"
        onChange={(body, text) => change({ body, body_text: text.slice(0, 5000) })}
        className="min-h-80"
      />
    </div>
  );
}
