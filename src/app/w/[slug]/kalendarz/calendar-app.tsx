"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl";
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, Layers, Plus, Video } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, cx } from "@/components/ui";
import { eventPhotoPaths, removePhotoFiles, uploadEventPhotos } from "@/lib/event-photos";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  NEW_EVENT,
  PLATFORMS,
  addDays,
  findMeeting,
  type CalendarItem,
  type Category,
  type Layer,
  type WorkspaceLayers,
} from "@/lib/calendar";
import { colorVars, type ClientColor } from "@/lib/palette";
import type { ProjectRef } from "@/lib/tasks";
import { EventEditor, type EventDraft } from "./event-editor";
import { GoogleCalendarDialog, GoogleCalendarMenu } from "./google-dialog";
import { ItemDetails } from "./item-details";
import { LayersPanel } from "./layers-panel";
import "./calendar.css";

type ViewName = "timeGridDay" | "timeGrid3" | "timeGridWeek" | "dayGridMonth";
const CATEGORY_STORAGE = "cf-cal-categories";
const VIEW_STORAGE = "cf-cal-view";

const mobileQuery = () => matchMedia("(max-width: 767px)");
const subscribeMobile = (cb: () => void) => {
  const mq = mobileQuery();
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Pusty szkic wydarzenia: domyślnie najbliższa pełna godzina, pierwsza widoczna warstwa klienta. */
function blankDraft(
  groups: WorkspaceLayers[],
  currentWorkspaceId: string,
  at?: { start: Date; end: Date; allDay: boolean },
): EventDraft {
  const g = groups.find((x) => x.id === currentWorkspaceId) ?? groups[0];
  const visible = g?.layers.filter((l) => l.visible) ?? [];
  const calendarId = (visible.find((l) => l.kind === "client") ?? visible[0] ?? g?.layers[0])?.id ?? "";
  let range = at;
  if (!range) {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    range = { start, end: new Date(start.getTime() + 60 * 60 * 1000), allDay: false };
  }
  return {
    title: "",
    calendarId,
    category: "meeting",
    status: "planned",
    allDay: range.allDay,
    start: range.start,
    end: range.end,
    location: "",
    url: "",
    description: "",
    reminder: range.allDay ? null : 10,
    projectId: null,
  };
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const titleFmt = {
  month: new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }),
  day: new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }),
  short: new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }),
};

function rangeTitle(view: ViewName, start: Date, end: Date) {
  if (view === "dayGridMonth") return titleFmt.month.format(addDays(start, 10));
  if (view === "timeGridDay") return titleFmt.day.format(start);
  const last = addDays(end, -1);
  return `${titleFmt.short.format(start)} – ${titleFmt.short.format(last)}`;
}

