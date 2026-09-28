"use client";

/**
 * Retry Coach (Master Task GOAL 28): after feedback, connect the next attempt
 * to the previous attempt + AI insight + mentor feedback. One focused
 * improvement — never "you failed" framing (GOAL 8).
 */
import { useMemo } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";

export interface RetryCoachInput {
  competencyId: string;
  attemptNumber: number;
  feedbackMessage: string | null;
  aiRecommendation: string[];
  /** One-line summary of what the teacher reported last time. */
  previousReflection: string;
  /** Whether a retry task already exists for this competency. */
  retryAvailable: boolean;
}

export function RetryCoach({ competencyId, attemptNumber, feedbackMessage, aiRecommendation, previousReflection, retryAvailable }: RetryCoachInput) {
  const focus = useMemo(() => {
    // First AI recommendation = the focused improvement (rubric engine orders them).
    const rec = aiRecommendation[0] ?? null;
    return rec ?? feedbackMessage?.split("\n").find((l) => l.trim().length > 20) ?? null;
  }, [aiRecommendation, feedbackMessage]);

  if (!retryAvailable) return null;

  return (
    <div className="card border-blue-200 bg-white" data-testid="retry-coach">
      <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-2">{t("retry.plan")}</h2>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs font-semibold text-navy-900/50 uppercase">Previous attempt</dt>
          <dd className="text-navy-900/80">“{previousReflection.slice(0, 180)}{previousReflection.length > 180 ? "…" : ""}”</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-navy-900/50 uppercase">{t("retry.focus")}</dt>
          <dd className="text-navy-900/90">{focus ?? "One focused improvement from your feedback"}</dd>
        </div>
      </dl>
      <Link
        href={`/teacher/history?retry=${encodeURIComponent(competencyId)}`}
        className="btn-primary mt-4 inline-block"
      >
        {t("retry.start")} (attempt {attemptNumber + 1}) →
      </Link>
    </div>
  );
}
