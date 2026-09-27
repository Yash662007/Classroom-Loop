"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import { STAGE_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/layout/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";

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

/** Actionable status line per teacher (spec §20). */
function teacherStatus(t: TeacherRow): { label: string; tone: string } {
  if (t.supportFlags.some((f) => f.severity === "alert")) return { label: "Repeated difficulty", tone: "badge-red" };
  if (t.evidencePending > 0) return { label: "Awaiting your review", tone: "badge-amber" };
  if (t.attempts > 0 && t.feedbackSent === 0) return { label: "Needs feedback", tone: "badge-amber" };
  if (t.attempts === 0) return { label: "Needs evidence", tone: "badge-neutral" };
  if (t.adoptionStage === "repeated" || t.adoptionStage === "sustained") return { label: "On track", tone: "badge-teal" };
  return { label: "On track", tone: "badge-teal" };
}

export default function MentorOverviewPage() {
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([
      apiFetch<{ teachers: TeacherRow[] }>("/api/mentor/teachers"),
      apiFetch<Cluster>("/api/mentor/cluster"),
    ])
      .then(([t, c]) => {
        setTeachers(t.teachers);
        setCluster(c);
      })
      .catch((err) => setError((err as Error).message));
  };

  useEffect(load, []);

  if (error && !teachers) return <ErrorState message={error} onRetry={load} />;
  if (!teachers || !cluster) return <CardSkeleton label="Loading your cluster…" />;

  const needsSupport = teachers.filter((t) => t.supportRecommended);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Who needs support right now?"
        subtitle="Support-first view of your assigned teachers. AI flags signals; you decide who needs attention."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Teachers needing support", value: cluster.totals.needsSupport, accent: cluster.totals.needsSupport > 0 },
          { label: "Awaiting your review", value: cluster.totals.pendingReviews },
          { label: "Feedback pending", value: teachers.filter((t) => t.attempts > 0 && t.feedbackSent === 0).length },
          { label: "Total attempts", value: cluster.totals.totalAttempts },
          { label: "Avg feedback turnaround", value: cluster.totals.avgTurnaroundHours != null ? `${cluster.totals.avgTurnaroundHours}h` : "—" },
        ].map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.accent ? "text-amber-600" : "text-navy-900"}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {needsSupport.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-3">This teacher may need support</h2>
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
                <Link href={`/mentor/teachers/${t.id}`} className="text-xs text-primary-600 underline">Open history →</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="label">All assigned teachers</h2>
        {teachers.length === 0 ? (
          <p className="text-sm text-slate-500">No teachers are assigned to you yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Teacher</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Adoption</th>
                  <th className="py-2 pr-4">Attempts</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => {
                  const status = teacherStatus(t);
                  return (
                    <tr key={t.id} className="border-t border-slate-200">
                      <td className="py-2.5 pr-4 font-medium">{t.name}</td>
                      <td className="py-2.5 pr-4"><span className={`badge ${status.tone}`}>{status.label}</span></td>
                      <td className="py-2.5 pr-4">{STAGE_LABEL[t.adoptionStage] ?? t.adoptionStage}</td>
                      <td className="py-2.5 pr-4">{t.attempts}</td>
                      <td className="py-2.5">
                        {t.evidencePending > 0 ? (
                          <Link href="/mentor/queue" className="text-primary-600 underline text-xs font-semibold">Review evidence →</Link>
                        ) : (
                          <Link href={`/mentor/teachers/${t.id}`} className="text-primary-600 underline text-xs">View history →</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
