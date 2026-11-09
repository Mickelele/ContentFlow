"use client";

import { useMemo, useState } from "react";
import { CalendarSync, Check, Loader2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, Field, cx, inputClass } from "@/components/ui";
import type { Layer, WorkspaceLayers } from "@/lib/calendar";
import {
  connectCalendar,
  insertEvent,
  listCalendars,
  listEvents,
  patchEvent,
  toContentFlowEvent,
  toGoogleEvent,
  type GCalendar,
} from "@/lib/google-calendar";
import { colorVars, type ClientColor } from "@/lib/palette";
import { createClient } from "@/lib/supabase/client";

type Mode = "import" | "export";
const NEW = "__new__";

const RANGES = [
  { months: 1, label: "Miesiąc" },
  { months: 3, label: "3 miesiące" },
  { months: 6, label: "Pół roku" },
  { months: 12, label: "Rok" },
];

/** Kolor kalendarza Google → najbliższy kolor z palety ContentFlow (po odcieniu). */
function nearestColor(hex?: string): ClientColor {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex.replace("#", ""))) return "blue";
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return "brown";
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const hues: [ClientColor, number][] = [
    ["red", 5], ["orange", 30], ["amber", 48], ["lime", 85], ["green", 135], ["teal", 170],
    ["cyan", 195], ["blue", 215], ["indigo", 240], ["violet", 275], ["pink", 330],
  ];
  return hues.reduce((best, cur) => (Math.min(Math.abs(cur[1] - h), 360 - Math.abs(cur[1] - h)) < Math.min(Math.abs(best[1] - h), 360 - Math.abs(best[1] - h)) ? cur : best))[0];
}

