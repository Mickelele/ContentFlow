"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, deleteEventPhoto, listEventPhotos, uploadEventPhotos, type EventPhoto } from "@/lib/event-photos";

/**
 * Zdjęcia wydarzenia. Istniejące wydarzenie: wysyłka od razu po wyborze plików.
 * Nowe wydarzenie: pliki czekają w `pending` i wysyła je kalendarz po zapisaniu wydarzenia.
 */
export function EventPhotos({
  eventId,
  workspaceId,
  pending,
  onPendingChange,
}: {
  eventId?: string;
  workspaceId: string | null;
  pending: File[];
  onPendingChange: (files: File[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    listEventPhotos(supabase, eventId).then((list) => alive && setPhotos(list));
    return () => {
      alive = false;
    };
  }, [eventId, supabase]);

  // Podgląd plików, które jeszcze nie są wysłane.
  const previews = useMemo(() => pending.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [pending]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const count = photos.length + pending.length;

  const pick = async (list: FileList | null) => {
    setError(null);
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, MAX_PHOTOS - count));
    if (input.current) input.current.value = "";
    if (!files.length) return;
    if (!eventId) return onPendingChange([...pending, ...files]);
    if (!workspaceId) return;
    setBusy(true);
    const failed = await uploadEventPhotos(supabase, workspaceId, eventId, files, photos.length);
    setPhotos(await listEventPhotos(supabase, eventId));
    setBusy(false);
    if (failed) setError(failed === files.length ? "Nie udało się dodać zdjęć." : `Nie udało się dodać ${failed} z ${files.length} zdjęć.`);
  };

  const remove = async (p: EventPhoto) => {
    setPhotos((xs) => xs.filter((x) => x.id !== p.id));
    if (!(await deleteEventPhoto(supabase, p))) {
      setError("Nie udało się usunąć zdjęcia.");
      setPhotos(await listEventPhotos(supabase, eventId!));
    }
  };

  const tile = "group relative aspect-square overflow-hidden rounded-xl bg-surface-2";
  const removeBtn =
    "absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full bg-black/55 text-white opacity-100 hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

  return (
    <section aria-label="Zdjęcia">
      <h3 className="text-sm font-medium">
        Zdjęcia
        {count ? <span className="tabular ml-2 font-normal text-ink-3">{count}</span> : null}
      </h3>
      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <li key={p.id} className={tile}>
            <a href={p.url} target="_blank" rel="noreferrer" aria-label="Otwórz zdjęcie w pełnym rozmiarze">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
            </a>
            <button type="button" onClick={() => remove(p)} aria-label="Usuń zdjęcie" className={removeBtn}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {previews.map((p, i) => (
          <li key={p.url} className={tile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="size-full object-cover" />
            <button type="button" onClick={() => onPendingChange(pending.filter((_, n) => n !== i))} aria-label="Usuń zdjęcie" className={removeBtn}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {count < MAX_PHOTOS ? (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-xs text-ink-2 hover:bg-surface-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
              {busy ? "Wysyłam…" : "Dodaj"}
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      {!eventId && pending.length ? <p className="mt-1.5 text-xs text-ink-3">Zdjęcia zapiszą się razem z wydarzeniem.</p> : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