export function CalendarApp({
  groups: initialGroups,
  currentWorkspaceId,
  projects,
}: {
  groups: WorkspaceLayers[];
  currentWorkspaceId: string;
  projects: ProjectRef[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const calRef = useRef<FullCalendar>(null);
  const [groups, setGroups] = useState(initialGroups);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const isMobile = useSyncExternalStore(subscribeMobile, () => mobileQuery().matches, () => false);
  const [initialView] = useState<ViewName>(() => {
    const saved = readStorage<ViewName | null>(VIEW_STORAGE, null);
    const v = saved ?? (isMobile ? "timeGrid3" : "timeGridWeek");
    if (isMobile && v === "timeGridWeek") return "timeGrid3";
    if (!isMobile && v === "timeGrid3") return "timeGridWeek";
    return v;
  });
  const [view, setView] = useState<ViewName>(initialView);
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Set<Category>>(() => {
    const saved = readStorage<string[] | null>(CATEGORY_STORAGE, null);
    return new Set(Array.isArray(saved) ? (saved.filter((c) => c in CATEGORIES) as Category[]) : CATEGORY_KEYS);
  });
  const [layersOpen, setLayersOpen] = useState(false);
  const [googleMode, setGoogleMode] = useState<"import" | "export" | null>(null);
  const [googleKey, setGoogleKey] = useState(0);
  // „+ → Wydarzenie” z innego ekranu przychodzi jako ?nowe=1 i od razu otwiera edytor.
  const [draft, setDraft] = useState<EventDraft | null>(() =>
    new URLSearchParams(location.search).has("nowe") ? blankDraft(initialGroups, currentWorkspaceId) : null,
  );
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(location.search).has("nowe")) history.replaceState(null, "", location.pathname);
  }, []);
  const [details, setDetails] = useState<CalendarItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const layerById = useMemo(() => {
    const m = new Map<string, Layer>();
    groups.forEach((g) => g.layers.forEach((l) => m.set(l.id, l)));
    return m;
  }, [groups]);

  // ── Pobieranie elementów dla widocznego zakresu ──
  const load = useCallback(
    async (r: { start: Date; end: Date }) => {
      setLoading(true);
      const { data, error } = await supabase.rpc("calendar_items", {
        p_from: r.start.toISOString(),
        p_to: r.end.toISOString(),
      });
      setLoading(false);
      if (error) {
        setError("Nie udało się pobrać kalendarza. Sprawdź połączenie i odśwież stronę.");
        return;
      }
      setError(null);
      setItems((data ?? []) as CalendarItem[]);
    },
    [supabase],
  );

  // Zmiany z innych urządzeń i od innych osób — przeładuj widoczny zakres.
  useRealtime("calendar", ["events", "tasks", "content_milestones", "content_publications"], () => {
    if (range) load(range);
  });

  const onDatesSet = (arg: DatesSetArg) => {
    const v = arg.view.type as ViewName;
    setView(v);
    setTitle(rangeTitle(v, arg.start, arg.end));
    const same = range && range.start.getTime() === arg.start.getTime() && range.end.getTime() === arg.end.getTime();
    if (!same) {
      const r = { start: arg.start, end: arg.end };
      setRange(r);
      load(r);
    }
    writeStorage(VIEW_STORAGE, v);
  };

  // Telefon ⇄ komputer: tydzień zamienia się w 3 dni i odwrotnie.
  useEffect(() => {
    const cal = calRef.current?.getApi();
    if (!cal) return;
    const t = cal.view.type;
    if (isMobile && t === "timeGridWeek") cal.changeView("timeGrid3");
    if (!isMobile && t === "timeGrid3") cal.changeView("timeGridWeek");
  }, [isMobile]);

  // ── Elementy → wydarzenia FullCalendar ──
  const events: EventInput[] = useMemo(
    () =>
      items
        .filter((it) => layerById.get(it.calendar_id)?.visible && categories.has(it.category))
        .map((it) => {
          const layer = layerById.get(it.calendar_id)!;
          const c = colorVars(layer.color);
          const isEvent = it.source_type === "event";
          return {
            id: `${it.source_type}:${it.source_id}`,
            title: it.title,
            start: it.starts_at,
            end: isEvent ? it.ends_at : undefined,
            allDay: it.all_day,
            backgroundColor: c.fill,
            borderColor: "transparent",
            textColor: c.ink,
            durationEditable: isEvent,
            classNames: [
              `cf-${it.source_type}`,
              it.status === "cancelled" ? "cf-cancelled" : "",
              it.status === "done" ? "cf-done" : "",
            ].filter(Boolean),
            extendedProps: { item: it, solid: c.solid },
          } satisfies EventInput;
        }),
    [items, layerById, categories],
  );

  // ── Warstwy ──
  const toggleLayer = async (layer: Layer) => {
    const visible = !layer.visible;
    setGroups((gs) => gs.map((g) => ({ ...g, layers: g.layers.map((l) => (l.id === layer.id ? { ...l, visible } : l)) })));
    const { error } = await supabase
      .from("calendar_visibility")
      .upsert({ calendar_id: layer.id, visible }, { onConflict: "user_id,calendar_id" });
    if (error) setError("Nie udało się zapisać widoczności warstwy.");
  };

  const createLayer = async (workspaceId: string, name: string, color: ClientColor) => {
    const { data, error } = await supabase
      .from("calendars")
      .insert({ workspace_id: workspaceId, kind: "custom", name, color, position: 500 })
      .select("id, workspace_id, kind, name, color, position")
      .single();
    if (error || !data) return "Nie udało się dodać warstwy.";
    setGroups((gs) =>
      gs.map((g) =>
        g.id === workspaceId
          ? {
              ...g,
              layers: [
                ...g.layers.filter((l) => l.kind !== "tasks"),
                { id: data.id, workspaceId, kind: "custom", name, color, position: data.position, visible: true, clientId: null },
                ...g.layers.filter((l) => l.kind === "tasks"),
              ],
            }
          : g,
      ),
    );
    return null;
  };

  const toggleCategory = (c: Category) =>
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      writeStorage(CATEGORY_STORAGE, [...next]);
      return next;
    });

  // ── Tworzenie i edycja ──
  // Każde otwarcie edytora to świeży stan formularza (nowy klucz komponentu).
  const openDraft = (d: EventDraft) => {
    setEditorKey((k) => k + 1);
    setDraft(d);
  };

  const newDraft = (start: Date, end: Date, allDay: boolean) =>
    blankDraft(groups, currentWorkspaceId, { start, end, allDay });

  const openNew = () => openDraft(blankDraft(groups, currentWorkspaceId));

  // „+ → Wydarzenie” w dolnym pasku, gdy kalendarz jest już otwarty.
  useEffect(() => {
    const onNew = () => {
      setEditorKey((k) => k + 1);
      setDraft(blankDraft(groups, currentWorkspaceId));
    };
    window.addEventListener(NEW_EVENT, onNew);
    return () => window.removeEventListener(NEW_EVENT, onNew);
  }, [groups, currentWorkspaceId]);

  const onDateClick = (arg: DateClickArg) => {
    if (arg.allDay) openDraft(newDraft(arg.date, addDays(arg.date, 1), true));
    else openDraft(newDraft(arg.date, new Date(arg.date.getTime() + 60 * 60 * 1000), false));
  };

  const onSelect = (arg: { start: Date; end: Date; allDay: boolean }) => {
    calRef.current?.getApi().unselect();
    // Pojedyncze kliknięcie obsługuje dateClick; tu tylko zaznaczenie zakresu.
    const minutes = (arg.end.getTime() - arg.start.getTime()) / 60000;
    if (!arg.allDay && minutes <= 30) return;
    if (arg.allDay && minutes <= 1440) return;
    openDraft(newDraft(arg.start, arg.end, arg.allDay));
  };

  const onEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    const it = arg.event.extendedProps.item as CalendarItem;
    if (it.source_type !== "event") return setDetails(it);
    openDraft({
      id: it.source_id,
      title: it.title,
      calendarId: it.calendar_id,
      category: it.category,
      status: (it.status as EventDraft["status"]) ?? "planned",
      allDay: it.all_day,
      start: new Date(it.starts_at),
      end: new Date(it.ends_at),
      location: it.location ?? "",
      url: it.url ?? "",
      description: it.description ?? "",
    });
  };

  const saveDraft = async (d: EventDraft) => {
    const row = {
      title: d.title,
      calendar_id: d.calendarId,
      category: d.category,
      status: d.status,
      all_day: d.allDay,
      starts_at: d.start.toISOString(),
      ends_at: d.end.toISOString(),
      location: d.location.trim() || null,
      url: d.url.trim() || null,
      description: d.description.trim() || null,
      ...(d.projectId !== undefined ? { project_id: d.projectId } : {}),
    };
    const { data: saved, error } = d.id
      ? await supabase.from("events").update(row).eq("id", d.id).select("id").single()
      : await supabase.from("events").insert(row).select("id").single();
    if (error || !saved) return "Nie udało się zapisać wydarzenia. Spróbuj ponownie.";

    // Zdjęcia wybrane w nowym wydarzeniu (istniejące wysyłają je od razu).
    if (!d.id && d.photos?.length) {
      const ws = groups.find((g) => g.layers.some((l) => l.id === d.calendarId))?.id;
      const failed = ws ? await uploadEventPhotos(supabase, ws, saved.id, d.photos) : d.photos.length;
      if (failed) setError(`Wydarzenie zapisane, ale ${failed === d.photos.length ? "zdjęć" : `${failed} zdjęć`} nie udało się dodać.`);
    }

    // Przypomnienie (własne dla zalogowanej osoby): czas liczy trigger z offsetu.
    if (d.reminder !== undefined) {
      await supabase.from("reminders").delete().eq("event_id", saved.id);
      if (d.reminder !== null) {
        const { error: remErr } = await supabase.from("reminders").insert({
          event_id: saved.id,
          offset_minutes: d.reminder,
          remind_at: new Date(d.start.getTime() - d.reminder * 60000).toISOString(),
        });
        if (remErr) setError("Wydarzenie zapisane, ale przypomnienia nie udało się ustawić.");
      }
    }
    setDraft(null);
    if (range) await load(range);
    return null;
  };

  const deleteEvent = async (id: string) => {
    // Wiersze event_photos usunie kaskada, a pliki z koszyka usuwamy sami — dopiero po udanym usunięciu wydarzenia.
    const photoPaths = await eventPhotoPaths(supabase, id);
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (!error) await removePhotoFiles(supabase, photoPaths);
    if (error) return "Nie udało się usunąć wydarzenia.";
    setDraft(null);
    setItems((xs) => xs.filter((x) => !(x.source_type === "event" && x.source_id === id)));
    return null;
  };

  // ── Przeciąganie i zmiana długości: zapis w rekordzie źródłowym ──
  const persistMove = async (arg: EventDropArg | EventResizeDoneArg) => {
    const it = arg.event.extendedProps.item as CalendarItem;
    const start = arg.event.start!;
    const allDay = arg.event.allDay;
    let end = arg.event.end;
    if (!end) end = allDay ? addDays(start, 1) : new Date(start.getTime() + 60 * 60 * 1000);

    const patch = { starts_at: start.toISOString(), ends_at: end.toISOString() };
    const q =
      it.source_type === "event"
        ? supabase.from("events").update({ ...patch, all_day: allDay }).eq("id", it.source_id)
        : it.source_type === "task"
          ? supabase.from("tasks").update({ due_at: patch.starts_at, due_all_day: allDay }).eq("id", it.source_id)
          : it.source_type === "milestone"
            ? supabase.from("content_milestones").update({ due_at: patch.starts_at, all_day: allDay }).eq("id", it.source_id)
            : supabase.from("content_publications").update({ publish_at: patch.starts_at }).eq("id", it.source_id);

    const { error } = await q;
    if (error) {
      arg.revert();
      setError("Nie udało się przesunąć. Termin wrócił na poprzednie miejsce.");
      return;
    }
    setItems((xs) =>
      xs.map((x) =>
        x.source_type === it.source_type && x.source_id === it.source_id
          ? { ...x, starts_at: patch.starts_at, ends_at: it.source_type === "event" ? patch.ends_at : patch.starts_at, all_day: allDay }
          : x,
      ),
    );
  };

  const api = () => calRef.current?.getApi();
  const views: { key: ViewName; label: string }[] = [
    { key: "timeGridDay", label: "Dzień" },
    isMobile ? { key: "timeGrid3", label: "3 dni" } : { key: "timeGridWeek", label: "Tydzień" },
    { key: "dayGridMonth", label: "Miesiąc" },
  ];
  const hiddenCount = groups.reduce((n, g) => n + g.layers.filter((l) => !l.visible).length, 0) + (CATEGORY_KEYS.length - categories.size);

  const panel = (
    <LayersPanel
      groups={groups}
      onToggle={toggleLayer}
      onCreateLayer={createLayer}
      categories={categories}
      onToggleCategory={toggleCategory}
    />
  );

  return (
    // Kalendarz wypełnia cały obszar treści: znosimy marginesy <main> i odejmujemy paski telefonu.
    <div className="-mx-4 -mt-6 -mb-28 flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-4rem-env(safe-area-inset-bottom))] sm:-mx-6 lg:-mx-10 lg:-mt-8 lg:-mb-12 lg:h-dvh">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-line px-3 py-6 xl:block" aria-label="Warstwy kalendarza">
        {panel}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-5 lg:pt-5">
          <h1 className="order-first mr-auto min-w-0 truncate text-xl font-semibold tracking-tight first-letter:uppercase sm:text-2xl">
            {title}
          </h1>
          <div className="flex items-center gap-1">
            <Button variant="secondary" className="h-9 px-3" onClick={() => api()?.today()}>
              Dziś
            </Button>
            <Button variant="ghost" className="h-9 w-9 px-0" aria-label="Poprzedni" onClick={() => api()?.prev()}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>
            <Button variant="ghost" className="h-9 w-9 px-0" aria-label="Następny" onClick={() => api()?.next()}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Widok">
            {views.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={view === v.key}
                onClick={() => api()?.changeView(v.key)}
                className={cx(
                  "h-8 rounded-md px-3 text-sm transition-colors",
                  view === v.key ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" className="relative h-9 px-3 xl:hidden" onClick={() => setLayersOpen(true)}>
            <Layers className="size-4" aria-hidden="true" />
            <span className="max-sm:sr-only">Warstwy</span>
            {hiddenCount > 0 ? (
              <span className="tabular absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-bg">
                {hiddenCount}
              </span>
            ) : null}
          </Button>
          <GoogleCalendarMenu onPick={setGoogleMode} />
          <Button variant="primary" className="hidden h-9 px-3 lg:inline-flex" onClick={() => openNew()}>
            <Plus className="size-4" aria-hidden="true" />
            Wydarzenie
          </Button>
        </header>

        {error ? (
          <p role="alert" className="mx-3 mb-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger sm:mx-5">
            {error}
          </p>
        ) : null}

        <div className={cx("cf-calendar min-h-0 flex-1 px-1 pb-2 sm:px-3", loading && "cf-loading")}>
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={plLocale}
            initialView={initialView}
            views={{ timeGrid3: { type: "timeGrid", duration: { days: 3 }, buttonText: "3 dni" } }}
            headerToolbar={false}
            height="100%"
            firstDay={1}
            nowIndicator
            allDayText="cały dzień"
            slotDuration="00:30:00"
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit" }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit" }}
            dayHeaderFormat={view === "dayGridMonth" ? { weekday: "short" } : { weekday: "short", day: "numeric" }}
            scrollTime="07:30:00"
            dayMaxEvents={3}
            editable
            selectable
            selectMirror
            longPressDelay={350}
            eventLongPressDelay={300}
            selectLongPressDelay={400}
            events={events}
            datesSet={onDatesSet}
            dateClick={onDateClick}
            select={onSelect}
            eventClick={onEventClick}
            eventDrop={persistMove}
            eventResize={persistMove}
            eventContent={renderEvent}
          />
        </div>
      </section>

      <Dialog open={layersOpen} onClose={() => setLayersOpen(false)} title="Warstwy" side>
        {panel}
      </Dialog>

      <EventEditor key={editorKey} draft={draft} groups={groups} projects={projects} onClose={() => setDraft(null)} onSave={saveDraft} onDelete={deleteEvent} />
      <GoogleCalendarDialog
        key={googleKey}
        mode={googleMode}
        groups={groups}
        currentWorkspaceId={currentWorkspaceId}
        onClose={() => {
          setGoogleMode(null);
          setGoogleKey((k) => k + 1);
        }}
        onLayersCreated={(workspaceId, created) =>
          setGroups((gs) =>
            gs.map((g) =>
              g.id === workspaceId
                ? { ...g, layers: [...g.layers.filter((l) => l.kind !== "tasks"), ...created, ...g.layers.filter((l) => l.kind === "tasks")] }
                : g,
            ),
          )
        }
        onDone={() => range && load(range)}
      />
      <ItemDetails
        item={details}
        layer={details ? layerById.get(details.calendar_id) : undefined}
        workspaceSlug={details ? groups.find((g) => g.id === details.workspace_id)?.slug : undefined}
        onClose={() => setDetails(null)}
      />
    </div>
  );
}

