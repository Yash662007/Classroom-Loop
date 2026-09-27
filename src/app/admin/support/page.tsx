"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import { STAGE_LABEL } from "@/lib/labels";

interface InterventionTeacher {
  id: string;
  name: string;
  signals: string[];
  adoptionStage: string;
  attempts: number;
  evidencePending: number;
}

export default function SupportPage() {
  const [teachers, setTeachers] = useState<InterventionTeacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ teachers: InterventionTeacher[] }>("/api/analytics/support")
      .then((d) => setTeachers(d.teachers))
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!teachers) return <div className="card animate-pulse text-sm text-navy-900/50">Loading support signals…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Support &amp; intervention</h1>
          <p className="text-sm text-navy-900/60">
            Rule-based support signals for triage. There is deliberately no score and no ranking — teachers appear when signals suggest support would help.
          </p>
        </div>
        <span className="badge-amber">Demo data — simulated records</span>
      </div>

      {teachers.length === 0 && (
        <div className="card text-sm text-navy-900/60">No support signals right now — all activity looks healthy.</div>
      )}

      <ul className="space-y-3">
        {teachers.map((t) => (
          <li key={t.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-navy-900 text-sm">{t.name}</h2>
                <div className="flex flex-wrap gap-2 text-xs mt-1.5 mb-2">
                  <span className="badge-neutral">{STAGE_LABEL[t.adoptionStage] ?? t.adoptionStage}</span>
                  <span className="badge-neutral">{t.attempts} attempt(s)</span>
                  {t.evidencePending > 0 && <span className="badge-amber">{t.evidencePending} awaiting review</span>}
                </div>
                <ul className="text-xs text-navy-900/65 space-y-1">
                  {t.signals.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
              <Link href={`/mentor/teachers/${t.id}`} className="btn-secondary shrink-0 text-xs">Open history (mentor view) →</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
