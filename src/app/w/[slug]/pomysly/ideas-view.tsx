"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, Search, Sparkles } from "lucide-react";
import { ChatGptMenu } from "@/components/chatgpt-menu";
import { LinkIcon } from "@/components/link-chip";
import { ideaPrompts } from "@/lib/prompts";
import { linkInfo } from "@/lib/links";
import { Dialog } from "@/components/dialog";
import { ClientChip } from "@/components/tasks/task-row";
import { QuickAdd } from "@/components/tasks/quick-add";
import { Button, Field, Input, Textarea, buttonClass, cx, inputClass } from "@/components/ui";
import { CONTENT_TYPES, type ContentType } from "@/lib/content";
import { createClient } from "@/lib/supabase/client";
import type { ClientRef, WorkspaceRef } from "@/lib/tasks";

type IdeaStatus = "new" | "converted" | "archived";
type Idea = {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  type: ContentType | null;
  tags: string[];
  client_id: string | null;
  status: IdeaStatus;
  content_id: string | null;
  created_at: string;
};
const SELECT = "id, title, description, link, type, tags, client_id, status, content_id, created_at";
const STATUS_TABS: { key: IdeaStatus; label: string }[] = [
  { key: "new", label: "Do realizacji" },
  { key: "converted", label: "Zrealizowane" },
  { key: "archived", label: "Archiwum" },
];

