"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DrivePickButton, ExportDocButton } from "@/components/google-buttons";
import { ApprovalSection } from "./approval-section";
import { ScriptVersionsButton } from "./script-versions";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { ChatGptMenu } from "@/components/chatgpt-menu";
import { LinkRow } from "@/components/link-chip";
import { defaultLinkName, normalizeUrl } from "@/lib/links";
import { materialPrompts } from "@/lib/prompts";
import { RichText, type Editor, type JSONContent } from "@/components/editor/rich-text";
import { SaveIndicator, useAutosave } from "@/components/editor/use-autosave";
import { TaskCheckbox } from "@/components/tasks/task-row";
import { Button, Input, Textarea, buttonClass, cx, inputClass } from "@/components/ui";
import {
  CONTENT_TYPES,
  MILESTONES,
  PLATFORM_LIST,
  REEL_TEMPLATE,
  STAGES,
  formatHashtags,
  parseHashtags,
  stageIndex,
  type ContentStage,
  type ContentType,
  type MilestoneKind,
  type Platform,
} from "@/lib/content";
import { createClient } from "@/lib/supabase/client";
import { dateKey, keyToDate, type ClientRef, type ProjectRef, type WorkspaceRef } from "@/lib/tasks";

type Milestone = { id: string; kind: MilestoneKind; due_at: string; done_at: string | null };
type Publication = { id: string; platform: Platform; publish_at: string; caption: string | null; hashtags: string[]; status: "planned" | "published" | "cancelled" };
type Shot = { id: string; description: string; done: boolean; position: number };
type Attachment = { id: string; name: string; url: string };
type InsertLink = (row: { name: string; url: string; drive_file_id?: string; mime_type?: string }) => Promise<void>;

