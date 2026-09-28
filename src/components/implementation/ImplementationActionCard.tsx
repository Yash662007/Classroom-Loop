import { Clock, Compass } from "lucide-react";

/**
 * Implementation action card (spec §13): one clear "next classroom step" with
 * context, objective, why it was recommended, an honest time estimate and a
 * single primary CTA (Principle 2 — one primary action).
 */
export function ImplementationActionCard({
  competency,
  contextLine,
  objective,
  why,
  estimatedMinutes,
  ctaLabel,
  ctaHref,
  statusBadge,
}: {
  competency: string;
  contextLine?: string | null;
  objective: string;
  why?: string | null;
  estimatedMinutes?: number;
  ctaLabel: string;
  ctaHref: string;
  statusBadge?: string;
}) {
  return (
    <section className="card border-l-4 border-l-primary-600" aria-label="Next implementation step">
      <p className="text-xs font-bold uppercase tracking-wider text-primary-600 mb-2">Next implementation step</p>
      <h2 className="text-xl font-bold text-navy-900">{competency}</h2>
      {contextLine && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Compass className="h-3.5 w-3.5" aria-hidden /> {contextLine}
        </p>
      )}

      <div className="mt-4 rounded-lg bg-softblue-50 border border-softblue-100 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Today’s action</p>
        <p className="text-sm text-navy-900/90 whitespace-pre-line">{objective}</p>
      </div>

      {why && (
        <details className="mt-3 group">
          <summary className="text-xs font-semibold text-primary-600 cursor-pointer select-none">
            Why this action?
          </summary>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{why}</p>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge && <span className="badge-neutral">{statusBadge}</span>}
          {estimatedMinutes != null && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" aria-hidden /> ~{estimatedMinutes} minutes
            </span>
          )}
        </div>
        <a href={ctaHref} className="btn-primary">
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
