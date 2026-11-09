"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Trash2, Video } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, Field, Input, Textarea, buttonClass, cx, inputClass } from "@/components/ui";
import {
  CATEGORIES,
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  addDays,
  eventDetailsText,
  findMeeting,
  fromDateInput,
  toDateInput,
  toLocalInput,
  type Category,
  type EventStatus,
  type WorkspaceLayers,
} from "@/lib/calendar";

export type EventDraft = {
  id?: string;
  title: string;
  calendarId: string;
  category: Category;
  status: EventStatus;
  allDay: boolean;
  start: Date;
  /** Koniec wyłączny: dla całodniowych północ dnia po ostatnim dniu. */
  end: Date;
  location: string;
  url: string;
  description: string;
};

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  };
  return { copied, copy };
}

export function EventEditor({
  draft,
  groups,
  onClose,
  onSave,
  onDelete,
}: {
  draft: EventDraft | null;
  groups: WorkspaceLayers[];
  onClose: () => void;
  onSave: (d: EventDraft) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [d, setD] = useState<EventDraft | null>(draft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { copied, copy } = useCopy();

  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));
  const meeting = d ? findMeeting(d.url, d.location, d.description) : null;

  const save = async () => {
    if (!d) return;
    if (!d.title.trim()) return setError("Wpisz nazwę wydarzenia.");
    if (d.end < d.start) return setError("Koniec nie może być przed początkiem.");
    setBusy(true);
    const err = await onSave({ ...d, title: d.title.trim() });
    setBusy(false);
    if (err) setError(err);
  };

  const remove = async () => {
    if (!d?.id) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const err = await onDelete(d.id);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Dialog
      open={Boolean(draft)}
      onClose={onClose}
      title={d?.id ? "Wydarzenie" : "Nowe wydarzenie"}
      footer={
        d ? (
          <>
            {d.id ? (
              <Button type="button" variant="danger" onClick={remove} disabled={busy} className="h-9 px-3">
                <Trash2 className="size-4" aria-hidden="true" />
                {confirmDelete ? "Na pewno usunąć?" : "Usuń"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3"
              onClick={() => copy("details", eventDetailsText({ ...d, url: meeting?.url ?? (d.url || null) }))}
            >
              {copied === "details" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied === "details" ? "Skopiowano" : "Kopiuj szczegóły"}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="h-9 px-3">
                Anuluj
              </Button>
              <Button type="submit" form="event-form" variant="primary" disabled={busy} className="h-9">
                {busy ? "Zapisuję…" : "Zapisz"}
              </Button>
            </div>
          </>
        ) : null
      }
    >
      {d ? (
        <form
          id="event-form"
          className="flex flex-col gap-5 pt-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Nazwa" htmlFor="ev-title">
            <Input
              id="ev-title"
              value={d.title}
              data-autofocus={!d.id ? "" : undefined}
              onChange={(e) => {
                set("title", e.target.value);
                setError(null);
              }}
              placeholder="Nagrania HELINAT"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Warstwa" htmlFor="ev-layer">
              <select id="ev-layer" className={inputClass} value={d.calendarId} onChange={(e) => set("calendarId", e.target.value)}>
                {groups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.layers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Kategoria" htmlFor="ev-cat">
              <select id="ev-cat" className={inputClass} value={d.category} onChange={(e) => set("category", e.target.value as Category)}>
                {EVENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIES[c].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Termin</legend>
            <label className="inline-flex cursor-pointer items-center gap-2.5 self-start text-sm">
              <input
                type="checkbox"
                checked={d.allDay}
                onChange={(e) => {
                  const allDay = e.target.checked;
                  setD((p) => {
                    if (!p) return p;
                    if (allDay) {
                      const start = fromDateInput(toDateInput(p.start));
                      const lastDay = fromDateInput(toDateInput(p.end > p.start ? new Date(p.end.getTime() - 1) : p.start));
                      return { ...p, allDay, start, end: addDays(lastDay, 1) };
                    }
                    const start = new Date(p.start);
                    start.setHours(9, 0, 0, 0);
                    return { ...p, allDay, start, end: new Date(start.getTime() + 60 * 60 * 1000) };
                  });
                }}
                className="size-4 accent-[var(--ink)]"
              />
              Cały dzień
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {d.allDay ? (
                <>
                  <Field label="Od" htmlFor="ev-start">
                    <Input
                      id="ev-start"
                      type="date"
                      value={toDateInput(d.start)}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const start = fromDateInput(e.target.value);
                        const days = Math.max(1, Math.round((d.end.getTime() - d.start.getTime()) / 864e5));
                        setD({ ...d, start, end: addDays(start, days) });
                      }}
                    />
                  </Field>
                  <Field label="Do" htmlFor="ev-end">
                    <Input
                      id="ev-end"
                      type="date"
                      min={toDateInput(d.start)}
                      value={toDateInput(addDays(d.end, -1))}
                      onChange={(e) => e.target.value && set("end", addDays(fromDateInput(e.target.value), 1))}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Początek" htmlFor="ev-start">
                    <Input
                      id="ev-start"
                      type="datetime-local"
                      value={toLocalInput(d.start)}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const start = new Date(e.target.value);
                        const length = d.end.getTime() - d.start.getTime();
                        setD({ ...d, start, end: new Date(start.getTime() + Math.max(length, 15 * 60 * 1000)) });
                      }}
                    />
                  </Field>
                  <Field label="Koniec" htmlFor="ev-end">
                    <Input
                      id="ev-end"
                      type="datetime-local"
                      min={toLocalInput(d.start)}
                      value={toLocalInput(d.end)}
                      onChange={(e) => e.target.value && set("end", new Date(e.target.value))}
                    />
                  </Field>
                </>
              )}
            </div>
          </fieldset>

          <Field label="Link do spotkania lub materiałów" htmlFor="ev-url">
            <Input
              id="ev-url"
              type="url"
              inputMode="url"
              value={d.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://meet.google.com/…"
            />
          </Field>
          {meeting ? (
            <div className="-mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
              <Video className="size-4 text-ink-2" aria-hidden="true" />
              <span className="mr-auto text-sm text-ink-2">{meeting.provider}</span>
              <button type="button" onClick={() => copy("link", meeting.url)} className={buttonClass("ghost", "h-8 px-2.5")}>
                {copied === "link" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied === "link" ? "Skopiowano" : "Kopiuj link"}
              </button>
              <a href={meeting.url} target="_blank" rel="noreferrer" className={buttonClass("primary", "h-8 px-3")}>
                Dołącz
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          ) : null}

          <Field label="Miejsce" htmlFor="ev-loc">
            <Input id="ev-loc" value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="Studio, ul. Prosta 12" />
          </Field>

          <Field label="Opis" htmlFor="ev-desc">
            <Textarea id="ev-desc" rows={3} value={d.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          {d.id ? (
            <fieldset>
              <legend className="text-sm font-medium">Status</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(EVENT_STATUSES) as EventStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={d.status === s}
                    onClick={() => set("status", s)}
                    className={cx(
                      "pressable h-8 rounded-full border px-3 text-sm",
                      d.status === s ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    {EVENT_STATUSES[s]}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </Dialog>
  );
}
