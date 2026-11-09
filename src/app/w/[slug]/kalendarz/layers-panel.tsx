"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { WorkspaceBadge } from "@/components/shell/workspace-switcher";
import { Button, Input, cx } from "@/components/ui";
import { CATEGORIES, CATEGORY_KEYS, type Category, type Layer, type WorkspaceLayers } from "@/lib/calendar";
import { CLIENT_COLORS, colorVars, type ClientColor } from "@/lib/palette";

export function LayerCheckbox({ layer, onToggle }: { layer: Layer; onToggle: (l: Layer) => void }) {
  const c = colorVars(layer.color);
  return (
    <label className="group flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-2">
      <input type="checkbox" className="peer sr-only" checked={layer.visible} onChange={() => onToggle(layer)} />
      <span
        aria-hidden="true"
        className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
        style={{ borderColor: c.solid, background: layer.visible ? c.solid : "transparent" }}
      >
        {layer.visible ? <Check className="size-3 text-white" strokeWidth={3.5} /> : null}
      </span>
      <span className={cx("min-w-0 flex-1 truncate", !layer.visible && "text-ink-3")}>{layer.name}</span>
    </label>
  );
}

function NewLayerForm({ onCreate, onCancel }: { onCreate: (name: string, color: ClientColor) => Promise<string | null>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<ClientColor>("teal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-1 flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Wpisz nazwę warstwy.");
        setBusy(true);
        const err = await onCreate(name.trim(), color);
        setBusy(false);
        if (err) setError(err);
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        placeholder="np. Urlopy, Deadline"
        aria-label="Nazwa warstwy"
        aria-invalid={Boolean(error)}
        className="h-9"
      />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kolor warstwy">
        {CLIENT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={color === c.key}
            aria-label={c.label}
            onClick={() => setColor(c.key)}
            className={cx("pressable size-6 rounded-full ring-offset-2 ring-offset-surface-2", color === c.key && "ring-2 ring-ink")}
            style={{ background: colorVars(c.key).solid }}
          />
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" className="h-8 px-3" onClick={onCancel}>
          Anuluj
        </Button>
        <Button type="submit" variant="primary" className="h-8 px-3" disabled={busy}>
          Dodaj
        </Button>
      </div>
    </form>
  );
}

export function LayersPanel({
  groups,
  onToggle,
  onCreateLayer,
  categories,
  onToggleCategory,
}: {
  groups: WorkspaceLayers[];
  onToggle: (l: Layer) => void;
  onCreateLayer: (workspaceId: string, name: string, color: ClientColor) => Promise<string | null>;
  categories: Set<Category>;
  onToggleCategory: (c: Category) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => {
        const clients = g.layers.filter((l) => l.kind === "client");
        const other = g.layers.filter((l) => l.kind !== "client");
        return (
          <section key={g.id} aria-label={`Warstwy: ${g.name}`}>
            <div className="mb-1 flex items-center gap-2 px-2">
              <WorkspaceBadge ws={g} size={22} />
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{g.name}</h3>
            </div>
            {clients.map((l) => (
              <LayerCheckbox key={l.id} layer={l} onToggle={onToggle} />
            ))}
            {clients.length === 0 ? (
              <Link href={`/w/${g.slug}/klienci/nowy`} className="flex h-9 items-center px-2 text-sm text-ink-3 hover:text-ink">
                Dodaj pierwszego klienta
              </Link>
            ) : null}
            {other.map((l) => (
              <LayerCheckbox key={l.id} layer={l} onToggle={onToggle} />
            ))}
            {adding === g.id ? (
              <NewLayerForm
                onCancel={() => setAdding(null)}
                onCreate={async (name, color) => {
                  const err = await onCreateLayer(g.id, name, color);
                  if (!err) setAdding(null);
                  return err;
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(g.id)}
                className="flex h-9 w-full items-center gap-3 rounded-lg px-2 text-sm text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <Plus className="size-[18px]" aria-hidden="true" />
                Nowa warstwa
              </button>
            )}
          </section>
        );
      })}

      <section aria-label="Kategorie">
        <h3 className="mb-2 px-2 text-sm font-semibold">Kategorie</h3>
        <div className="flex flex-wrap gap-1.5 px-1">
          {CATEGORY_KEYS.map((key) => {
            const { label, icon: Icon } = CATEGORIES[key];
            const on = categories.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleCategory(key)}
                className={cx(
                  "pressable inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm",
                  on ? "border-line-strong bg-surface text-ink" : "border-dashed border-line-strong text-ink-3 line-through decoration-ink-3/60",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
