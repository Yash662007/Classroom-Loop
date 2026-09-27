"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import { PageHeader } from "@/components/layout/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

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

  if (error) return <ErrorState message={error} />;
  if (!queue) return <CardSkeleton label="Loading queue…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence review"
        subtitle="Classroom evidence awaiting your review — support-need first. AI analysis is ready for each item; your review is the human decision."
      />

      {queue.length === 0 && (
        <EmptyState
          title="Queue is clear"
          body="Every submission has been reviewed. New evidence from your teachers appears here as it arrives."
        />
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
                  {q.hasFeedbackDraft && <span className="badge-neutral">AI draft ready</span>}                </div>
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
