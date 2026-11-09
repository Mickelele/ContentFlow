"use client";

import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, MessageCircleQuestion, RotateCcw, Square, X } from "lucide-react";
import { cx } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Jak wysłać materiał do akceptacji klienta?",
  "Jak zaimportować wydarzenia z Google Calendar?",
  "Jak włączyć powiadomienia na iPhonie?",
  "Jak podłączyć Slacka?",
];

/** Ostatnie 19 wiadomości (serwer przyjmuje 20), zaczynając od pytania użytkownika. */
function lastTurns(all: Msg[]) {
  const tail = all.slice(-19);
  return tail[0]?.role === "assistant" ? tail.slice(1) : tail;
}

/** Przycisk „Pomocnik” + panel czatu. Stan rozmowy żyje, dopóki otwarta jest aplikacja. */
export function AssistantButton({ variant }: { variant: "side" | "icon" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "side" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <MessageCircleQuestion className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          Pomocnik
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Pomocnik"
          className="pressable rounded-full p-2 text-ink-2 active:bg-surface-2"
        >
          <MessageCircleQuestion className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
      <AssistantPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      inputRef.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Przewijaj do najnowszej odpowiedzi, także w trakcie pisania.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q.slice(0, 2000) }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const append = (chunk: string) =>
      setMessages((m) => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
        return copy;
      });
    try {
      const res = await fetch("/api/pomocnik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: lastTurns(next), path: pathname }),
        signal: controller.signal,
      });
      if (!res.body) {
        append(await res.text());
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          append(decoder.decode(value, { stream: true }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") append("Nie udało się połączyć z Pomocnikiem. Sprawdź internet i spróbuj ponownie.");
    } finally {
      abortRef.current = null;
      setBusy(false);
      // Pusta odpowiedź (np. przerwana od razu) nie powinna zostać w historii.
      setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content ? m.slice(0, -2) : m));
      inputRef.current?.focus();
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Pomocnik"
      className={cx(
        "bg-surface p-0 text-ink backdrop:bg-black/30",
        "transition-[translate] duration-300 ease-[var(--ease-drawer)]",
        "m-0 mt-auto h-[88dvh] max-h-none w-full max-w-none rounded-t-2xl starting:translate-y-full",
        "sm:mt-0 sm:ml-auto sm:h-dvh sm:w-[420px] sm:rounded-none sm:border-l sm:border-line sm:starting:translate-x-full sm:starting:translate-y-0",
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <MessageCircleQuestion className="size-5 text-ink-2" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Pomocnik</h2>
            <p className="text-xs text-ink-3">Podpowie, jak coś zrobić w ContentFlow</p>
          </div>
          {messages.length ? (
            <button type="button" onClick={reset} className="pressable inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
              <RotateCcw className="size-4" aria-hidden="true" />
              Nowa rozmowa
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Zamknij" className="rounded-full p-2 text-ink-3 hover:bg-surface-2">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="mb-1 text-sm text-ink-2">Zapytaj o dowolną funkcję aplikacji. Na przykład:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="pressable rounded-xl border border-line px-3 py-2.5 text-left text-sm hover:bg-surface-2"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <ol className="flex flex-col gap-4">
              {messages.map((m, i) => (
                <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                  {m.role === "user" ? (
                    <p className="max-w-[85%] rounded-2xl bg-surface-3 px-3.5 py-2 text-[15px] whitespace-pre-wrap">{m.content}</p>
                  ) : m.content ? (
                    <div className="text-[15px] leading-relaxed">
                      <Rich text={m.content} />
                    </div>
                  ) : (
                    <p className="text-sm text-ink-3">Piszę odpowiedź…</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-1.5 focus-within:border-ink-3">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Jak mogę…?"
              aria-label="Twoje pytanie"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none [field-sizing:content] sm:text-[15px]"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Zatrzymaj"
                className="pressable inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink"
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Wyślij"
                className="pressable inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="mt-2 px-1 text-[11px] text-ink-3">Odpowiedzi tworzy AI na podstawie przewodnika po aplikacji i mogą zawierać błędy.</p>
        </form>
      </div>
    </dialog>
  );
}

/** Minimalny Markdown: akapity, listy i **pogrubienia**. Tekst wstawiany jako węzły, bez HTML. */
function Rich({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cx("my-2 flex flex-col gap-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((it, i) => (
          <li key={i} className="pl-1">
            <Inline text={it} />
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (ordered || bullet) {
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flush();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push((ordered ?? bullet)![1]);
      continue;
    }
    flush();
    if (line) {
      blocks.push(
        <p key={blocks.length} className="my-2 first:mt-0">
          <Inline text={line.replace(/^#+\s*/, "")} />
        </p>,
      );
    }
  }
  flush();
  return <>{blocks}</>;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
