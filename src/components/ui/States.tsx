/**
 * Empty state (spec §24): explains why a section is empty and offers the
 * natural next action — never a bare empty table.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card text-center py-10">
      <h3 className="text-sm font-bold text-navy-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Error state (spec §25): human-readable message plus a retry action,
 * never raw HTTP codes or stack traces.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card border-red-200 bg-red-50/70 text-center py-8" role="alert">
      <h3 className="text-sm font-bold text-red-700 mb-1">Something went wrong</h3>
      <p className="text-sm text-red-700/80 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
