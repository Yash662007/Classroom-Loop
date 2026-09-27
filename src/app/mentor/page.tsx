"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";

interface TeacherRow {
  id: string;
  name: string;
  adoptionStage: string;
  attempts: number;
  evidencePending: number;
  feedbackSent: number;
  supportRecommended: boolean;
  supportFlags: Array<{ signal: string; detail: string; severity: string }>;
}

interface Cluster {
  totals: {
    teachers: number; needsSupport: number; pendingReviews: number; totalAttempts: number;
    totalFeedback: number; avgTurnaroundHours: number | null;
  };
  byStage: Record<string, number>;
}

const STAGE_LABEL: Record<string, string> = {
  not_started: "Not started", practised: "Practised", attempted: "Attempted", evidence_submitted: "Evidence submitted",
  feedback_received: "Feedback received", retried: "Retried", repeated: "Repeated", sustained: "Sustained",
};

export default function MentorOverviewPage() {
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ teachers: TeacherRow[] }>("/api/mentor/teachers"),
      apiFetch<Cluster>("/api/mentor/cluster"),
    ])
      .then(([t, c]) => {
        setTeachers(t.teachers);
        setCluster(c);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!teachers || !cluster) return <div className="card animate-pulse text-sm text-navy-900/50">Loading your cluster…</div>;

  const needsSupport = teachers.filter((t) => t.supportRecommended);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Mentor overview</h1>
        <p className="text-sm text-navy-900/60">Support-first view of your assigned teachers. AI flags; you decide who needs attention.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Teachers", value: cluster.totals.teachers },
          { label: "Need support", value: cluster.totals.needsSupport, accent: cluster.totals.needsSupport > 0 },
          { label: "Awaiting review", value: cluster.totals.pendingReviews },
          { label: "Attempts", value: cluster.totals.totalAttempts },
          { label: "Avg turnaround", value: cluster.totals.avgTurnaroundHours != null ? `${cluster.totals.avgTurnaroundHours}h` : "—" },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-2xl font-bold ${s.accent ? "text-amber-600" : "text-navy-900"}`}>{s.value}</p>
            <p className="text-xs text-navy-900/55 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {needsSupport.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-3">Teachers needing support</h2>
          <ul className="space-y-2">
            {needsSupport.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <Link href={`/mentor/teachers/${t.id}`} className="font-semibold underline">{t.name}</Link>
                  {t.evidencePending > 0 && <span className="badge-amber ml-2">{t.evidencePending} awaiting review</span>}
                  {t.supportFlags.slice(0, 2).map((f, i) => (
                    <span key={i} className={`ml-2 ${f.severity === "alert" ? "badge-red" : "badge-amber"}`}>{f.signal}</span>
                  ))}
                </span>
                <Link href={`/mentor/teachers/${t.id}`} className="text-xs text-softblue-600 underline">Open history →</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="label">Adoption stages across your teachers</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(cluster.byStage).length === 0 && <p className="text-sm text-navy-900/50">No implementation activity yet.</p>}
          {Object.entries(cluster.byStage).map(([stage, n]) => (
            <span key={stage} className="badge-neutral">{STAGE_LABEL[stage] ?? stage}: {n}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="label">All assigned teachers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy-900/50">
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Adoption</th>
                <th className="py-2 pr-4">Attempts</th>
                <th className="py-2 pr-4">Feedback sent</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-t border-navy-900/10">
                  <td className="py-2.5 pr-4 font-medium">{t.name}</td>
                  <td className="py-2.5 pr-4">{STAGE_LABEL[t.adoptionStage] ?? t.adoptionStage}</td>
                  <td className="py-2.5 pr-4">{t.attempts}</td>
                  <td className="py-2.5 pr-4">{t.feedbackSent}</td>
                  <td className="py-2.5 text-right">
                    <Link href={`/mentor/teachers/${t.id}`} className="text-softblue-600 underline text-xs">History</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
