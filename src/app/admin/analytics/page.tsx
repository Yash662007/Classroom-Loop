"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

interface Metrics {
  tasksGenerated: number; practiceSessions: number; evidenceSubmitted: number; aiAnalyses: number;
  analysesBySource: { local_engine: number; llm: number };
  feedbackDrafted: number; feedbackSent: number; retriesStarted: number;
  avgTimeToFirstAttemptHours: number | null; avgFeedbackTurnaroundHours: number | null; supportFlaggedAnalyses: number;
  funnelDropOff: Array<{ stage: string; label: string; teachers: number; stepDropOffPercent: number | null }>;
  llmUsage: { totalCalls: number; promptTokens: number; completionTokens: number; totalTokens: number; byArtifact: Array<{ artifactKind: string; calls: number; totalTokens: number }> };
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

      <div className="card">
        <h2 className="label">Drop-off by stage (where teachers are lost)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy-900/50">
                <th className="py-2 pr-4">Stage</th>
                <th className="py-2 pr-4">Teachers</th>
                <th className="py-2">Step drop-off</th>
              </tr>
            </thead>
            <tbody>
              {m.funnelDropOff.map((d) => (
                <tr key={d.stage} className="border-t border-navy-900/10">
                  <td className="py-2.5 pr-4 font-medium">{d.label}</td>
                  <td className="py-2.5 pr-4">{d.teachers}</td>
                  <td className={`py-2.5 ${d.stepDropOffPercent != null && d.stepDropOffPercent >= 50 ? "text-red-700 font-semibold" : ""}`}>
                    {d.stepDropOffPercent != null ? `${d.stepDropOffPercent}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-navy-900/40 mt-3">
          Drop-off = share of the previous stage&apos;s cohort not reaching this stage. Stage-to-stage loss, never a teacher ranking.
        </p>
      </div>

      <div className="card">
        <h2 className="label">LLM usage &amp; cost signal</h2>
        {m.llmUsage.totalCalls === 0 ? (
          <p className="text-sm text-navy-900/55">
            No LLM calls recorded — the deterministic rubric engine handled everything (or no provider is configured). Token usage appears here automatically when the LLM upgrade is active.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "LLM calls", value: m.llmUsage.totalCalls },
                { label: "Prompt tokens", value: m.llmUsage.promptTokens },
                { label: "Completion tokens", value: m.llmUsage.completionTokens },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 px-3 py-2.5 text-center">
                  <p className="text-lg font-bold text-navy-900">{s.value}</p>
                  <p className="text-xs text-navy-900/55">{s.label}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-navy-900/50">
                  <th className="py-2 pr-4">Artifact</th>
                  <th className="py-2 pr-4">Calls</th>
                  <th className="py-2">Total tokens</th>
                </tr>
              </thead>
              <tbody>
                {m.llmUsage.byArtifact.map((a) => (
                  <tr key={a.artifactKind} className="border-t border-navy-900/10">
                    <td className="py-2.5 pr-4 font-medium">{a.artifactKind.replace(/_/g, " ")}</td>
                    <td className="py-2.5 pr-4">{a.calls}</td>
                    <td className="py-2.5">{a.totalTokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card bg-softblue-50/60">
        <p className="text-xs text-navy-900/60">
          Metrics measure implementation activity — never teacher quality. The system produces no teacher scores or rankings by design.
        </p>
      </div>
    </div>
  );
}
