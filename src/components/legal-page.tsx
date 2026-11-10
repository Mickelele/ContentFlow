import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { LEGAL } from "@/lib/legal";

/** Wspólny układ stron prawnych: logo, tytuł z datą, treść i stopka z linkami. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Link href="/" className="rounded-md">
          <Logo />
        </Link>
        <Link href="/logowanie" className="text-sm text-ink-2 underline-offset-4 hover:underline">
          Zaloguj się
        </Link>
      </header>
      <h1 className="border-l-[3px] border-accent pl-3.5 text-3xl leading-tight font-semibold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-3">Ostatnia aktualizacja: {LEGAL.updatedAt}</p>
      <div className="mt-8 flex flex-col gap-4 leading-relaxed text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
      <footer className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-sm text-ink-3">
        <Link href="/polityka-prywatnosci" className="hover:text-ink">
          Polityka prywatności
        </Link>
        <Link href="/regulamin" className="hover:text-ink">
          Regulamin
        </Link>
        <span>
          {LEGAL.appName} · {LEGAL.operator}
        </span>
      </footer>
    </main>
  );
}

export function ContactEmail() {
  return <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
}
