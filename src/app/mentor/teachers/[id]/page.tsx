"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client-api";

interface HistoryAttempt {
  attemptNumber: number;
  taskId: string;
  taskTitle: string;
  status: string;
  difficulty: string;
  createdAt: string;
  practice: { was_correct: boolean } | null;
  evidence: Array<{
    id: string;
    status: string;
    submittedAt: string;
    feedback: { status: string } | null;
  }>;
}

interface HistoryEntry {
  competency: { id: string; title: string };
  adoptionStage: string;
  attempts: HistoryAttempt[];
}

interface TeacherData {
  teacher: { id: string; name: string; email: string };
  history: HistoryEntry[];
}

const STAGE_LABEL: Record<string, string> = {
  not_started: "Not started", practised: "Practised", attempted: "Attempted", evidence_submitted: "Evidence submitted",
  feedback_received: "Feedback received", retried: "Retried", repeated: "Repeated", sustained: "Sustained",
};

export default function MentorTeacherHistoryPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<TeacherData | null>(null);
  const [queue, setQueue] = useState<Array<{ evidenceId: string; attemptNumber: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<TeacherData>(`/api/mentor/teachers/${params.id}/history`),
      apiFetch<{ queue: Array<{ evidenceId: string; attemptNumber: number; teacher: { id: string } }> }>("/api/mentor/queue"),
    ])
      .then(([d, q]) => {
        setData(d);
        setQueue(q.queue.filter((x) => x.teacher.id === params.id));
      })
      .catch((err) => setError((err as Error).message));
  }, [params.id]);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!data) return <div className="card animate-pulse text-sm text-navy-900/50">Loading history…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{data.teacher.name}</h1>
          <p className="text-sm text-navy-900/60">Implementation history — read-only view for mentors.</p>
        </div>
        <Link href="/mentor/teachers" className="btn-secondary">← All teachers</Link>
      </div>

      {queue.length > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-2">Awaiting your review</h2>
          <ul className="space-y-1 text-sm">
            {queue.map((q) => (
              <li key={q.evidenceId}>
                <Link href={`/mentor/review/${q.evidenceId}`} className="underline">
                  Attempt {q.attemptNumber} evidence → review now
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.history.length === 0 && (
        <div className="card text-sm text-navy-900/60">No implementation activity yet for this teacher.</div>
      )}

      {data.history.map((h) => (
        <div key={h.competency.id} className="card space-y-3">
          <div>
            <h2 className="text-lg font-bold text-navy-900">{h.competency.title}</h2>
            <p className="text-xs text-navy-900/60">Adoption: <span className="font-semibold">{STAGE_LABEL[h.adoptionStage] ?? h.adoptionStage}</span> · {h.attempts.length} attempt(s)</p>
          </div>
          <ol className="space-y-2">
            {h.attempts.map((a) => (
              <li key={a.taskId} className="border border-navy-900/10 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="badge-neutral">Attempt {a.attemptNumber}</span>
                  <span className="badge-neutral">{a.status}</span>
                  <span className="badge-neutral">{a.difficulty}</span>
                  <span className="text-xs text-navy-900/50">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-medium mb-1.5">{a.taskTitle}</p>
                <ul className="space-y-1 text-sm text-navy-900/70">
                  <li>{a.practice ? (a.practice.was_correct ? "✓ Practice completed (recommended strategy)" : "• Practice completed (different strategy)") : "• Practice not done"}</li>
                  {a.evidence.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2">
                      <span>✓ Evidence ({new Date(e.submittedAt).toLocaleDateString()})</span>
                      <Link href={`/mentor/review/${e.id}`} className="text-softblue-600 underline text-xs">Open review</Link>
                      {e.feedback && <span className={e.feedback.status === "sent" ? "badge-teal" : "badge-amber"}>Feedback {e.feedback.status}</span>}
                    </li>
                  ))}
                  {a.evidence.length === 0 && <li>• No evidence yet</li>}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
