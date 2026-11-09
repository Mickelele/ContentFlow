"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Hash } from "lucide-react";
import { Button, PageHeader, buttonClass, cx } from "@/components/ui";
import { colorVars } from "@/lib/palette";
import { createClient } from "@/lib/supabase/client";
import { dateKey, keyToDate, type ClientRef, type WorkspaceRef } from "@/lib/tasks";
import { sendWeeklySummaryAction } from "./actions";

/*
 * Statystyki realizacji zadań (DASH-06) i tygodniowe podsumowanie pracy (DASH-07).
 * Tydzień = poniedziałek–niedziela w strefie przeglądarki; porównanie z poprzednim tygodniem.
 */

type Week = { from: Date; to: Date };
type Stats = {
  doneByDay: number[];
  done: number;
  donePrev: number;
  created: number;
  dueInWeek: number;
  dueInWeekDone: number;
  overdue: number;
  published: number;
  publishedPrev: number;
  plannedNext: number;
  milestones: { recording: number; editing: number; approval: number };
  approvals: number;
  minutes: { meeting: number; recording: number; editing: number; other: number };
  perClient: Map<string | null, { tasks: number; pubs: number; prod: number }>;
};

const DAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const rangeFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });

function weekOf(offset: number): Week {
  const now = keyToDate(dateKey(new Date()));
  const dow = (now.getDay() + 6) % 7; // poniedziałek = 0
  const from = new Date(now);
  from.setDate(now.getDate() - dow + offset * 7);
  const to = new Date(from);
  to.setDate(from.getDate() + 7);
  return { from, to };
}

const hours = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);
const delta = (now: number, prev: number) => (now === prev ? "tyle samo co tydzień wcześniej" : `${now > prev ? "+" : "−"}${Math.abs(now - prev)} vs poprzedni tydzień`);

