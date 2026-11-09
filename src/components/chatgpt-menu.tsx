"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Sparkles } from "lucide-react";
import { buttonClass, cx } from "@/components/ui";
import { chatGptUrl, type PromptItem } from "@/lib/prompts";

/**
 * „ChatGPT”: lista gotowych poleceń. Kliknięcie otwiera chatgpt.com z wpisanym poleceniem,
 * ikona obok kopiuje je do schowka (gdy wolisz wkleić gdzie indziej).
 */
export function ChatGptMenu({ items, className, align = "right" }: { items: () => PromptItem[]; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const list = open ? items() : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cx("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={buttonClass("secondary", "h-9 px-3")}
      >
        <Sparkles className="size-4" aria-hidden="true" />
        ChatGPT
        <ChevronDown className="size-3.5 text-ink-3" aria-hidden="true" />
      </button>
      <div
        id={id}
        hidden={!open}
        className={cx(
          "absolute top-full z-50 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-1.5",
          "shadow-[0_16px_40px_-12px_rgb(0_0_0/0.3),0_2px_6px_rgb(0_0_0/0.06)]",
          "transition-[opacity,scale] duration-150 ease-[var(--ease-out)] starting:scale-95 starting:opacity-0",
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
        )}
      >
        <p className="px-2.5 pt-1.5 pb-1 text-xs text-ink-3">Otwiera ChatGPT z gotowym poleceniem</p>
        <ul>
          {list.map((p) => (
            <li key={p.key} className="flex items-center gap-1">
              <a
                href={chatGptUrl(p.prompt)}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="block truncate text-[13px] text-ink-3">{p.hint}</span>
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              </a>
              <button
                type="button"
                aria-label={`Kopiuj polecenie: ${p.label}`}
                title="Kopiuj polecenie"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(p.prompt);
                    setCopied(p.key);
                    setTimeout(() => setCopied((c) => (c === p.key ? null : c)), 1500);
                  } catch {}
                }}
                className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                {copied === p.key ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
