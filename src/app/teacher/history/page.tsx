"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";

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
    analysis: { source: string; criterionHits: Array<{ label: string; hit: boolean }>; supportRecommended: boolean } | null;
    feedback: { status: string; sentMessage: string | null; sentAt: string | null } | null;
  }>;
}

interface HistoryEntry {
  competency: { id: string; title: string };
  adoptionStage: string;
  attempts: HistoryAttempt[];
}

const STAGE_LABEL: Record<string, string> = {
  not_started: "Not started",
  practised: "Practised",
  attempted: "Attempted",
  evidence_submitted: "Evidence submitted",
  feedback_received: "Feedback received",
  retried: "Retried",
  repeated: "Repeated",
  sustained: "Sustained",
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
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

  if (error && !history) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!history) return <div className="card animate-pulse text-sm text-navy-900/50">Loading history…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Implementation history</h1>
        <p className="text-sm text-navy-900/60">Every attempt, its evidence, AI insight and mentor feedback — the full journey, persisted.</p>
      </div>

      {retryMsg && <div className="rounded-lg bg-teal-50 border border-teal-200 text-teal-600 text-sm px-3 py-2.5">{retryMsg}</div>}
      {error && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{error}</div>}

      {history.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-sm text-navy-900/60 mb-3">No implementation history yet — your journey starts with the competency check.</p>
          <Link href="/teacher/competencies" className="btn-primary">Go to competencies →</Link>
        </div>
      )}

      {history.map((h) => {
        const canRetry =
          h.attempts.some((a) => a.evidence.length > 0) &&
          !h.attempts.some((a) => a.status !== "completed");
        return (
          <div key={h.competency.id} className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-navy-900">{h.competency.title}</h2>
                <p className="text-xs text-navy-900/60">
                  Adoption: <span className="font-semibold">{STAGE_LABEL[h.adoptionStage] ?? h.adoptionStage}</span> · {h.attempts.length} attempt(s)
                </p>
              </div>
              <button type="button" className="btn-teal" disabled={!canRetry || retrying === h.competency.id} onClick={() => retry(h.competency.id)}>
                {retrying === h.competency.id ? "Creating…" : "Retry with a new attempt"}
              </button>
            </div>
            {!canRetry && h.attempts.some((a) => a.evidence.length > 0) && (
              <p className="text-xs text-navy-900/50">An attempt is still in progress — finish it before starting a retry.</p>
            )}

            <ol className="space-y-3">
              {h.attempts.map((a) => (
                <li key={a.taskId} className="border border-navy-900/10 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="badge-neutral">Attempt {a.attemptNumber}</span>
                    <span className="badge-neutral">{a.status}</span>
                    <span className="badge-neutral">{a.difficulty}</span>
                    <span className="text-xs text-navy-900/50">{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium mb-2">{a.taskTitle}</p>
                  <ul className="space-y-1 text-sm text-navy-900/70">
                    <li>
                      {a.practice ? (a.practice.was_correct ? "✓ Practice completed" : "• Practice completed (different strategy chosen)") : "• Practice not done"}
                    </li>
                    {a.evidence.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-2">
                        <span>{e.analysis ? "✓ Evidence analyzed" : "• Evidence submitted"}</span>
                        <Link href={`/teacher/evidence/${e.id}`} className="text-softblue-600 underline text-xs">View AI insight</Link>
                        {e.feedback && (
                          <span className={e.feedback.status === "sent" ? "badge-teal" : "badge-amber"}>
                            Feedback {e.feedback.status}
                          </span>
                        )}
                      </li>
                    ))}
                    {a.evidence.length === 0 && <li>• No evidence submitted yet</li>}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