export function StatsApp({ workspace, clients, slackConnected }: { workspace: WorkspaceRef; clients: ClientRef[]; slackConnected: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [slackState, setSlackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const week = useMemo(() => weekOf(offset), [offset]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  useEffect(() => {
    let alive = true;
    const ws = workspace.id;
    const prev = weekOf(offset - 1);
    const next = weekOf(offset + 1);
    const f = week.from.toISOString();
    const t = week.to.toISOString();
    const today = keyToDate(dateKey(new Date())).toISOString();

    Promise.all([
      supabase.from("tasks").select("completed_at, client_id").eq("workspace_id", ws).eq("status", "done").gte("completed_at", prev.from.toISOString()).lt("completed_at", t),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).gte("created_at", f).lt("created_at", t),
      supabase.from("tasks").select("status, completed_at, due_at").eq("workspace_id", ws).gte("due_at", f).lt("due_at", t),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).neq("status", "done").lt("due_at", today),
      supabase.from("content_publications").select("publish_at, status, content(client_id)").eq("workspace_id", ws).gte("publish_at", prev.from.toISOString()).lt("publish_at", next.to.toISOString()),
      supabase.from("content_milestones").select("kind, done_at, content(client_id)").eq("workspace_id", ws).gte("done_at", f).lt("done_at", t),
      supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "approved").gte("responded_at", f).lt("responded_at", t),
      supabase.from("events").select("category, starts_at, ends_at, all_day, status").eq("workspace_id", ws).eq("all_day", false).neq("status", "cancelled").gte("starts_at", f).lt("starts_at", t),
    ]).then(([doneQ, createdQ, dueQ, overdueQ, pubQ, msQ, apprQ, evQ]) => {
      if (!alive) return;
      if ([doneQ, dueQ, pubQ, msQ, evQ].some((q) => q.error)) return setError("Nie udało się policzyć statystyk.");
      const inWeek = (iso: string | null) => Boolean(iso && iso >= f && iso < t);
      const perClient: Stats["perClient"] = new Map();
      const bump = (id: string | null, k: "tasks" | "pubs" | "prod") => {
        const row = perClient.get(id) ?? { tasks: 0, pubs: 0, prod: 0 };
        row[k]++;
        perClient.set(id, row);
      };

      const doneByDay = [0, 0, 0, 0, 0, 0, 0];
      let done = 0;
      let donePrev = 0;
      for (const r of doneQ.data ?? []) {
        if (inWeek(r.completed_at)) {
          done++;
          doneByDay[(new Date(r.completed_at!).getDay() + 6) % 7]++;
          bump(r.client_id, "tasks");
        } else donePrev++;
      }

      const due = dueQ.data ?? [];
      let published = 0, publishedPrev = 0, plannedNext = 0;
      for (const p of pubQ.data ?? []) {
        const c = (p.content as unknown as { client_id: string | null } | null)?.client_id ?? null;
        if (p.status === "published" && inWeek(p.publish_at)) {
          published++;
          bump(c, "pubs");
        } else if (p.status === "published" && p.publish_at < f) publishedPrev++;
        else if (p.status === "planned" && p.publish_at >= next.from.toISOString()) plannedNext++;
      }

      const milestones = { recording: 0, editing: 0, approval: 0 };
      for (const m of msQ.data ?? []) {
        milestones[m.kind as keyof typeof milestones]++;
        bump((m.content as unknown as { client_id: string | null } | null)?.client_id ?? null, "prod");
      }

      const minutes = { meeting: 0, recording: 0, editing: 0, other: 0 };
      for (const e of evQ.data ?? []) {
        const min = Math.max(0, Math.round((new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 60000));
        const k: keyof typeof minutes = e.category === "meeting" || e.category === "recording" || e.category === "editing" ? e.category : "other";
        minutes[k] += min;
      }

      setError(null);
      setStats({
        doneByDay,
        done,
        donePrev,
        created: createdQ.count ?? 0,
        dueInWeek: due.length,
        dueInWeekDone: due.filter((x) => x.status === "done").length,
        overdue: overdueQ.count ?? 0,
        published,
        publishedPrev,
        plannedNext,
        milestones,
        approvals: apprQ.count ?? 0,
        minutes,
        perClient,
      });
    });
    return () => {
      alive = false;
    };
  }, [supabase, workspace.id, week, offset]);

  const title = `Tydzień ${rangeFmt.format(week.from)} – ${rangeFmt.format(new Date(week.to.getTime() - 864e5))}`;
  const clientRows = stats
    ? [...stats.perClient.entries()].sort((a, b) => b[1].tasks + b[1].pubs + b[1].prod - (a[1].tasks + a[1].pubs + a[1].prod))
    : [];
  const top = clientRows.find(([id]) => id);

  const summary: string[] = stats
    ? [
        `Ukończone zadania: ${stats.done} (${delta(stats.done, stats.donePrev)})`,
        stats.dueInWeek ? `Terminy w tym tygodniu: ${stats.dueInWeekDone} z ${stats.dueInWeek} zrobione` : null,
        `Opublikowane materiały: ${stats.published}${stats.plannedNext ? `, zaplanowane na kolejny tydzień: ${stats.plannedNext}` : ""}`,
        `Produkcja: nagrania ${stats.milestones.recording}, montaże ${stats.milestones.editing}, akceptacje ${stats.milestones.approval + stats.approvals}`,
        stats.minutes.meeting + stats.minutes.recording ? `W kalendarzu: spotkania ${hours(stats.minutes.meeting)}, nagrania ${hours(stats.minutes.recording)}` : null,
        stats.overdue ? `Zaległe zadania: ${stats.overdue}` : "Brak zaległych zadań",
        top ? `Najwięcej pracy: ${clientById.get(top[0]!)?.name ?? "—"} (zadania ${top[1].tasks}, publikacje ${top[1].pubs})` : null,
      ].filter((x): x is string => Boolean(x))
    : [];

  const max = stats ? Math.max(1, ...stats.doneByDay) : 1;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Podsumowanie"
        description={`Jak idzie praca w ${workspace.name}: zadania, publikacje i czas w kalendarzu.`}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="h-9 w-9 px-0" aria-label="Poprzedni tydzień" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>
            <Button variant="secondary" className="h-9 px-3" disabled={offset === 0} onClick={() => setOffset(0)}>
              Ten tydzień
            </Button>
            <Button variant="ghost" className="h-9 w-9 px-0" aria-label="Następny tydzień" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
        }
      />
      <h2 className="mb-5 text-lg font-semibold first-letter:uppercase">{title}</h2>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!stats ? (
        <div className="grid animate-pulse gap-3 motion-reduce:animate-none sm:grid-cols-4" aria-busy="true" aria-label="Ładowanie">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Liczby tygodnia */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Ukończone zadania" value={stats.done} note={delta(stats.done, stats.donePrev)} />
            <Tile
              label="Terminy dotrzymane"
              value={stats.dueInWeek ? `${Math.round((stats.dueInWeekDone / stats.dueInWeek) * 100)}%` : "—"}
              note={stats.dueInWeek ? `${stats.dueInWeekDone} z ${stats.dueInWeek} z terminem w tym tygodniu` : "brak terminów w tym tygodniu"}
            />
            <Tile label="Opublikowane" value={stats.published} note={delta(stats.published, stats.publishedPrev)} />
            <Tile label="Zaległe teraz" value={stats.overdue} note={stats.overdue ? "do nadrobienia" : "wszystko na czas"} tone={stats.overdue ? "danger" : undefined} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {/* Wykres: ukończone zadania dziennie (jedna seria, bez legendy) */}
            <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="chart-h">
              <h3 id="chart-h" className="font-semibold">
                Ukończone zadania dzień po dniu
              </h3>
              <DayBars values={stats.doneByDay} max={max} />
            </section>

            {/* Podsumowanie tekstowe */}
            <section className="flex flex-col rounded-2xl border border-line bg-surface p-5" aria-labelledby="sum-h">
              <h3 id="sum-h" className="font-semibold">
                Podsumowanie tygodnia
              </h3>
              <ul className="mt-3 flex flex-1 flex-col gap-1.5 text-sm text-ink-2">
                {summary.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
                    {l}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass("secondary", "h-9 px-3")}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText([title, ...summary.map((l) => `• ${l}`)].join("\n"));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                >
                  {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  {copied ? "Skopiowano" : "Kopiuj"}
                </button>
                {slackConnected ? (
                  <button
                    type="button"
                    disabled={slackState === "sending"}
                    className={buttonClass("secondary", "h-9 px-3")}
                    onClick={async () => {
                      setSlackState("sending");
                      const r = await sendWeeklySummaryAction(workspace.slug, { title, lines: summary });
                      setSlackState(r.ok ? "sent" : "error");
                      if (!r.ok) setError(r.error);
                      setTimeout(() => setSlackState("idle"), 3000);
                    }}
                  >
                    <Hash className="size-4" aria-hidden="true" />
                    {slackState === "sending" ? "Wysyłam…" : slackState === "sent" ? "Wysłano" : "Na Slacka"}
                  </button>
                ) : null}
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Produkcja i czas */}
            <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="prod-h">
              <h3 id="prod-h" className="mb-3 font-semibold">
                Produkcja i czas
              </h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-2">Nagrania (terminy odhaczone)</dt>
                <dd className="tabular text-right font-medium">{stats.milestones.recording}</dd>
                <dt className="text-ink-2">Montaże</dt>
                <dd className="tabular text-right font-medium">{stats.milestones.editing}</dd>
                <dt className="text-ink-2">Akceptacje klienta</dt>
                <dd className="tabular text-right font-medium">{stats.milestones.approval + stats.approvals}</dd>
                <dt className="text-ink-2">Nowe zadania</dt>
                <dd className="tabular text-right font-medium">{stats.created}</dd>
                <dt className="text-ink-2">Spotkania w kalendarzu</dt>
                <dd className="tabular text-right font-medium">{hours(stats.minutes.meeting)}</dd>
                <dt className="text-ink-2">Nagrania w kalendarzu</dt>
                <dd className="tabular text-right font-medium">{hours(stats.minutes.recording)}</dd>
                <dt className="text-ink-2">Montaż w kalendarzu</dt>
                <dd className="tabular text-right font-medium">{hours(stats.minutes.editing)}</dd>
              </dl>
            </section>

            {/* Według klienta */}
            <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="cl-h">
              <h3 id="cl-h" className="mb-3 font-semibold">
                Według klienta
              </h3>
              {clientRows.length === 0 ? (
                <p className="text-sm text-ink-3">W tym tygodniu nic jeszcze nie ukończono.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[13px] text-ink-3">
                      <th className="pb-2 font-normal">Klient</th>
                      <th className="pb-2 text-right font-normal">Zadania</th>
                      <th className="pb-2 text-right font-normal">Publikacje</th>
                      <th className="pb-2 text-right font-normal">Produkcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientRows.map(([id, r]) => {
                      const c = id ? clientById.get(id) : undefined;
                      return (
                        <tr key={id ?? "none"} className="border-t border-line">
                          <td className="py-2">
                            <span className="inline-flex items-center gap-2">
                              {c ? <span className="size-2 rounded-full" style={{ background: colorVars(c.color).solid }} aria-hidden="true" /> : null}
                              {c?.name ?? "Bez klienta"}
                            </span>
                          </td>
                          <td className="tabular py-2 text-right">{r.tasks}</td>
                          <td className="tabular py-2 text-right">{r.pubs}</td>
                          <td className="tabular py-2 text-right">{r.prod}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: number | string; note: string; tone?: "danger" }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={cx("tabular mt-1 text-3xl font-semibold tracking-tight", tone === "danger" && "text-danger")}>{value}</p>
      <p className="mt-1 text-[13px] text-ink-3">{note}</p>
    </div>
  );
}

/** Słupki dni tygodnia: jedna seria w kolorze atramentu, wartość nad słupkiem po najechaniu / fokusie, tabela dla czytników. */
function DayBars({ values, max }: { values: number[]; max: number }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <>
      <div className="mt-4 grid h-44 grid-cols-7 items-end gap-2" role="img" aria-label={`Ukończone zadania: ${values.map((v, i) => `${DAYS[i]} ${v}`).join(", ")}`}>
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            tabIndex={0}
            aria-label={`${DAYS[i]}: ${v}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group relative flex h-full flex-col items-center justify-end focus:outline-none"
          >
            <span className={cx("tabular mb-1 text-[12px] text-ink transition-opacity", hover === i || v === max ? "opacity-100" : "opacity-0")}>{v}</span>
            <span
              className={cx("w-full max-w-10 rounded-t-[4px] bg-ink transition-[opacity] duration-150", hover !== null && hover !== i ? "opacity-40" : "opacity-90")}
              style={{ height: `${Math.max(v ? 4 : 2, (v / max) * 100)}%`, opacity: v ? undefined : 0.25 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 border-t border-line pt-2 text-center text-[12px] text-ink-3" aria-hidden="true">
        {DAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </>
  );
}
