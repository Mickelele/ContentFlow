"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cx } from "@/components/ui";

/** Szybkie dodawanie: wpisz i Enter. */
export function QuickAdd({
  onAdd,
  placeholder = "Dodaj zadanie i naciśnij Enter",
  className,
}: {
  onAdd: (title: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className={cx("flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 focus-within:border-solid focus-within:border-focus sm:px-4", className)}
      onSubmit={async (e) => {
        e.preventDefault();
        const title = value.trim();
        if (!title || busy) return;
        setBusy(true);
        setValue("");
        await onAdd(title);
        setBusy(false);
      }}
    >
      <Plus className="size-[22px] shrink-0 text-ink-3" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="done"
        className="h-12 min-w-0 flex-1 bg-transparent placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
      />
    </form>
  );
}
