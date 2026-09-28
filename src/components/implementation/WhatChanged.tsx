"use client";

/**
 * "What changed?" attempt comparison (Master Task GOAL 29).
 * Side-by-side view of two consecutive attempts. All items are phrased as
 * what the teacher reported or what the AI inferred — never as objective
 * measurement (GOAL 60). The mentor note closes the card.
 */
import { t } from "@/lib/i18n";

export interface AttemptSummary {
  attemptNumber: number;
  reflection: string;
  rubricHits: string[];
}

export function WhatChanged({ before, after, mentorNote }: { before: AttemptSummary; after: AttemptSummary; mentorNote?: string | null }) {
  return (
    <div className="card" data-testid="what-changed">
      <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wide mb-3">{t("changed.title")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {[before, after].map((a, i) => (
          <div key={a.attemptNumber} className={`rounded-lg border px-3 py-2.5 ${i === 1 ? "border-teal-300 bg-teal-50/50" : "border-slate-200 bg-white"}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-navy-900/50 mb-1.5">
              {i === 1 ? "Now" : "Before"} · attempt {a.attemptNumber}
            </p>
            <p className="text-sm text-navy-900/80 whitespace-pre-wrap">
              “{a.reflection.slice(0, 220)}{a.reflection.length > 220 ? "…" : ""}”
            </p>
            {a.rubricHits.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {a.rubricHits.slice(0, 4).map((h) => (
                  <li key={h} className="text-xs text-teal-700 flex items-start gap-1">
                    <span aria-hidden>✓</span> {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-navy-900/45 mt-3">{t("changed.disclaimer")}</p>
      {mentorNote && (
        <div className="mt-3 rounded-lg bg-softblue-100 px-3 py-2 text-sm text-navy-900/80">
          <span className="text-xs font-bold uppercase tracking-wide text-blue-600">Mentor note</span>
          <p className="whitespace-pre-wrap">{mentorNote}</p>
        </div>
      )}
    </div>
  );
}
