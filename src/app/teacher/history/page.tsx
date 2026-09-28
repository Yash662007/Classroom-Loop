"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import { STAGE_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImplementationTimeline } from "@/components/implementation/ImplementationTimeline";
import type { TimelineEvent } from "@/components/implementation/ImplementationTimeline";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface HistoryAttempt {
  attemptNumber: number;
  taskId: string;
  taskTitle: string;
  status: string;
  difficulty: string;
  createdAt: string;
  practice: { chosen_option: number; was_correct: boolean; completed_at: string } | null;
  evidence: Array<{
    id: string;
    reflection: string;
    status: string;
    submittedAt: string;
    analysis: { source: string; generatedAt: string; criterionHits: Array<{ label: string; hit: boolean }>; supportRecommended: boolean } | null;
    feedback: { status: string; sentMessage: string | null; sentAt: string | null } | null;
  }>;
}

interface HistoryEntry {
  competency: { id: string; title: string };
  adoptionStage: string;
  attempts: HistoryAttempt[];
}

/** The implementation journey stages shown as progress (spec §18). */
const JOURNEY = [
  { key: "train", label: "Training" },
  { key: "practise", label: "Practice" },
  { key: "apply", label: "Classroom attempts" },
  { key: "evidence", label: "Evidence" },
  { key: "feedback", label: "Feedback" },
  { key: "retry", label: "Retry" },
  { key: "adopt", label: "Adoption" },
];

