"use client";

/**
 * Evidence quality assistant (Master Task GOAL 15).
 * Non-blocking pre-submission nudge: shows what the reflection already covers
 * and what one extra line would add. Never rejects evidence (GOAL 25) — it
 * explains why a little more detail improves the AI insight and mentor
 * feedback, then gets out of the way.
 */
import { CheckCircle2, CircleAlert } from "lucide-react";
import { t } from "@/lib/i18n";

const OUTCOME_RE =
  /(after|then|respond|answered|answer|noticed|result|happened|next time|raised|said|participation|quiet|wrote|discussed)/i;

export interface QualityResult {
  ok: boolean;
  checks: Array<{ passed: boolean; label: string }>;
  suggestion: string | null;
}

/** Pure heuristic check — no network, runs as the teacher types. */
export function evaluateEvidenceQuality(reflection: string, checklistCount: number): QualityResult {
  const text = reflection.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const checks = [
    { passed: words >= 25, label: "Technique attempted and described" },
    { passed: OUTCOME_RE.test(text), label: "What happened / how students responded" },
    { passed: checklistCount > 0, label: "Quick checklist of what you tried" },
  ];
  const suggestion =
    !checks[1].passed && words >= 10
      ? t("quality.missing.after")
      : words < 25
        ? t("quality.missing.short")
        : !checks[2].passed
          ? t("quality.missing.checklist")
          : null;
  return { ok: checks.every((c) => c.passed), checks, suggestion };
}

export function QualityCheck({ reflection, checklistCount }: { reflection: string; checklistCount: number }) {
  if (reflection.trim().length === 0) return null;
  const result = evaluateEvidenceQuality(reflection, checklistCount);
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-sm ${
        result.ok ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-softblue-100 border-softblue-300 text-navy-900/80"
      }`}
      data-testid="quality-check"
    >
      <p className="font-semibold text-xs uppercase tracking-wide mb-1.5">{t("quality.title")}</p>
      <ul className="space-y-1">
        {result.checks.map((c) => (
          <li key={c.label} className="flex items-start gap-1.5">
            {c.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-teal-600" aria-label="covered" />
            ) : (
              <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" aria-label="missing" />
            )}
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      {result.suggestion && <p className="mt-2 text-xs text-navy-900/60">{result.suggestion} {t("quality.hint")}</p>}
    </div>
  );
}
