"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/components/ui";

/**
 * Okno dialogowe: na komputerze wyśrodkowane, na telefonie arkusz od dołu.
 * Natywny <dialog> — fokus, Esc i blokada tła działają bez dodatkowego kodu.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
  /** Na telefonie wysuwany z lewej (np. panel warstw) zamiast od dołu. */
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal ustawia fokus na pierwszym przycisku (zamknij); przenieś go na wskazane pole.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cx(
        "bg-surface p-0 text-ink backdrop:bg-black/40",
        "transition-[translate,opacity,scale] duration-300 ease-[var(--ease-drawer)]",
        side
          ? "m-0 h-dvh max-h-none w-[min(320px,86vw)] starting:-translate-x-full"
          : cx(
              "m-0 mt-auto w-full max-w-none rounded-t-2xl starting:translate-y-full",
              "sm:m-auto sm:max-h-[min(860px,92dvh)] sm:rounded-2xl sm:starting:translate-y-0 sm:starting:scale-[0.97] sm:starting:opacity-0",
              size === "sm" ? "sm:w-[420px]" : "sm:w-[560px]",
            ),
        "shadow-[0_24px_64px_-12px_rgb(0_0_0/0.35)]",
      )}
    >
      <div className={cx("flex max-h-[inherit] flex-col", side ? "h-full" : "max-h-[92dvh] sm:max-h-[inherit]")}>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2 sm:px-6 sm:pt-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="pressable -mr-2 rounded-full p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
