import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";

/** Ekran modułu, który powstaje w kolejnym etapie — mówi wprost, co tu będzie. */
export function ComingSoon({
  title,
  description,
  stage,
  points,
  children,
}: {
  title: string;
  description: string;
  stage: string;
  points: string[];
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} description={description} />
      <section className="rounded-2xl bg-surface-2 p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Ten moduł powstaje w etapie {stage}</h2>
        <ul className="mt-4 flex flex-col gap-2.5 text-ink-2">
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        {children ? <div className="mt-6">{children}</div> : null}
      </section>
    </div>
  );
}