function HistoryInner() {
  const searchParams = useSearchParams();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<{ history: HistoryEntry[] }>("/api/teacher/history");
      setHistory(data.history);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Retry Coach deep-link (GOAL 28): /teacher/history?retry=<competencyId>
  // starts the coached retry immediately after the history loads.
  const retryParam = searchParams.get("retry");
  const autoRetryDone = useRef(false);
  useEffect(() => {
    if (retryParam && history && !autoRetryDone.current) {
      autoRetryDone.current = true;
      const entry = history.find((h) => h.competency.id === retryParam);
      const canRetry =
        entry &&
        entry.attempts.some((a) => a.evidence.length > 0) &&
        !entry.attempts.some((a) => a.status !== "completed");
      if (entry && canRetry) void retry(retryParam);
      else
        setRetryMsg(
          entry && !canRetry
            ? "This attempt is still in progress or awaiting feedback — finish it before starting another."
            : null
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryParam, history]);

  async function retry(competencyId: string) {
    setRetrying(competencyId);
    setRetryMsg(null);
    setError(null);
    try {
      await apiFetch("/api/implementation/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competency_id: competencyId, note: "Starting another attempt after feedback." }),
      });
      setRetryMsg("New attempt created — your personalized task is ready.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRetrying(null);
    }
  }

  if (error && !history) return <ErrorState message={error} onRetry={load} />;
  if (!history) return <CardSkeleton label="Loading your implementation journey…" />;

  // Unified chronological timeline across all competencies (spec §19).
  const events: TimelineEvent[] = [];
  for (const h of history) {
    for (const a of h.attempts) {
      events.push({
        at: a.createdAt,
        label: a.attemptNumber > 1 ? `Attempt ${a.attemptNumber} (retry)` : "Attempt 1 assigned",
        detail: h.competency.title,
        kind: a.attemptNumber > 1 ? "retry" : "attempt",
        done: true,
      });
      if (a.practice) {
        events.push({
          at: a.practice.completed_at,
          label: "Practice completed",
          detail: a.practice.was_correct ? "Recommended strategy chosen" : "Different strategy chosen",
          kind: "practice",
          done: true,
        });
      }
      for (const e of a.evidence) {
        events.push({ at: e.submittedAt, label: "Evidence submitted", kind: "evidence", done: true });
        if (e.analysis) {
          events.push({
            at: e.analysis.generatedAt,
            label: "AI insight generated",
            detail: `${e.analysis.criterionHits.filter((c) => c.hit).length}/${e.analysis.criterionHits.length} rubric criteria evidenced`,
            kind: "ai",
            done: true,
          });
        }
        if (e.feedback?.sentAt) {
          events.push({ at: e.feedback.sentAt, label: "Mentor feedback received", kind: "mentor", done: true });
        }
      }
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress & history"
        subtitle="Your implementation journey — every attempt, its evidence, AI insight and mentor feedback, persisted."
      />

      {retryMsg && (
        <div className="rounded-lg bg-teal-50 border border-teal-200 text-teal-600 text-sm px-3 py-2.5">{retryMsg}</div>
      )}
      {error && <ErrorState message={error} onRetry={load} />}

      {history.length === 0 && (
        <EmptyState
          title="No implementation history yet"
          body="Your journey starts with the competency check. After your first classroom attempt, everything you do shows up here."
          action={<Link href="/teacher/competencies" className="btn-primary">Go to competencies</Link>}
        />
      )}

      {/* Progress per competency (real data, not decorative percentages). */}
      {history.map((h) => {
        const stageIndex = Object.keys(STAGE_LABEL).indexOf(h.adoptionStage);
        const attemptsDone = h.attempts.length > 0;
        const evidenceDone = h.attempts.some((a) => a.evidence.length > 0);
        const feedbackDone = h.attempts.some((a) => a.evidence.some((e) => e.feedback?.status === "sent"));
        const practiceDone = h.attempts.some((a) => a.practice);
        const retryDone = h.attempts.length > 1;
        const stageDone: Record<string, boolean> = {
          train: true,
          practise: practiceDone,
          apply: attemptsDone,
          evidence: evidenceDone,
          feedback: feedbackDone,
          retry: retryDone,
          adopt: stageIndex >= 6,
        };
        const canRetry = evidenceDone && !h.attempts.some((a) => a.status !== "completed");
        const isCoachTarget = retryParam === h.competency.id;

        return (
          <div key={h.competency.id} className={`card space-y-5 ${isCoachTarget ? "border-blue-300 ring-1 ring-blue-200" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-navy-900">
                  {h.competency.title}
                  {isCoachTarget && <span className="badge-blue ml-2">Retry coach</span>}
                </h2>
                <p className="text-xs text-slate-500">
                  Adoption: <span className="font-semibold text-navy-900">{STAGE_LABEL[h.adoptionStage]}</span> · {h.attempts.length} attempt(s)
                </p>
              </div>
              <button
                type="button"
                className="btn-teal"
                disabled={!canRetry || retrying === h.competency.id}
                onClick={() => retry(h.competency.id)}
              >
                {retrying === h.competency.id ? "Creating…" : "Try it again (new attempt)"}
              </button>
            </div>

            <div>
              <h3 className="label">Your implementation journey</h3>
              <div className="space-y-2.5">
                {JOURNEY.map((j) => (
                  <div key={j.key} className="flex items-center gap-3">
                    <span className={`w-40 shrink-0 text-xs ${stageDone[j.key] ? "text-navy-900 font-medium" : "text-slate-400"}`}>
                      {stageDone[j.key] ? "✓ " : "○ "}{j.label}
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden" aria-hidden>
                      <div
                        className={`h-full rounded-full ${stageDone[j.key] ? "bg-teal-600" : "bg-softblue-200"}`}
                        style={{ width: stageDone[j.key] ? "100%" : "0%" }}
                      />
                    </div>
                    <span className={`w-16 text-right text-[11px] ${stageDone[j.key] ? "text-teal-600 font-semibold" : "text-slate-400"}`}>
                      {stageDone[j.key] ? "Done" : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!canRetry && evidenceDone && (
              <p className="text-xs text-slate-500">An attempt is still in progress — finish it before starting a retry.</p>
            )}
          </div>
        );
      })}

      {events.length > 0 && (
        <div className="card">
          <h2 className="label">Implementation history</h2>
          <ImplementationTimeline events={events} />
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<CardSkeleton label="Loading your implementation journey…" /> }>
      <HistoryInner />
    </Suspense>
  );
}