export type Material = {
  id: string;
  workspace_id: string;
  title: string;
  type: ContentType;
  stage: ContentStage;
  client_id: string | null;
  project_id: string | null;
  description: string | null;
  content_milestones: Milestone[];
  content_publications: Publication[];
  shots: Shot[];
  script: JSONContent | null;
  attachments: Attachment[];
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Czysty tekst z dokumentu Tiptap (JSON). */
function docText(doc: JSONContent | null): string {
  if (!doc) return "";
  const own = doc.text ?? "";
  const inner = (doc.content ?? []).map(docText).join(doc.type === "doc" ? "\n" : " ");
  return (own + inner).trim();
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function MaterialEditor({
  material,
  workspace,
  clients,
  projects,
  clientEmail,
}: {
  material: Material;
  workspace: WorkspaceRef;
  clients: ClientRef[];
  projects: ProjectRef[];
  clientEmail: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [m, setM] = useState(material);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/w/${workspace.slug}/content`;

  const fail = (msg: string) => (e: { message?: string } | null) => {
    if (e) setError(msg);
  };

  // ── Pola materiału ──
  const patch = async (p: Partial<Pick<Material, "title" | "type" | "stage" | "client_id" | "project_id">>) => {
    setM((x) => ({ ...x, ...p }));
    const { error } = await supabase.from("content").update(p).eq("id", m.id);
    fail("Nie udało się zapisać zmiany.")(error);
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    const { error } = await supabase.from("content").delete().eq("id", m.id);
    if (error) return setError("Nie udało się usunąć materiału.");
    router.push(base);
    router.refresh();
  };

  const clientProjects = projects.filter((p) => !m.client_id || !p.client_id || p.client_id === m.client_id);

  // Aktualny tekst scenariusza i platformy — do poleceń ChatGPT.
  const scriptText = useRef(docText(material.script));
  const addLink = useRef<InsertLink | null>(null);
  const scriptEditor = useRef<Editor | null>(null);
  const platforms = useRef(material.content_publications.map((p) => p.platform));
  const prompts = () =>
    materialPrompts({
      title: m.title,
      type: m.type,
      client: clients.find((c) => c.id === m.client_id)?.name,
      platforms: [...new Set(platforms.current)],
      script: scriptText.current,
    });

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={base} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Content
      </Link>

      <header className="mb-6">
        <TitleInput value={m.title} onSave={(title) => patch({ title })} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select aria-label="Rodzaj materiału" className={cx(inputClass, "h-9 w-auto")} value={m.type} onChange={(e) => patch({ type: e.target.value as ContentType })}>
            {(Object.keys(CONTENT_TYPES) as ContentType[]).map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPES[t].label}
              </option>
            ))}
          </select>
          <select
            aria-label="Klient"
            className={cx(inputClass, "h-9 w-auto max-w-56")}
            value={m.client_id ?? ""}
            onChange={(e) => patch({ client_id: e.target.value || null, project_id: null })}
          >
            <option value="">Bez klienta</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clientProjects.length > 0 || m.project_id ? (
            <select
              aria-label="Projekt"
              className={cx(inputClass, "h-9 w-auto max-w-56")}
              value={m.project_id ?? ""}
              onChange={(e) => patch({ project_id: e.target.value || null })}
            >
              <option value="">Bez projektu</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <ChatGptMenu items={prompts} className="ml-auto" />
          <Button variant="danger" className="h-9 px-3" onClick={remove}>
            <Trash2 className="size-4" aria-hidden="true" />
            {confirmDelete ? "Na pewno usunąć?" : "Usuń"}
          </Button>
        </div>
      </header>

      <StageStepper stage={m.stage} onChange={(stage) => patch({ stage })} />

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <ScriptSection
            contentId={m.id}
            initial={m.script}
            onText={(t) => (scriptText.current = t)}
            onEditor={(e) => (scriptEditor.current = e)}
            exportTitle={`${m.title} — scenariusz`}
            onError={setError}
            onExported={async (doc) => {
              await addLink.current?.({ name: "Scenariusz (Google Docs)", url: doc.url, drive_file_id: doc.id, mime_type: "application/vnd.google-apps.document" });
            }}
          />
          <ShotsSection contentId={m.id} initial={m.shots} onError={setError} />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <ApprovalSection
            contentId={m.id}
            title={m.title}
            clientEmail={clientEmail}
            getEditor={() => scriptEditor.current}
            onSent={() => m.stage !== "approval" && patch({ stage: "approval" })}
            onError={setError}
          />
          <MilestonesSection contentId={m.id} initial={m.content_milestones} onError={setError} />
          <PublicationsSection
            contentId={m.id}
            initial={m.content_publications}
            onError={setError}
            onPlatforms={(list) => (platforms.current = list)}
          />
          <LinksSection
            contentId={m.id}
            workspaceId={m.workspace_id}
            initial={m.attachments}
            onError={setError}
            onInsertReady={(fn) => (addLink.current = fn)}
            extra={(insert) => (
              <DrivePickButton
                onError={setError}
                onPicked={async (files) => {
                  for (const f of files) await insert({ name: f.name, url: f.url, drive_file_id: f.id, mime_type: f.mimeType });
                }}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function TitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const commit = () => {
    const t = v.trim();
    if (!t) return setV(value);
    if (t !== value) onSave(t);
  };
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      aria-label="Nazwa materiału"
      className="w-full rounded-lg bg-transparent text-2xl font-semibold tracking-tight text-balance hover:bg-surface-2 focus:bg-surface-2 focus:outline-none sm:text-3xl"
    />
  );
}

function StageStepper({ stage, onChange }: { stage: ContentStage; onChange: (s: ContentStage) => void }) {
  const current = stageIndex(stage);
  return (
    <nav aria-label="Etap produkcji" className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex w-max min-w-full gap-1 rounded-xl bg-surface-2 p-1">
        {STAGES.map((s, i) => (
          <li key={s.key} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(s.key)}
              aria-current={i === current ? "step" : undefined}
              className={cx(
                "pressable h-9 w-full rounded-lg px-3 text-sm whitespace-nowrap transition-colors",
                i === current ? "bg-ink font-medium text-bg" : i < current ? "text-ink hover:bg-surface-3" : "text-ink-3 hover:bg-surface-3 hover:text-ink",
              )}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─── Scenariusz ─────────────────────────────────────────────

function ScriptSection({
  contentId,
  initial,
  onText,
  onEditor,
  exportTitle,
  onExported,
  onError,
}: {
  contentId: string;
  initial: JSONContent | null;
  onText: (text: string) => void;
  onEditor: (editor: Editor) => void;
  exportTitle: string;
  onExported: (doc: { id: string; url: string }) => Promise<void>;
  onError: (m: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<Editor | null>(null);
  const [empty, setEmpty] = useState(!initial || !(initial.content?.length ?? 0) || JSON.stringify(initial) === JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }));
  const { state, schedule } = useAutosave<JSONContent>(async (body) => {
    const { error } = await supabase.from("scripts").upsert({ content_id: contentId, body }, { onConflict: "content_id" });
    return !error;
  });

  return (
    <Section title="Scenariusz" aside={<SaveIndicator state={state} />}>
      <RichText
        label="Scenariusz"
        content={initial}
        placeholder="Napisz scenariusz albo wstaw szablon rolki"
        onReady={(e) => {
          editorRef.current = e;
          onEditor(e);
        }}
        onChange={(doc, text) => {
          setEmpty(!text.trim());
          onText(text);
          schedule(doc);
        }}
        toolbarExtra={
          empty ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const ed = editorRef.current;
                if (!ed) return;
                ed.commands.setContent(REEL_TEMPLATE, { emitUpdate: true });
                // Kursor w pustym akapicie pod nagłówkiem „Hook”.
                const pos = ed.state.doc.child(0).nodeSize + 1;
                ed.chain().focus().setTextSelection(pos).run();
              }}
              className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}
            >
              Szablon rolki
            </button>
          ) : (
            <>
              <ScriptVersionsButton contentId={contentId} getEditor={() => editorRef.current} onError={onError} />
              <ExportDocButton
                title={exportTitle}
                getHtml={() => editorRef.current?.getHTML() ?? ""}
                onCreated={onExported}
                onError={onError}
              />
            </>
          )
        }
      />
    </Section>
  );
}

// ─── Lista ujęć ─────────────────────────────────────────────

function ShotsSection({ contentId, initial, onError }: { contentId: string; initial: Shot[]; onError: (m: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [shots, setShots] = useState(initial);
  const [text, setText] = useState("");
  const done = shots.filter((s) => s.done).length;

  const add = async () => {
    const description = text.trim();
    if (!description) return;
    setText("");
    const { data, error } = await supabase
      .from("shots")
      .insert({ content_id: contentId, description, position: shots.length })
      .select("id, description, done, position")
      .single();
    if (error || !data) return onError("Nie udało się dodać ujęcia.");
    setShots((xs) => [...xs, data as Shot]);
  };

  return (
    <Section title="Ujęcia" aside={shots.length ? <span className="tabular text-sm text-ink-3">{done}/{shots.length} nagrane</span> : null}>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {shots.map((s, i) => (
            <li key={s.id} className="group flex min-h-12 items-center gap-3 px-3 sm:px-4">
              <span className="tabular w-5 shrink-0 text-right text-[13px] text-ink-3">{i + 1}</span>
              <TaskCheckbox
                done={s.done}
                label={s.description}
                onToggle={async () => {
                  setShots((xs) => xs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)));
                  await supabase.from("shots").update({ done: !s.done }).eq("id", s.id);
                }}
              />
              <span className={cx("min-w-0 flex-1 py-2 text-sm", s.done && "text-ink-3 line-through")}>{s.description}</span>
              <button
                type="button"
                aria-label={`Usuń ujęcie: ${s.description}`}
                onClick={async () => {
                  setShots((xs) => xs.filter((x) => x.id !== s.id));
                  await supabase.from("shots").delete().eq("id", s.id);
                }}
                className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className={cx("flex items-center gap-3 px-3 sm:px-4", shots.length > 0 && "border-t border-line")}
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Plus className="ml-1 size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dodaj ujęcie, np. „zbliżenie na kokpit”, i Enter"
            aria-label="Nowe ujęcie"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
          />
        </form>
      </div>
    </Section>
  );
}

// ─── Terminy produkcji ──────────────────────────────────────

function MilestonesSection({ contentId, initial, onError }: { contentId: string; initial: Milestone[]; onError: (m: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initial);

  const setDate = async (kind: MilestoneKind, value: string) => {
    const existing = items.find((x) => x.kind === kind);
    if (!value) {
      if (!existing) return;
      setItems((xs) => xs.filter((x) => x.kind !== kind));
      const { error } = await supabase.from("content_milestones").delete().eq("id", existing.id);
      if (error) onError("Nie udało się usunąć terminu.");
      return;
    }
    const due_at = keyToDate(value).toISOString();
    const { data, error } = await supabase
      .from("content_milestones")
      .upsert({ content_id: contentId, kind, due_at, all_day: true }, { onConflict: "content_id,kind" })
      .select("id, kind, due_at, done_at")
      .single();
    if (error || !data) return onError("Nie udało się zapisać terminu.");
    setItems((xs) => [...xs.filter((x) => x.kind !== kind), data as Milestone]);
  };

  const toggleDone = async (ms: Milestone) => {
    const done_at = ms.done_at ? null : new Date().toISOString();
    setItems((xs) => xs.map((x) => (x.id === ms.id ? { ...x, done_at } : x)));
    await supabase.from("content_milestones").update({ done_at }).eq("id", ms.id);
  };

  return (
    <Section title="Terminy">
      <ul className="flex flex-col gap-2">
        {MILESTONES.map(({ kind, label }) => {
          const ms = items.find((x) => x.kind === kind);
          return (
            <li key={kind} className="flex items-center gap-3">
              {ms ? (
                <TaskCheckbox done={Boolean(ms.done_at)} label={`${label}: zrobione`} onToggle={() => toggleDone(ms)} />
              ) : (
                <span className="size-[22px] shrink-0 rounded-full border-2 border-dashed border-line" aria-hidden="true" />
              )}
              <label htmlFor={`ms-${kind}`} className={cx("w-24 shrink-0 text-sm", ms?.done_at && "text-ink-3 line-through")}>
                {label}
              </label>
              <Input id={`ms-${kind}`} type="date" className="h-9" value={ms ? dateKey(new Date(ms.due_at)) : ""} onChange={(e) => setDate(kind, e.target.value)} />
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-ink-3">Terminy pojawiają się w kalendarzu na warstwie klienta.</p>
    </Section>
  );
}

// ─── Publikacje ─────────────────────────────────────────────

function PublicationsSection({
  contentId,
  initial,
  onError,
  onPlatforms,
}: {
  contentId: string;
  initial: Publication[];
  onError: (m: string) => void;
  onPlatforms: (list: Platform[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItemsState] = useState([...initial].sort((a, b) => a.publish_at.localeCompare(b.publish_at)));
  // Każda zmiana listy aktualizuje platformy używane w poleceniach ChatGPT.
  const setItems = (fn: (xs: Publication[]) => Publication[]) =>
    setItemsState((xs) => {
      const next = fn(xs);
      onPlatforms(next.map((p) => p.platform));
      return next;
    });

  const add = async () => {
    const used = new Set(items.map((p) => p.platform));
    const platform = PLATFORM_LIST.find((p) => !used.has(p.key))?.key ?? "instagram";
    const at = items.at(-1) ? new Date(items.at(-1)!.publish_at) : (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      return d;
    })();
    const { data, error } = await supabase
      .from("content_publications")
      .insert({ content_id: contentId, platform, publish_at: at.toISOString() })
      .select("id, platform, publish_at, caption, hashtags, status")
      .single();
    if (error || !data) return onError("Nie udało się dodać publikacji.");
    setItems((xs) => [...xs, data as Publication]);
  };

  const update = async (id: string, p: Partial<Publication>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
    const { error } = await supabase.from("content_publications").update(p).eq("id", id);
    if (error) onError("Nie udało się zapisać publikacji.");
  };

  return (
    <Section
      title="Publikacje"
      aside={
        <button type="button" onClick={add} className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}>
          <Plus className="size-4" aria-hidden="true" />
          Dodaj
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-4 py-4 text-sm text-ink-2">
          Dodaj platformę i datę publikacji. Każda platforma może mieć inny termin i opis.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((p) => (
            <li key={p.id} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Platforma"
                  className={cx(inputClass, "h-9 w-auto")}
                  value={p.platform}
                  onChange={(e) => update(p.id, { platform: e.target.value as Platform })}
                >
                  {PLATFORM_LIST.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="datetime-local"
                  aria-label="Data publikacji"
                  className="h-9 w-auto min-w-0 flex-1"
                  value={toLocalInput(p.publish_at)}
                  onChange={(e) => e.target.value && update(p.id, { publish_at: new Date(e.target.value).toISOString() })}
                />
                <button
                  type="button"
                  aria-label="Usuń publikację"
                  onClick={async () => {
                    setItems((xs) => xs.filter((x) => x.id !== p.id));
                    await supabase.from("content_publications").delete().eq("id", p.id);
                  }}
                  className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              <BlurTextarea
                label="Opis posta"
                value={p.caption ?? ""}
                placeholder="Opis posta"
                onSave={(caption) => update(p.id, { caption: caption || null })}
              />
              <BlurInput
                label="Hashtagi"
                value={formatHashtags(p.hashtags)}
                placeholder="#hashtagi oddzielone spacją"
                onSave={(v) => update(p.id, { hashtags: parseHashtags(v) })}
              />
              <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--ink)]"
                  checked={p.status === "published"}
                  onChange={(e) => update(p.id, { status: e.target.checked ? "published" : "planned" })}
                />
                Opublikowano
              </label>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function BlurTextarea({ label, value, placeholder, onSave }: { label: string; value: string; placeholder: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Textarea
      aria-label={label}
      rows={3}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v.trim())}
      className="mt-2.5 min-h-20"
    />
  );
}

function BlurInput({ label, value, placeholder, onSave }: { label: string; value: string; placeholder: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Input
      aria-label={label}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      className="mt-2 h-9"
    />
  );
}

// ─── Linki do plików ────────────────────────────────────────

function LinksSection({
  contentId,
  workspaceId,
  initial,
  onError,
  extra,
  onInsertReady,
}: {
  contentId: string;
  workspaceId: string;
  initial: Attachment[];
  onError: (m: string) => void;
  /** Dodatkowe przyciski w nagłówku sekcji (np. Dysk Google); dostają funkcję dodającą link. */
  extra?: (insert: InsertLink) => ReactNode;
  /** Udostępnia funkcję dodawania linku innym sekcjom (np. eksport scenariusza do Docs). */
  onInsertReady?: (insert: InsertLink) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initial);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const insert: InsertLink = async (row) => {
    const { data, error } = await supabase
      .from("attachments")
      .insert({ workspace_id: workspaceId, entity_type: "content", entity_id: contentId, ...row })
      .select("id, name, url")
      .single();
    if (error || !data) return onError("Nie udało się dodać linku.");
    setItems((xs) => [...xs, data as Attachment]);
  };
  useEffect(() => {
    onInsertReady?.(insert);
  });

  const add = async () => {
    const u = normalizeUrl(url);
    if (!u) return onError("To nie wygląda na poprawny link.");
    await insert({ name: name.trim() || defaultLinkName(u), url: u });
    setUrl("");
    setName("");
  };

  return (
    <Section title="Pliki i linki" aside={extra?.(insert)}>
      {items.length > 0 ? (
        <ul className="mb-3 flex flex-col">
          {items.map((a) => (
            <li key={a.id}>
              <LinkRow
                url={a.url}
                name={a.name}
                trailing={
                  <button
                    type="button"
                    aria-label={`Usuń link: ${a.name}`}
                    onClick={async () => {
                      setItems((xs) => xs.filter((x) => x.id !== a.id));
                      await supabase.from("attachments").delete().eq("id", a.id);
                    }}
                    className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link do pliku, np. z Dysku Google" aria-label="Adres linku" inputMode="url" />
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa (opcjonalnie)" aria-label="Nazwa linku" />
          <Button type="submit" variant="secondary" className="shrink-0">
            Dodaj
          </Button>
        </div>
      </form>
    </Section>
  );
}
