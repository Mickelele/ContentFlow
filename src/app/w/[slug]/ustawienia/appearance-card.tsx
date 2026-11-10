"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { cx } from "@/components/ui";
import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_STYLE,
  STYLES,
  readAccent,
  readStyle,
  setAccent,
  setStyle,
  subscribeAppearance,
  type StyleKey,
} from "@/lib/appearance";

/** Miniatura wariantu: tło, pasek akcentu, nagłówek szeryfowy i karta — w kolorach tego wariantu. */
function Preview({ style }: { style: StyleKey }) {
  return (
    <div data-preview="" data-style={style} className="pointer-events-none overflow-hidden rounded-lg border border-line" aria-hidden="true">
      <div className="flex flex-col gap-1.5 p-2.5" style={{ background: "var(--bg)" }}>
        <div className="h-3.5 w-2/3 rounded-sm" style={{ background: "var(--band)" }} />
        <p className="font-display text-sm leading-none text-ink">Plan tygodnia</p>
        <div className="flex gap-1.5">
          <div className="h-8 flex-1 rounded-md border" style={{ background: "var(--surface)", borderColor: "var(--line)" }} />
          <div className="h-8 flex-1 rounded-md" style={{ background: "var(--surface-2)" }} />
        </div>
        <div className="h-2.5 w-1/3 rounded-full" style={{ background: "var(--primary)" }} />
      </div>
    </div>
  );
}

export function AppearanceCard() {
  const style = useSyncExternalStore(subscribeAppearance, readStyle, () => DEFAULT_STYLE);
  const accent = useSyncExternalStore(subscribeAppearance, readAccent, () => DEFAULT_ACCENT);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label="Wygląd">
      <h2 className="text-lg">Wygląd</h2>
      <p className="mt-0.5 text-sm text-ink-2">Styl i kolor zapamiętują się na tym urządzeniu. Kolory klientów się nie zmieniają.</p>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Styl</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={style === s.key}
              onClick={() => setStyle(s.key)}
              className={cx(
                "pressable flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors",
                style === s.key ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
              )}
            >
              <Preview style={s.key} />
              <span className="px-1 text-sm font-medium">{s.label}</span>
              <span className="px-1 pb-1 text-xs text-ink-3">{s.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Kolor</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={accent === a.key}
              aria-label={a.label}
              title={a.label}
              onClick={() => setAccent(a.key)}
              className={cx(
                "pressable inline-flex h-9 items-center gap-2 rounded-full border pr-3 pl-1.5 text-sm",
                accent === a.key ? "border-ink" : "border-line hover:border-line-strong",
              )}
            >
              <span className="inline-flex size-6 items-center justify-center rounded-full text-white" style={{ background: a.swatch }}>
                {accent === a.key ? <Check className="size-3.5" aria-hidden="true" /> : null}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <p className="text-sm font-medium">Tryb</p>
        <div className="mt-2 inline-flex rounded-lg border border-line-strong">
          <ThemeToggle />
        </div>
      </div>
    </section>
  );
}
