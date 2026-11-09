"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, Send, X } from "lucide-react";
import { Button, Textarea, buttonClass, cx } from "@/components/ui";
import type { Editor } from "@/components/editor/rich-text";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import { saveScriptVersion } from "./script-versions";

/*
 * Akceptacja przez klienta (CON-13): link bez logowania z migawką scenariusza.
 * Klient akceptuje albo prosi o poprawki; odpowiedź wraca tutaj, do dzwonka i jako push.
 */

type Request = {
  id: string;
  token: string;
  status: "pending" | "approved" | "changes_requested" | "cancelled";
  message: string | null;
  client_name: string | null;
  client_comment: string | null;
  created_at: string;
  responded_at: string | null;
  expires_at: string;
};

const STATUS: Record<Request["status"], { label: string; tone: string }> = {
  pending: { label: "Czeka na klienta", tone: "bg-surface-3 text-ink-2" },
  approved: { label: "Zaakceptowane", tone: "bg-[var(--c-green-fill)] text-[var(--c-green-ink)]" },
  changes_requested: { label: "Poprawki", tone: "bg-[var(--c-amber-fill)] text-[var(--c-amber-ink)]" },
  cancelled: { label: "Wycofane", tone: "bg-surface-3 text-ink-3" },
};
const dtFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ApprovalSection({
  contentId,
  title,
  clientEmail,
  getEditor,
  onSent,
  onError,
}: {
  contentId: string;
  title: string;
  clientEmail: string | null;
  getEditor: () => Editor | null;
  onSent: () => void;
  onError: (m: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Request[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("approval_requests")
      .select("id, token, status, message, client_name, client_comment, created_at, responded_at, expires_at")
      .eq("content_id", contentId)
      .order("created_at", { ascending: false });
    return (data ?? []) as Request[];
  }, [supabase, contentId]);

  useEffect(() => {
    let alive = true;
    fetchItems().then((x) => alive && setItems(x));
    return () => {
      alive = false;
    };
  }, [fetchItems]);
  useRealtime(`approvals-${contentId}`, ["approval_requests"], () => fetchItems().then(setItems));

  const linkFor = (token: string) => `${location.origin}/akceptacja/${token}`;
  const copy = async (r: Request) => {
    try {
      await navigator.clipboard.writeText(linkFor(r.token));
      setCopied(r.id);
      setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 1500);
    } catch {}
  };

  const send = async () => {
    const ed = getEditor();
    setBusy(true);
    const versionId = ed ? await saveScriptVersion(contentId, ed, "Wysłane do akceptacji") : null;
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({ content_id: contentId, script_version_id: versionId, message: message.trim() || null })
      .select("id, token, status, message, client_name, client_comment, created_at, responded_at, expires_at")
      .single();
    setBusy(false);
    if (error || !data) return onError("Nie udało się utworzyć prośby o akceptację.");
    setItems((xs) => [data as Request, ...(xs ?? [])]);
    setComposing(false);
    setMessage("");
    onSent();
    copy(data as Request);
  };

  const cancel = async (r: Request) => {
    setItems((xs) => xs?.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x)) ?? xs);
    await supabase.from("approval_requests").update({ status: "cancelled" }).eq("id", r.id);
  };

  const mailto = (r: Request) =>
    `mailto:${clientEmail ?? ""}?subject=${encodeURIComponent(`Do akceptacji: ${title}`)}&body=${encodeURIComponent(
      `Dzień dobry,\n\nprzesyłam materiał „${title}” do akceptacji:\n${linkFor(r.token)}\n\nW linku można zaakceptować albo poprosić o poprawki.\n`,
    )}`;

  return (
    <section aria-label="Akceptacja klienta">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Akceptacja klienta</h2>
        {!composing ? (
          <button type="button" onClick={() => setComposing(true)} className={buttonClass("ghost", "h-8 px-2.5 text-[13px]")}>
            <Send className="size-4" aria-hidden="true" />
            Wyślij
          </button>
        ) : null}
      </div>

      {composing ? (
        <form
          className="mb-3 flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Wiadomość dla klienta (opcjonalnie)" aria-label="Wiadomość dla klienta" />
          <p className="text-[13px] text-ink-3">Klient dostanie link bez logowania: scenariusz (zapisany jako wersja), publikacje i pliki. Link działa 30 dni.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setComposing(false)}>
              Anuluj
            </Button>
            <Button type="submit" variant="primary" className="h-9" disabled={busy}>
              {busy ? "Tworzę…" : "Utwórz link"}
            </Button>
          </div>
        </form>
      ) : null}

      {items === null ? null : items.length === 0 && !composing ? (
        <p className="rounded-xl bg-surface-2 px-4 py-4 text-sm text-ink-2">Wyślij klientowi link, żeby zaakceptował materiał albo poprosił o poprawki — bez zakładania konta.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((r) => {
            const expired = r.status === "pending" && new Date(r.expires_at) < new Date();
            const s = STATUS[r.status];
            return (
              <li key={r.id} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx("rounded-full px-2.5 py-0.5 text-[13px] font-medium", s.tone)}>{expired ? "Wygasło" : s.label}</span>
                  <span className="tabular text-[13px] text-ink-3">
                    {dtFmt.format(new Date(r.responded_at ?? r.created_at))}
                    {r.client_name ? ` · ${r.client_name}` : ""}
                  </span>
                  {r.status === "pending" && !expired ? (
                    <span className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={() => copy(r)} className={buttonClass("ghost", "h-8 px-2 text-[13px]")} aria-label="Kopiuj link do akceptacji">
                        {copied === r.id ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                        {copied === r.id ? "Skopiowano" : "Link"}
                      </button>
                      <a href={mailto(r)} className={buttonClass("ghost", "h-8 px-2 text-[13px]")} aria-label="Wyślij link e-mailem">
                        <Mail className="size-4" aria-hidden="true" />
                      </a>
                      <button type="button" onClick={() => cancel(r)} className={buttonClass("ghost", "h-8 px-2 text-[13px]")} aria-label="Wycofaj prośbę">
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </span>
                  ) : null}
                </div>
                {r.client_comment ? <p className="mt-2 text-sm whitespace-pre-line">{r.client_comment}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
