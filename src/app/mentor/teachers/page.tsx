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
  email: string;
  context: { experience_years: number; multigrade: boolean; class_size: number | null; confidence: number; school_context: string | null } | null;
  adoptionStage: string;
  attempts: number;
  evidencePending: number;
  feedbackSent: number;
  supportRecommended: boolean;
  supportFlags: Array<{ signal: string; detail: string; severity: string }>;
}

export default function MentorTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ teachers: TeacherRow[] }>("/api/mentor/teachers")
      .then((d) => setTeachers(d.teachers))
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!teachers) return <CardSkeleton label="Loading teachers…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        subtitle="Ordered by support need — signals, not scores."
      />

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
            <Link href={`/mentor/teachers/${t.id}`} className="text-sm text-primary-600 underline">Open implementation history →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
