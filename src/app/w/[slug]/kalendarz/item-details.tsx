"use client";

import Link from "next/link";
import { Dialog } from "@/components/dialog";
import { buttonClass } from "@/components/ui";
import { CATEGORIES, PLATFORMS, formatRange, type CalendarItem, type Layer } from "@/lib/calendar";
import { colorVars } from "@/lib/palette";

const SOURCE_LABEL: Record<CalendarItem["source_type"], string> = {
  event: "Wydarzenie",
  task: "Termin zadania",
  milestone: "Termin produkcji",
  publication: "Publikacja",
};

/** Szczegóły terminu pochodzącego z zadania lub materiału (edycja w ich modułach — Etap 3 i 4). */
export function ItemDetails({
  item,
  layer,
  workspaceSlug,
  onClose,
}: {
  item: CalendarItem | null;
  layer?: Layer;
  workspaceSlug?: string;
  onClose: () => void;
}) {
  const start = item ? new Date(item.starts_at) : null;
  const c = layer ? colorVars(layer.color) : null;
  const Icon = item ? (CATEGORIES[item.category]?.icon ?? CATEGORIES.other.icon) : null;

  return (
    <Dialog open={Boolean(item)} onClose={onClose} title={item ? SOURCE_LABEL[item.source_type] : ""} size="sm">
      {item && start ? (
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex items-start gap-3">
            {Icon && c ? (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: c.fill, color: c.ink }}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-lg font-semibold">{item.title}</p>
              <p className="text-sm text-ink-2 first-letter:uppercase">
                {item.all_day ? formatRange(start, new Date(start.getTime() + 864e5), true) : formatRange(start, start, false).replace(/–.*$/, "")}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-3">Kategoria</dt>
            <dd>{CATEGORIES[item.category]?.label}</dd>
            {layer ? (
              <>
                <dt className="text-ink-3">Warstwa</dt>
                <dd>{layer.name}</dd>
              </>
            ) : null}
            {item.platform ? (
              <>
                <dt className="text-ink-3">Platforma</dt>
                <dd>{PLATFORMS[item.platform] ?? item.platform}</dd>
              </>
            ) : null}
          </dl>
          {item.description ? <p className="text-sm whitespace-pre-line text-ink-2">{item.description}</p> : null}
          {item.source_type === "task" && workspaceSlug ? (
            <Link href={`/w/${workspaceSlug}/zadania?zadanie=${item.source_id}`} className={buttonClass("primary", "self-start")}>
              Otwórz zadanie
            </Link>
          ) : item.content_id && workspaceSlug ? (
            <Link href={`/w/${workspaceSlug}/content/${item.content_id}`} className={buttonClass("primary", "self-start")}>
              Otwórz materiał
            </Link>
          ) : null}
          <p className="text-sm text-ink-3">Termin przesuniesz, przeciągając go w kalendarzu.</p>
        </div>
      ) : null}
    </Dialog>
  );
}
