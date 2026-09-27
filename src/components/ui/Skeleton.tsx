/** Loading skeleton (spec §23) — never leave blank areas while data loads. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Full-card skeleton used while a page's main data loads. */
export function CardSkeleton({ lines = 3, label = "Loading…" }: { lines?: number; label?: string }) {
  return (
    <div className="card space-y-3" role="status" aria-label={label}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i % 2 === 0 ? "h-3.5 w-full" : "h-3.5 w-4/5"} />
      ))}
    </div>
  );
}
