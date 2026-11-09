import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { getSession, getWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Dziś" };

const TZ = "Europe/Warsaw";

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("pl-PL", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  if (hour < 5) return "Dobranoc";
  if (hour < 12) return "Dzień dobry";
  if (hour < 18) return "Cześć";
  return "Dobry wieczór";
}

export default async function TodayPage({ params }: PageProps<"/w/[slug]/dzis">) {
  const { slug } = await params;
  const ws = await getWorkspace(slug);
  const { supabase, profile } = await getSession();
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws.id)
    .is("archived_at", null);

  const now = new Date();
  const date = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="pb-8">
        <p className="text-ink-2 first-letter:uppercase">{date}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting(now)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      {count === 0 ? (
        <section className="mb-8 flex flex-col gap-4 rounded-2xl bg-ink p-6 text-bg sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-lg font-semibold">Zacznij od klientów</h2>
            <p className="mt-1 max-w-lg opacity-80">
              Każdy klient dostaje kolor i warstwę w kalendarzu. Wydarzenia, zadania i materiały przypiszesz do nich w kolejnych krokach.
            </p>
          </div>
          <Link
            href={`/w/${slug}/klienci/nowy`}
            className="pressable inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-bg px-4 text-sm font-medium text-ink sm:self-auto"
          >
            Dodaj klienta
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Dzisiejsze wydarzenia" empty="Nic w kalendarzu na dziś." href={`/w/${slug}/kalendarz`} cta="Otwórz kalendarz" />
        <div className="grid gap-4">
          <Panel title="Zadania na dziś" empty="Brak zadań z terminem na dziś." href={`/w/${slug}/zadania`} cta="Zadania" />
          <Panel title="Zaległe" empty="Nic zaległego." />
          <Panel title="Nadchodzące publikacje" empty="Brak zaplanowanych publikacji." href={`/w/${slug}/content`} cta="Content" />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, empty, href, cta }: { title: string; empty: string; href?: string; cta?: string }) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {href && cta ? (
          <Link href={href} className={buttonClass("ghost", "h-8 px-2.5 text-ink-2")}>
            {cta}
          </Link>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-ink-3">{empty}</p>
    </section>
  );
}
