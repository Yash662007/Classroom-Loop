"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";

interface QueueItem {
  evidenceId: string;
  attemptNumber: number;
  teacher: { id: string; name: string };
  competencyTitle: string;
  submittedAt: string;
  hasFeedbackDraft: boolean;
  supportRecommended: boolean;
  topSupportSignal: string | null;
  preview: string;
}

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ queue: QueueItem[] }>("/api/mentor/queue")
      .then((d) => setQueue(d.queue))
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!queue) return <div className="card animate-pulse text-sm text-navy-900/50">Loading queue…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Review queue</h1>
        <p className="text-sm text-navy-900/60">
          Classroom evidence awaiting your review — support-need first. AI analysis is ready for each item; your review is the human decision.
        </p>
      </div>

      {queue.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-sm text-navy-900/60">Queue is clear — every submission has been reviewed. 🎉</p>
          <p className="text-xs text-navy-900/40 mt-1">New submissions from your teachers will appear here.</p>
        </div>
      )}

      <ul className="space-y-3">
        {queue.map((q) => (
          <li key={q.evidenceId} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{q.teacher.name}</span>
                  <span className="badge-neutral">Attempt {q.attemptNumber}</span>
                  <span className="badge-neutral">{q.competencyTitle}</span>
                  {q.topSupportSignal && <span className="badge-amber">{q.topSupportSignal}</span>}
                  {q.hasFeedbackDraft && <span className="badge-neutral">AI draft ready</span>}
                </div>
                <p className="text-xs text-navy-900/50 mb-2">
                  Submitted {new Date(q.submittedAt).toLocaleString()}
                </p>
                <p className="text-sm text-navy-900/75">“{q.preview}{q.preview.length >= 140 ? "…" : ""}”</p>
              </div>
              <Link href={`/mentor/review/${q.evidenceId}`} className="btn-primary shrink-0">
                Review &amp; respond →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
