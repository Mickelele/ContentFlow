"use client";

import { useEffect, useMemo, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, Input, buttonClass, cx } from "@/components/ui";
import type { Editor, JSONContent } from "@/components/editor/rich-text";
import { createClient } from "@/lib/supabase/client";

/*
 * Wersje scenariusza (CON-12): migawki dokumentu z nazwą i datą.
 * „Przywróć” najpierw zapisuje bieżący tekst jako wersję, więc niczego nie da się stracić.
 */

type Version = { id: string; label: string | null; body: JSONContent; body_text: string; created_at: string };
const dtFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export async function saveScriptVersion(contentId: string, editor: Editor, label: string | null) {
  const { data, error } = await createClient()
    .from("script_versions")
    .insert({ content_id: contentId, label, body: editor.getJSON(), body_text: editor.getText({ blockSeparator: "\n" }).slice(0, 20000) })
    .select("id")
    .single();
  return error ? null : (data.id as string);
}

export function ScriptVersionsButton({ contentId, getEditor, onError }: { contentId: string; getEditor: () => Editor | null; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
        className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}
      >
        <History className="size-4" aria-hidden="true" />
        Wersje
      </button>
      {open ? <VersionsDialog key={key} contentId={contentId} getEditor={getEditor} onError={onError} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VersionsDialog({
  contentId,
  getEditor,
  onError,
  onClose,
}: {
  contentId: string;
  getEditor: () => Editor | null;
  onError: (m: string) => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("script_versions")
      .select("id, label, body, body_text, created_at")
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => alive && setVersions((data ?? []) as Version[]));
    return () => {
      alive = false;
    };
  }, [supabase, contentId]);

  const save = async () => {
    const ed = getEditor();
    if (!ed) return;
    setBusy(true);
    const id = await saveScriptVersion(contentId, ed, label.trim() || null);
    setBusy(false);
    if (!id) return onError("Nie udało się zapisać wersji.");
    setVersions((vs) => [
      { id, label: label.trim() || null, body: ed.getJSON(), body_text: ed.getText({ blockSeparator: "\n" }), created_at: new Date().toISOString() },
      ...(vs ?? []),
    ]);
    setLabel("");
  };

  const restore = async (v: Version) => {
    const ed = getEditor();
    if (!ed) return;
    setBusy(true);
    // Bieżący tekst trafia do historii, zanim go zastąpimy.
    await saveScriptVersion(contentId, ed, `Przed przywróceniem (${dtFmt.format(new Date())})`);
    ed.commands.setContent(v.body, { emitUpdate: true });
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title="Wersje scenariusza">
      <div className="flex flex-col gap-5 pt-1">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nazwa wersji, np. „po uwagach klienta”" aria-label="Nazwa wersji" />
          <Button type="submit" variant="primary" disabled={busy} className="shrink-0">
            Zapisz wersję
          </Button>
        </form>

        {versions === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie" />
        ) : versions.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">
            Brak zapisanych wersji. Zapisz bieżący scenariusz, zanim zaczniesz duże zmiany. Wysłanie do akceptacji klienta też zapisuje wersję.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {versions.map((v) => (
              <li key={v.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.label || "Wersja bez nazwy"}</p>
                    <p className="tabular text-[13px] text-ink-3">{dtFmt.format(new Date(v.created_at))}</p>
                  </div>
                  <button
                    type="button"
                    aria-expanded={preview === v.id}
                    onClick={() => setPreview(preview === v.id ? null : v.id)}
                    className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}
                  >
                    {preview === v.id ? "Zwiń" : "Podgląd"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => restore(v)} className={buttonClass("secondary", "h-8 px-2.5 text-[13px]")}>
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Przywróć
                  </button>
                </div>
                {preview === v.id ? (
                  <p className={cx("mt-3 max-h-64 overflow-y-auto rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-line text-ink-2")}>
                    {v.body_text || "Pusty scenariusz"}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
