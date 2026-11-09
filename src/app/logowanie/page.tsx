import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { isConfigured } from "@/lib/env";
import { colorVars, type ClientColor } from "@/lib/palette";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logowanie" };

const ERRORS: Record<string, string> = {
  google: "Nie udało się połączyć z Google. Spróbuj ponownie.",
  sesja: "Link wygasł albo został już użyty. Zaloguj się ponownie.",
};

export default async function LoginPage({ searchParams }: PageProps<"/logowanie">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const blad = typeof sp.blad === "string" ? ERRORS[sp.blad] : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-semibold tracking-tight">Zaloguj się</h1>
          <p className="mt-2 mb-8 text-ink-2">
            Nagrania, montaże i publikacje wszystkich klientów w jednym kalendarzu.
          </p>
          {!isConfigured ? (
            <p role="alert" className="mb-6 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
              Brak konfiguracji Supabase. Uzupełnij plik <code>.env.local</code> (instrukcja w README).
            </p>
          ) : null}
          <LoginForm next={next} initialError={blad} />
        </div>
        <p className="text-sm text-ink-3">ContentFlow · planer dla twórców</p>
      </section>

      <WeekPreview />
    </main>
  );
}

const DAYS = ["pon", "wt", "śr", "czw", "pt"];
const PREVIEW: { day: number; top: number; h: number; color: ClientColor; title: string; meta: string }[] = [
  { day: 0, top: 8, h: 26, color: "violet", title: "Nagrania HELINAT", meta: "9:00 · 5 rolek" },
  { day: 1, top: 30, h: 14, color: "violet", title: "Montaż rolki PPL(H)", meta: "13:00" },
  { day: 1, top: 62, h: 12, color: "pink", title: "Publikacja: przed / po", meta: "18:00 · Instagram" },
  { day: 2, top: 18, h: 14, color: "orange", title: "Spotkanie z klientem", meta: "11:00" },
  { day: 3, top: 10, h: 24, color: "pink", title: "Nagrania w salonie", meta: "10:00" },
  { day: 3, top: 48, h: 12, color: "teal", title: "Akceptacja: karuzela", meta: "15:00" },
  { day: 4, top: 56, h: 13, color: "violet", title: "Publikacja PPL(H)", meta: "17:00 · TikTok, IG" },
];

/** Dekoracyjny podgląd tygodnia — pokazuje, czym jest aplikacja, zanim się zalogujesz. */
function WeekPreview() {
  return (
    <aside aria-hidden="true" className="relative hidden overflow-hidden bg-surface-2 lg:block">
      <div className="absolute inset-y-10 right-0 left-12 rounded-l-2xl border border-r-0 border-line bg-surface p-6">
        <div className="grid h-full grid-cols-5 gap-3">
          {DAYS.map((d, i) => (
            <div key={d} className="flex flex-col">
              <p className="pb-3 text-sm text-ink-3">
                {d} <span className="tabular text-ink">{10 + i}</span>
              </p>
              <div className="relative flex-1 rounded-lg bg-surface-2/60">
                {PREVIEW.filter((e) => e.day === i).map((e) => {
                  const c = colorVars(e.color);
                  return (
                    <div
                      key={e.title}
                      className="absolute inset-x-1 overflow-hidden rounded-md px-2 py-1.5 text-xs leading-snug"
                      style={{ top: `${e.top}%`, height: `${e.h}%`, background: c.fill, color: c.ink }}
                    >
                      <p className="font-medium">{e.title}</p>
                      <p className="tabular opacity-80">{e.meta}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// Cała aplikacja zależy od sesji użytkownika, więc renderujemy ją na żądanie.
export const instant = false;