export function GoogleCalendarDialog({
  mode,
  groups,
  currentWorkspaceId,
  onClose,
  onLayersCreated,
  onDone,
}: {
  mode: Mode | null;
  groups: WorkspaceLayers[];
  currentWorkspaceId: string;
  onClose: () => void;
  onLayersCreated: (workspaceId: string, layers: Layer[]) => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [account, setAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [months, setMonths] = useState(3);
  const [withPast, setWithPast] = useState(false);
  const [targetWs, setTargetWs] = useState(currentWorkspaceId);
  // Import: kalendarz Google → warstwa docelowa (NEW = nowa warstwa o tej samej nazwie).
  const [picked, setPicked] = useState<Record<string, string>>({});
  // Eksport: warstwy źródłowe i kalendarz docelowy.
  const [layers, setLayers] = useState<Set<string>>(() => new Set(groups.find((g) => g.id === currentWorkspaceId)?.layers.filter((l) => l.visible && l.kind !== "tasks").map((l) => l.id)));
  const [targetCal, setTargetCal] = useState("");

  const allLayers = groups.flatMap((g) => g.layers.filter((l) => l.kind !== "tasks").map((l) => ({ ...l, wsName: g.name })));
  const range = () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    if (withPast) from.setDate(from.getDate() - 30);
    const to = new Date(from);
    to.setMonth(to.getMonth() + months + (withPast ? 1 : 0));
    return { from, to };
  };

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const t = await connectCalendar();
      const list = await listCalendars(t);
      setToken(t);
      setCalendars(list);
      setAccount(list.find((c) => c.primary)?.id ?? null);
      const writable = list.filter((c) => c.accessRole === "owner" || c.accessRole === "writer");
      setTargetCal(writable.find((c) => c.primary)?.id ?? writable[0]?.id ?? "");
      // Kalendarz zaimportowany wcześniej trafia domyślnie do tej samej warstwy.
      const preset: Record<string, string> = {};
      for (const c of list) {
        const existing = allLayers.find((l) => l.googleCalendarId === c.id);
        if (existing) preset[c.id] = existing.id;
      }
      setPicked(preset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się połączyć z Google.");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!token) return;
    const ids = Object.keys(picked);
    if (!ids.length) return setError("Zaznacz co najmniej jeden kalendarz.");
    setBusy(true);
    setError(null);
    try {
      const { from, to } = range();
      let total = 0;
      const created = new Map<string, Layer[]>();
      for (const calId of ids) {
        const cal = calendars.find((c) => c.id === calId)!;
        let layerId = picked[calId];
        if (layerId === NEW) {
          const { data, error } = await supabase
            .from("calendars")
            .insert({ workspace_id: targetWs, kind: "custom", name: cal.summary.slice(0, 80), color: nearestColor(cal.backgroundColor), position: 600, google_calendar_id: cal.id, google_account_email: account })
            .select("id, workspace_id, name, color, position")
            .single();
          if (error || !data) throw new Error(`Nie udało się utworzyć warstwy „${cal.summary}”.`);
          layerId = data.id;
          const layer: Layer = { id: data.id, workspaceId: data.workspace_id, kind: "custom", name: data.name, color: data.color, position: data.position, visible: true, clientId: null, googleCalendarId: cal.id };
          created.set(data.workspace_id, [...(created.get(data.workspace_id) ?? []), layer]);
        }
        const events = (await listEvents(token, cal.id, from, to)).filter((e) => e.status !== "cancelled" && (e.start.date || e.start.dateTime));
        const rows = events.map((e) => toContentFlowEvent(e, cal.id, layerId));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from("events").upsert(rows.slice(i, i + 500), { onConflict: "calendar_id,external_id" });
          if (error) throw new Error(`Nie udało się zapisać wydarzeń z „${cal.summary}”.`);
        }
        await supabase.from("calendars").update({ last_imported_at: new Date().toISOString(), google_calendar_id: cal.id, google_account_email: account }).eq("id", layerId);
        total += rows.length;
      }
      created.forEach((ls, ws) => onLayersCreated(ws, ls));
      setResult(`Zaimportowano ${total} ${total === 1 ? "wydarzenie" : total < 5 ? "wydarzenia" : "wydarzeń"}. Ponowny import zaktualizuje je bez duplikatów.`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import się nie udał.");
    } finally {
      setBusy(false);
    }
  };

  const runExport = async () => {
    if (!token || !targetCal) return setError("Wybierz kalendarz docelowy.");
    if (!layers.size) return setError("Zaznacz co najmniej jedną warstwę.");
    setBusy(true);
    setError(null);
    try {
      const { from, to } = range();
      const { data: events, error } = await supabase
        .from("events")
        .select("id, title, description, location, url, all_day, starts_at, ends_at, status")
        .in("calendar_id", [...layers])
        .is("external_id", null) // nie odsyłamy do Google tego, co z Google przyszło
        .neq("status", "cancelled")
        .lt("starts_at", to.toISOString())
        .gt("ends_at", from.toISOString());
      if (error) throw new Error("Nie udało się pobrać wydarzeń.");
      const list = events ?? [];
      const { data: exported } = list.length
        ? await supabase.from("event_exports").select("event_id, google_event_id").eq("google_calendar_id", targetCal).in("event_id", list.map((e) => e.id))
        : { data: [] };
      const map = new Map((exported ?? []).map((x) => [x.event_id as string, x.google_event_id as string]));
      let created = 0, updated = 0;
      for (const e of list) {
        const body = toGoogleEvent(e);
        const existing = map.get(e.id);
        if (existing) {
          try {
            await patchEvent(token, targetCal, existing, body);
            updated++;
            continue;
          } catch (err) {
            if ((err as { status?: number }).status !== 404 && (err as { status?: number }).status !== 410) throw err;
          }
        }
        const g = await insertEvent(token, targetCal, body);
        await supabase.from("event_exports").upsert({ event_id: e.id, google_calendar_id: targetCal, google_event_id: g.id }, { onConflict: "event_id,google_calendar_id" });
        created++;
      }
      setResult(`Wysłano do Google: ${created} nowych, ${updated} zaktualizowanych.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eksport się nie udał.");
    } finally {
      setBusy(false);
    }
  };

  const rangePicker = (
    <fieldset>
      <legend className="text-sm font-medium">Okres</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.months}
            type="button"
            aria-pressed={months === r.months}
            onClick={() => setMonths(r.months)}
            className={cx("pressable h-8 rounded-full border px-3 text-sm", months === r.months ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-2 hover:bg-surface-2")}
          >
            {r.label}
          </button>
        ))}
      </div>
      <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={withPast} onChange={(e) => setWithPast(e.target.checked)} />
        Także ostatnie 30 dni
      </label>
    </fieldset>
  );

  return (
    <Dialog
      open={Boolean(mode)}
      onClose={onClose}
      title={mode === "export" ? "Wyślij do Google Calendar" : "Importuj z Google Calendar"}
      footer={
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={onClose}>
            {result ? "Zamknij" : "Anuluj"}
          </Button>
          {token && !result ? (
            <Button variant="primary" className="h-9" disabled={busy} onClick={mode === "export" ? runExport : runImport}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {mode === "export" ? "Wyślij" : "Importuj"}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        {!token ? (
          <>
            <p className="text-ink-2">
              {mode === "export"
                ? "Wybierzesz konto Google, kalendarz docelowy, okres i warstwy. Ponowne wysłanie zaktualizuje wydarzenia zamiast je dublować."
                : "Wybierzesz konto Google, kalendarze i okres. Wydarzenia staną się zwykłymi wydarzeniami ContentFlow. Ponowny import je zaktualizuje."}
            </p>
            <p className="text-sm text-ink-3">Dostęp jest jednorazowy (ok. godziny) — niczego nie przechowujemy i nic nie synchronizuje się w tle.</p>
            <Button variant="primary" className="self-start" disabled={busy} onClick={connect}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Połącz z Google
            </Button>
          </>
        ) : result ? (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {result}
          </p>
        ) : mode === "import" ? (
          <>
            {account ? <p className="text-sm text-ink-2">Konto: {account}</p> : null}
            <fieldset>
              <legend className="text-sm font-medium">Kalendarze do importu</legend>
              <ul className="mt-2 flex flex-col divide-y divide-line rounded-xl border border-line">
                {calendars.map((c) => {
                  const on = c.id in picked;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--ink)]"
                          checked={on}
                          onChange={(e) =>
                            setPicked((p) => {
                              const next = { ...p };
                              if (e.target.checked) next[c.id] = NEW;
                              else delete next[c.id];
                              return next;
                            })
                          }
                        />
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorVars(nearestColor(c.backgroundColor)).solid }} aria-hidden="true" />
                        <span className="truncate">{c.summary}</span>
                      </label>
                      {on ? (
                        <select
                          aria-label={`Warstwa dla „${c.summary}”`}
                          className={cx(inputClass, "h-8 w-auto max-w-56 text-[13px]")}
                          value={picked[c.id]}
                          onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.value }))}
                        >
                          <option value={NEW}>Nowa warstwa „{c.summary.slice(0, 24)}”</option>
                          {groups.map((g) => (
                            <optgroup key={g.id} label={g.name}>
                              {g.layers.filter((l) => l.kind !== "tasks").map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            {groups.length > 1 && Object.values(picked).includes(NEW) ? (
              <Field label="Nowe warstwy w workspace'ie" htmlFor="gc-ws">
                <select id="gc-ws" className={inputClass} value={targetWs} onChange={(e) => setTargetWs(e.target.value)}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {rangePicker}
          </>
        ) : (
          <>
            {account ? <p className="text-sm text-ink-2">Konto: {account}</p> : null}
            <Field label="Kalendarz docelowy" htmlFor="gc-target">
              <select id="gc-target" className={inputClass} value={targetCal} onChange={(e) => setTargetCal(e.target.value)}>
                {calendars
                  .filter((c) => c.accessRole === "owner" || c.accessRole === "writer")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.summary}
                    </option>
                  ))}
              </select>
            </Field>
            <fieldset>
              <legend className="text-sm font-medium">Warstwy do wysłania</legend>
              <div className="mt-2 flex flex-col gap-1">
                {allLayers.map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--ink)]"
                      checked={layers.has(l.id)}
                      onChange={(e) =>
                        setLayers((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(l.id);
                          else n.delete(l.id);
                          return n;
                        })
                      }
                    />
                    <span className="size-2.5 rounded-full" style={{ background: colorVars(l.color).solid }} aria-hidden="true" />
                    {l.name}
                    {groups.length > 1 ? <span className="text-ink-3">· {l.wsName}</span> : null}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-sm text-ink-3">Wydarzenia zaimportowane wcześniej z Google nie są odsyłane z powrotem.</p>
            </fieldset>
            {rangePicker}
          </>
        )}
        {error ? (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Przycisk „Google” w nagłówku kalendarza: import albo eksport. Ukryty bez Client ID Google. */
export function GoogleCalendarMenu({ onPick }: { onPick: (mode: Mode) => void }) {
  const [open, setOpen] = useState(false);
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Button variant="secondary" className="h-9 px-3" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <CalendarSync className="size-4" aria-hidden="true" />
        <span className="max-sm:sr-only">Google</span>
      </Button>
      {open ? (
        <div className="absolute top-full right-0 z-50 mt-1 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.3)]">
          {(
            [
              ["import", "Importuj z Google", "Wydarzenia z Google trafią do ContentFlow"],
              ["export", "Wyślij do Google", "Twój plan pojawi się w Google Calendar"],
            ] as const
          ).map(([m, label, hint]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(m);
              }}
              className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-surface-2"
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="text-[13px] text-ink-3">{hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