function renderEvent(arg: EventContentArg) {
  const it = arg.event.extendedProps.item as CalendarItem | undefined;
  // Podgląd zaznaczanego zakresu (selectMirror) nie ma danych wpisu.
  if (!it) {
    return <p className="cf-ev tabular truncate p-0.5 font-medium">{arg.timeText || "Nowe wydarzenie"}</p>;
  }
  const Icon = CATEGORIES[it.category]?.icon ?? CATEGORIES.other.icon;
  const meeting = it.source_type === "event" ? findMeeting(it.url, it.location, it.description) : null;
  const extra = it.source_type === "publication" && it.platform ? PLATFORMS[it.platform] : null;
  const timed = !arg.event.allDay;
  const compact = arg.view.type === "dayGridMonth";

  return (
    <div className={cx("cf-ev flex h-full min-w-0 gap-1 overflow-hidden", compact ? "items-center" : "flex-col")}>
      <div className="flex min-w-0 items-center gap-1">
        <Icon className="size-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
        <span className="truncate font-medium">{arg.event.title}</span>
        {meeting ? <Video className="ml-auto size-3 shrink-0" aria-label={meeting.provider} /> : null}
      </div>
      {!compact && (timed || extra) ? (
        <p className="tabular truncate opacity-80">
          {timed ? arg.timeText : null}
          {timed && extra ? " · " : null}
          {extra}
        </p>
      ) : null}
    </div>
  );
}
