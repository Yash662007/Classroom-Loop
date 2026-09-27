"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

interface Metrics {
  tasksGenerated: number; practiceSessions: number; evidenceSubmitted: number; aiAnalyses: number;
  analysesBySource: { local_engine: number; llm: number };
  feedbackDrafted: number; feedbackSent: number; retriesStarted: number;
  avgTimeToFirstAttemptHours: number | null; avgFeedbackTurnaroundHours: number | null; supportFlaggedAnalyses: number;
}

export default function ImplementationAnalyticsPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Metrics>("/api/analytics/implementation").then(setM).catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!m) return <div className="card animate-pulse text-sm text-navy-900/50">Loading metrics…</div>;

  const draftSendRate = m.feedbackDrafted > 0 ? Math.round((m.feedbackSent / m.feedbackDrafted) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Implementation analytics</h1>
          <p className="text-sm text-navy-900/60">Activity across the loop: tasks, practice, evidence, AI, feedback, retries.</p>
        </div>
        <span className="badge-amber">Demo data — simulated records</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Implementation tasks generated", value: m.tasksGenerated },
          { label: "Practice sessions completed", value: m.practiceSessions },
          { label: "Evidence submissions", value: m.evidenceSubmitted },
          { label: "AI analyses run", value: `${m.aiAnalyses} (${m.analysesBySource.llm} LLM / ${m.analysesBySource.local_engine} rubric engine)` },
          { label: "Feedback drafts → sent", value: `${m.feedbackDrafted} → ${m.feedbackSent} (${draftSendRate}%)` },
          { label: "Retry attempts started", value: m.retriesStarted },
          { label: "Avg time to first attempt", value: m.avgTimeToFirstAttemptHours != null ? `${m.avgTimeToFirstAttemptHours} h after training` : "—" },
          { label: "Avg feedback turnaround", value: m.avgFeedbackTurnaroundHours != null ? `${m.avgFeedbackTurnaroundHours} h after evidence` : "—" },
          { label: "Analyses with support flags", value: m.supportFlaggedAnalyses },
        ].map((s) => (
          <div key={s.label} className="card py-4">
            <p className="text-lg font-bold text-navy-900">{s.value}</p>
            <p className="text-xs text-navy-900/55 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card bg-softblue-50/60">
        <p className="text-xs text-navy-900/60">
          Metrics measure implementation activity — never teacher quality. The system produces no teacher scores or rankings by design.
        </p>
      </div>
    </div>
  );
}
