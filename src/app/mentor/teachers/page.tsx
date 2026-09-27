"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  context: { experience_years: number; multigrade: boolean; class_size: number | null; confidence: number; school_context: string | null } | null;
  adoptionStage: string;
  attempts: number;
  evidencePending: number;
  feedbackSent: number;
  supportRecommended: boolean;
  supportFlags: Array<{ signal: string; detail: string; severity: string }>;
}

const STAGE_LABEL: Record<string, string> = {
  not_started: "Not started", practised: "Practised", attempted: "Attempted", evidence_submitted: "Evidence submitted",
  feedback_received: "Feedback received", retried: "Retried", repeated: "Repeated", sustained: "Sustained",
};

export default function MentorTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ teachers: TeacherRow[] }>("/api/mentor/teachers")
      .then((d) => setTeachers(d.teachers))
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!teachers) return <div className="card animate-pulse text-sm text-navy-900/50">Loading teachers…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Assigned teachers</h1>
        <p className="text-sm text-navy-900/60">Ordered by support need — signals, not scores.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {teachers.map((t) => (
          <div key={t.id} className={`card ${t.supportRecommended ? "border-amber-300" : ""}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h2 className="font-bold text-navy-900 text-sm">{t.name}</h2>
                {t.context && (
                  <p className="text-xs text-navy-900/55 mt-0.5">
                    {t.context.experience_years} yrs · {t.context.multigrade ? "multi-grade" : "single-grade"} ·
                    class of {t.context.class_size ?? "?"} · confidence {t.context.confidence}/5
                  </p>
                )}
              </div>
              {t.supportRecommended && <span className="badge-amber shrink-0">Support suggested</span>}
            </div>
            <div className="flex flex-wrap gap-2 text-xs mb-3">
              <span className="badge-neutral">{STAGE_LABEL[t.adoptionStage] ?? t.adoptionStage}</span>
              <span className="badge-neutral">{t.attempts} attempt(s)</span>
              <span className="badge-neutral">{t.feedbackSent} feedback sent</span>
              {t.evidencePending > 0 && <span className="badge-amber">{t.evidencePending} to review</span>}
            </div>
            {t.supportFlags.length > 0 && (
              <ul className="text-xs text-navy-900/65 space-y-1 mb-3">
                {t.supportFlags.slice(0, 3).map((f, i) => (
                  <li key={i}>• {f.signal} — {f.detail}</li>
                ))}
              </ul>
            )}
            <Link href={`/mentor/teachers/${t.id}`} className="text-sm text-softblue-600 underline">Open implementation history →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
