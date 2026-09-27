"use client";

import { AlertTriangle, Eye, Lightbulb, Sparkles } from "lucide-react";

/**
 * AI insight card (spec §14/§36) — the single visual language for AI output.
 *
 * Trust contract, always visible: Observed (what the evidence shows) is
 * separated from Interpreted (AI reading, not fact) and Recommended (a
 * suggestion). A human — the mentor — decides what happens next.
 */

export interface AnalysisInsight {
  observed: string[];
  interpretation: string[];
  recommendation: string[];
  criterionHits: Array<{ label: string; hit: boolean; evidence: string[] }>;
  supportFlags: Array<{ signal: string; detail: string; severity: string }>;
  supportRecommended: boolean;
  source: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  alert: "badge-red",
  watch: "badge-amber",
  info: "badge-neutral",
};

function BulletList({ items, tone }: { items: string[]; tone: "observed" | "interpreted" | "recommended" }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nothing recorded for this part.</p>;
  }
  const color =
    tone === "recommended" ? "bg-teal-600" : tone === "observed" ? "bg-navy-900/40" : "bg-amber-400";
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-navy-900/85">
          <span aria-hidden className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AIInsightCard({
  analysis,
  variant = "full",
  footer,
}: {
  analysis: AnalysisInsight;
  /** full = all sections · mentor = compact criterion view for review · insight = strength/gap/next-step summary */
  variant?: "full" | "mentor" | "insight";
  footer?: React.ReactNode;
}) {
  const strengths = analysis.criterionHits.filter((c) => c.hit);
  const gaps = analysis.criterionHits.filter((c) => !c.hit);
  const hasFlags = analysis.supportFlags.length > 0;

  return (
    <section
      aria-label="AI insight"
      className={`card border-softblue-200 ${analysis.supportRecommended ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-softblue-300"}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-600">
          <Sparkles className="h-4 w-4" aria-hidden />
          AI Insight
        </p>
        <span className="text-[11px] text-slate-500">
          {analysis.source === "llm" ? "AI-assisted · mentor review required" : "Rubric engine · mentor review required"}
        </span>
      </header>

      {variant !== "mentor" && (
        <div className="space-y-4">
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              <Eye className="h-3.5 w-3.5" aria-hidden /> What appears to have happened
            </h4>
            <BulletList items={analysis.observed} tone="observed" />
          </div>
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Interpreted <span className="normal-case font-normal">(AI reading — not fact)</span>
            </h4>
            <BulletList items={analysis.interpretation} tone="interpreted" />
          </div>
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-600 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Suggested next step
            </h4>
            <BulletList items={analysis.recommendation} tone="recommended" />
          </div>
        </div>
      )}

      {variant === "insight" && (strengths.length > 0 || gaps.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {strengths.length > 0 && (
            <div className="rounded-lg bg-teal-50 border border-teal-100 p-3">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Strength</p>
              <ul className="text-sm text-navy-900/85 space-y-1">
                {strengths.slice(0, 3).map((c) => <li key={c.label}>{c.label}</li>)}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div className="rounded-lg bg-softblue-50 border border-softblue-100 p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Possible improvement</p>
              <ul className="text-sm text-navy-900/85 space-y-1">
                {gaps.slice(0, 3).map((c) => <li key={c.label}>{c.label}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {variant === "full" && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Rubric check</h4>
          <ul className="grid sm:grid-cols-2 gap-2">
            {analysis.criterionHits.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                <span className={`badge shrink-0 ${c.hit ? "badge-teal" : "badge-neutral"}`}>
                  {c.hit ? "Evidence seen" : "Not evident"}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{c.label}</span>
                  {c.evidence.length > 0 && (
                    <span className="block text-xs text-slate-500 truncate">“{c.evidence[0]}”</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasFlags && variant !== "mentor" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">Support signals noticed</h4>
          <ul className="space-y-1.5 text-sm">
            {analysis.supportFlags.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className={`badge shrink-0 ${SEVERITY_BADGE[f.severity] ?? "badge-neutral"}`}>{f.severity}</span>
                <span className="font-medium">{f.signal}</span>
                <span className="text-navy-900/70">{f.detail}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-2">
            Signals are shared with your mentor to offer the right support — never used to rank or score teachers.
          </p>
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <p className="text-[11px] italic text-slate-500">AI-assisted insight — mentor review recommended.</p>
        {footer}
      </footer>
    </section>
  );
}