const parseTags = (v: string) => [...new Set(v.split(/[,#]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))];

export function IdeasView({ workspace, clients }: { workspace: WorkspaceRef; clients: ClientRef[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [status, setStatus] = useState<IdeaStatus>("new");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [client, setClient] = useState("");
  const [editing, setEditing] = useState<Idea | null>(null);
  const [key, setKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("ideas")
      .select(SELECT)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError("Nie udało się wczytać pomysłów.");
        setIdeas((data ?? []) as Idea[]);
      });
    return () => {
      alive = false;
    };
  }, [supabase, workspace.id]);

  const add = async (title: string) => {
    const { data, error } = await supabase
      .from("ideas")
      .insert({ workspace_id: workspace.id, title, client_id: client || null, tags: tag ? [tag] : [] })
      .select(SELECT)
      .single();
    if (error || !data) return setError("Nie udało się dodać pomysłu.");
    setIdeas((xs) => [data as Idea, ...(xs ?? [])]);
    setStatus("new");
  };

  const update = async (id: string, p: Partial<Idea>) => {
    setIdeas((xs) => xs?.map((x) => (x.id === id ? { ...x, ...p } : x)) ?? xs);
    const { error } = await supabase.from("ideas").update(p).eq("id", id);
    if (error) setError("Nie udało się zapisać pomysłu.");
  };

  // Pomysł → materiał: nowy materiał na etapie „Pomysł”, link do inspiracji trafia do jego plików.
  const convert = async (idea: Idea) => {
    const { data, error } = await supabase
      .from("content")
      .insert({
        workspace_id: workspace.id,
        title: idea.title,
        type: idea.type ?? "reel",
        client_id: idea.client_id,
        description: idea.description,
        stage: "idea",
      })
      .select("id")
      .single();
    if (error || !data) return setError("Nie udało się utworzyć materiału.");
    if (idea.link) {
      await supabase.from("attachments").insert({ workspace_id: workspace.id, entity_type: "content", entity_id: data.id, name: "Inspiracja", url: idea.link });
    }
    await supabase.from("ideas").update({ status: "converted", content_id: data.id }).eq("id", idea.id);
    router.push(`/w/${workspace.slug}/content/${data.id}`);
  };

  const all = ideas ?? [];
  const allTags = [...new Set(all.filter((i) => i.status === status).flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b, "pl"));
  const q = query.trim().toLowerCase();
  const visible = all.filter(
    (i) =>
      i.status === status &&
      (!tag || i.tags.includes(tag)) &&
      (!client || i.client_id === client) &&
      (!q || i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q))),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <QuickAdd onAdd={add} placeholder="Zapisz pomysł i naciśnij Enter" className="mb-5" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface-2 p-0.5" role="tablist" aria-label="Status pomysłów">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={status === t.key}
              onClick={() => (setStatus(t.key), setTag(null))}
              className={cx("h-8 rounded-md px-3 text-sm", status === t.key ? "bg-surface font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink")}
            >
              {t.label}
              <span className="tabular ml-1.5 text-xs text-ink-3">{all.filter((i) => i.status === t.key).length}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj" aria-label="Szukaj pomysłów" className="h-9 pl-9" />
        </div>
        {clients.length > 0 ? (
          <select aria-label="Filtruj według klienta" value={client} onChange={(e) => setClient(e.target.value)} className={cx(inputClass, "h-9 w-auto")}>
            <option value="">Wszyscy klienci</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {allTags.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-1.5" aria-label="Tagi">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cx(
                "pressable h-7 rounded-full border px-2.5 text-[13px]",
                tag === t ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:bg-surface-2",
              )}
            >
              #{t}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {ideas === null ? (
        <div className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-6 py-10 text-center text-ink-2">
          {all.length === 0 ? "Zapisz pierwszy pomysł polem powyżej. Link do inspiracji, tagi i klienta dodasz po kliknięciu." : "Nic tu nie ma."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {visible.map((i) => {
            const c = i.client_id ? clientById.get(i.client_id) : undefined;
            return (
              <li key={i.id} className="group flex items-start gap-3 px-4 py-3.5 hover:bg-surface-2 sm:px-5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setKey((k) => k + 1);
                    setEditing(i);
                  }}
                >
                  <span className="block font-medium">{i.title}</span>
                  {i.description ? <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">{i.description}</span> : null}
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
                    {i.type ? <span>{CONTENT_TYPES[i.type].label}</span> : null}
                    {c ? <ClientChip client={c} /> : null}
                    {i.tags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                    {i.link ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LinkIcon url={i.link} size={18} />
                        {linkInfo(i.link).service}
                      </span>
                    ) : null}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {i.status === "new" ? (
                    <>
                      <Button variant="secondary" className="h-8 px-2.5 text-[13px]" onClick={() => convert(i)}>
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        <span className="max-sm:sr-only">Zrób materiał</span>
                      </Button>
                      <button
                        type="button"
                        aria-label={`Archiwizuj: ${i.title}`}
                        title="Archiwizuj"
                        onClick={() => update(i.id, { status: "archived" })}
                        className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <Archive className="size-4" aria-hidden="true" />
                      </button>
                    </>
                  ) : i.status === "converted" && i.content_id ? (
                    <Link href={`/w/${workspace.slug}/content/${i.content_id}`} className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}>
                      Materiał
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : i.status === "archived" ? (
                    <button type="button" onClick={() => update(i.id, { status: "new" })} className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}>
                      Przywróć
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <IdeaDialog
        key={key}
        idea={editing}
        clients={clients}
        onClose={() => setEditing(null)}
        onSave={async (p) => {
          if (!editing) return;
          await update(editing.id, p);
          setEditing(null);
        }}
        onDelete={async () => {
          if (!editing) return;
          await supabase.from("ideas").delete().eq("id", editing.id);
          setIdeas((xs) => xs?.filter((x) => x.id !== editing.id) ?? xs);
          setEditing(null);
        }}
      />
    </div>
  );
}

function IdeaDialog({
  idea,
  clients,
  onClose,
  onSave,
  onDelete,
}: {
  idea: Idea | null;
  clients: ClientRef[];
  onClose: () => void;
  onSave: (p: Partial<Idea>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [f, setF] = useState({
    title: idea?.title ?? "",
    description: idea?.description ?? "",
    link: idea?.link ?? "",
    type: idea?.type ?? "",
    client_id: idea?.client_id ?? "",
    tags: idea?.tags.join(", ") ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const save = async () => {
    if (!f.title.trim()) return setError("Wpisz nazwę pomysłu.");
    let link = f.link.trim();
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    await onSave({
      title: f.title.trim(),
      description: f.description.trim() || null,
      link: link || null,
      type: (f.type || null) as ContentType | null,
      client_id: f.client_id || null,
      tags: parseTags(f.tags),
    });
  };

  return (
    <Dialog
      open={Boolean(idea)}
      onClose={onClose}
      title="Pomysł"
      size="sm"
      footer={
        <>
          <Button variant="danger" className="h-9 px-3" onClick={() => (confirm ? onDelete() : setConfirm(true))}>
            {confirm ? "Na pewno usunąć?" : "Usuń"}
          </Button>
          <ChatGptMenu
            align="left"
            items={() =>
              ideaPrompts({ title: f.title, description: f.description, client: clients.find((c) => c.id === f.client_id)?.name })
            }
          />
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" className="h-9 px-3" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" form="idea-form" variant="primary" className="h-9">
              Zapisz
            </Button>
          </div>
        </>
      }
    >
      <form
        id="idea-form"
        noValidate
        className="flex flex-col gap-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nazwa" htmlFor="idea-title" error={error ?? undefined}>
          <Input id="idea-title" value={f.title} onChange={(e) => (setF({ ...f, title: e.target.value }), setError(null))} />
        </Field>
        <Field label="Opis" htmlFor="idea-desc">
          <Textarea id="idea-desc" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="O czym, dla kogo, jaki hook…" />
        </Field>
        <Field label="Link do inspiracji" htmlFor="idea-link">
          <Input id="idea-link" inputMode="url" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://www.instagram.com/reel/…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rodzaj" htmlFor="idea-type">
            <select id="idea-type" className={inputClass} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="">Nie wiem jeszcze</option>
              {(Object.keys(CONTENT_TYPES) as ContentType[]).map((t) => (
                <option key={t} value={t}>
                  {CONTENT_TYPES[t].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Klient" htmlFor="idea-client">
            <select id="idea-client" className={inputClass} value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
              <option value="">Bez klienta</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Tagi" htmlFor="idea-tags" hint="Oddziel przecinkami, np. trend, kulisy, poradnik.">
          <Input id="idea-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} aria-describedby="idea-tags-hint" />
        </Field>
      </form>
    </Dialog>
  );
}
