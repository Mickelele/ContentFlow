export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-ink">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
        <rect x="6" y="7" width="7" height="3" rx="1.5" fill="var(--bg)" />
        <rect x="6" y="12" width="12" height="3" rx="1.5" fill="var(--bg)" opacity="0.7" />      </svg>
      {compact ? <span className="sr-only">ContentFlow</span> : <span>ContentFlow</span>}
    </span>
  );
}
