// Szkielet treści: powłoka (panel boczny, pasek na telefonie) zostaje na miejscu,
// a dane strony dociągają się w tle — nawigacja między modułami jest natychmiastowa.
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie">
      <div className="h-8 w-48 rounded-lg bg-surface-3" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-surface-2" />
      <div className="mt-10 flex flex-col gap-3">
        <div className="h-16 rounded-2xl bg-surface-2" />
        <div className="h-16 rounded-2xl bg-surface-2" />
        <div className="h-16 rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
