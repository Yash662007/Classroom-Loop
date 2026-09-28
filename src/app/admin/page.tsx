"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import { FunnelBars } from "@/components/analytics/FunnelBars";

interface FunnelItem { stage: string; label: string; count: number; ofTeachers: number }
interface Metrics {
  tasksGenerated: number; practiceSessions: number; evidenceSubmitted: number; aiAnalyses: number;
  analysesBySource: { local_engine: number; llm: number };
  feedbackDrafted: number; feedbackSent: number; retriesStarted: number;
  avgTimeToFirstAttemptHours: number | null; avgFeedbackTurnaroundHours: number | null; supportFlaggedAnalyses: number;
}
interface Intervention { teachers: Array<{ id: string; name: string; signals: string[] }> }

export default function AdminOverviewPage() {
  const [funnel, setFunnel] = useState<FunnelItem[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [intervention, setIntervention] = useState<Intervention["teachers"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ funnel: FunnelItem[] }>("/api/analytics/funnel"),
      apiFetch<Metrics>("/api/analytics/implementation"),
      apiFetch<Intervention>("/api/analytics/support"),
    ])
      .then(([f, m, s]) => {
        setFunnel(f.funnel);
        setMetrics(m);
        setIntervention(s.teachers);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!funnel || !metrics || !intervention) return <div className="card animate-pulse text-sm text-navy-900/50">Loading analytics…</div>;

  const trained = funnel[0]?.count ?? 0;
  const evidence = funnel.find((f) => f.stage === "evidence")?.count ?? 0;
  const conversion = trained > 0 ? Math.round((evidence / trained) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">District overview</h1>
          <p className="text-sm text-navy-900/60">Implementation activity aggregates — training completion is the start, not the success metric.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/reports" className="btn-secondary">Cohort report →</Link>
          <span className="badge-amber">Demo data — simulated records</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Training-to-evidence conversion", value: `${conversion}%`, accent: true },
          { label: "Evidence submissions", value: metrics.evidenceSubmitted },
          { label: "Feedback sent", value: `${metrics.feedbackSent}/${metrics.feedbackDrafted} drafted` },
          { label: "Retries started", value: metrics.retriesStarted },
          { label: "Time to first attempt", value: metrics.avgTimeToFirstAttemptHours != null ? `${metrics.avgTimeToFirstAttemptHours}h` : "—" },
          { label: "Feedback turnaround", value: metrics.avgFeedbackTurnaroundHours != null ? `${metrics.avgFeedbackTurnaroundHours}h` : "—" },
          { label: "AI analyses", value: `${metrics.aiAnalyses} (${metrics.analysesBySource.llm} LLM / ${metrics.analysesBySource.local_engine} rubric)` },
          { label: "Support-flagged analyses", value: metrics.supportFlaggedAnalyses },
        ].map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-xl font-bold ${s.accent ? "text-teal-600" : "text-navy-900"}`}>{s.value}</p>
            <p className="text-xs text-navy-900/55 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="label mb-0">Training → practice funnel</h2>
            <Link href="/admin/funnel" className="text-xs text-primary-600 underline">Full funnel →</Link>
          </div>
          <FunnelBars funnel={funnel} />
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="label mb-0">Teachers needing support</h2>
            <Link href="/admin/support" className="text-xs text-primary-600 underline">Details →</Link>
          </div>
          {intervention.length === 0 ? (
            <p className="text-sm text-navy-900/55">No support signals right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {intervention.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <span className="font-medium">{t.name}</span>
                  <span className="block text-xs text-navy-900/55">{t.signals[0]}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-navy-900/40 mt-3">Signals for triage only — this is not a teacher ranking and never will be.</p>
        </div>
      </div>
    </div>
  );
}

