"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/client-api";

interface EvidenceView {
  id: string;
  taskId: string;
  attemptNumber: number;
  reflection: string;
  voiceNote: string | null;
  checklist: Record<string, boolean>;
  photoPath: string | null;
  hasPhoto: boolean;
  status: string;
  submittedAt: string;
}

interface AnalysisView {
  id: string;
  observed: string[];
  interpretation: string[];
  recommendation: string[];
  criterionHits: Array<{ label: string; hit: boolean; evidence: string[] }>;
  supportFlags: Array<{ signal: string; detail: string; severity: string }>;
  supportRecommended: boolean;
  source: string;
  generatedAt: string;
}

interface FeedbackView {
  status: string;
  message: string | null;
  sentAt: string | null;
  editedByMentor: boolean;
  draftedBy: string;
}

export default function EvidenceInsightPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{ evidence: EvidenceView; analysis: AnalysisView | null; feedback: FeedbackView | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ evidence: EvidenceView; analysis: AnalysisView | null; feedback: FeedbackView | null }>(`/api/teacher/evidence/${params.id}`)
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, [params.id]);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!data) return <div className="card animate-pulse text-sm text-navy-900/50">Loading insight…</div>;

  const { evidence, analysis, feedback } = data;
  const photoSrc = evidence.photoPath
    ? `/api/teacher/uploads/${evidence.photoPath.split(/[\\/]/).map(encodeURIComponent).join("/")}`
    : null;
  const feedbackSent = feedback?.status === "sent" && feedback.message;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">AI insight</h1>
          <p className="text-sm text-navy-900/60">
            Attempt {evidence.attemptNumber} · submitted {new Date(evidence.submittedAt).toLocaleString()} ·
            analysis by {analysis?.source === "llm" ? "LLM" : "rubric engine"}
          </p>
        </div>
        <Link href="/teacher/history" className="btn-secondary">Implementation history →</Link>
      </div>

      {feedbackSent ? (
        <div className="card border-teal-500/30 bg-teal-50/70">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="text-sm font-bold text-teal-600 uppercase tracking-wide">Mentor feedback received</h2>
            <span className="text-xs text-navy-900/50">
              {feedback!.sentAt && new Date(feedback!.sentAt).toLocaleString()}
              {feedback!.editedByMentor ? " · reviewed & edited by your mentor" : " · approved by your mentor"}
              {feedback!.draftedBy === "llm" ? " · AI-assisted draft" : feedback!.draftedBy === "mentor_written" ? "" : " · AI-assisted draft"}
            </span>
          </div>
          <div className="text-sm text-navy-900/85 whitespace-pre-wrap">{feedback!.message}</div>
          <div className="mt-4">
            <Link href="/teacher/history" className="btn-teal">Retry with a new attempt →</Link>
          </div>
        </div>
      ) : (
        <div className="card bg-softblue-50/60">
          <p className="text-sm text-navy-900/70">
            Your mentor is reviewing this evidence. You'll see their feedback here once it's sent.
          </p>
        </div>
      )}

      <div className="card bg-softblue-50/60">
        <p className="text-xs text-navy-900/60">
          <strong>How to read this:</strong> <em>Observed</em> is only what your evidence literally shows. <em>Interpreted</em> is the
          AI's reading — a possibility, not a fact. <em>Recommended</em> is a suggestion. Your mentor reviews all of this before any
          feedback reaches you. AI assists — humans decide.
        </p>
      </div>

      {!analysis ? (
        <div className="card">Analysis is being prepared…</div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card">
              <h2 className="text-sm font-bold text-navy-900 mb-2 uppercase tracking-wide">Observed <span className="text-navy-900/40 font-normal normal-case">(from your evidence)</span></h2>
              <ul className="space-y-1.5 text-sm text-navy-900/80 list-disc pl-4">
                {analysis.observed.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            <div className="card">
              <h2 className="text-sm font-bold text-navy-900 mb-2 uppercase tracking-wide">Interpreted <span className="text-navy-900/40 font-normal normal-case">(AI reading — not fact)</span></h2>
              <ul className="space-y-1.5 text-sm text-navy-900/80 list-disc pl-4">
                {analysis.interpretation.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            <div className="card">
              <h2 className="text-sm font-bold text-teal-600 mb-2 uppercase tracking-wide">Recommended next actions</h2>
              <ul className="space-y-1.5 text-sm text-navy-900/80 list-disc pl-4">
                {analysis.recommendation.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          </div>

          <div className="card">
            <h2 className="label">Rubric check</h2>
            <ul className="space-y-2">
              {analysis.criterionHits.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-sm">
                  <span className={`badge ${c.hit ? "badge-teal" : "badge-neutral"}`}>{c.hit ? "Evidence seen" : "Not evident"}</span>
                  <span>
                    <span className="font-medium">{c.label}</span>
                    {c.evidence.length > 0 && <span className="block text-xs text-navy-900/55">“{c.evidence[0]}”</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {analysis.supportFlags.length > 0 && (
            <div className="card border-amber-200 bg-amber-50/50">
              <h2 className="text-sm font-bold text-amber-700 mb-2 uppercase tracking-wide">Support signals noticed</h2>
              <ul className="space-y-2 text-sm">
                {analysis.supportFlags.map((f, i) => (
                  <li key={i}>
                    <span className={`badge ${f.severity === "alert" ? "badge-red" : f.severity === "watch" ? "badge-amber" : "badge-neutral"}`}>{f.severity}</span>{" "}
                    <span className="font-medium">{f.signal}</span> — <span className="text-navy-900/70">{f.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-navy-900/50 mt-2">Signals are shared with your mentor to offer the right support — never used to rank or score teachers.</p>
            </div>
          )}

          <div className="card">
            <h2 className="label">What you submitted</h2>
            <p className="text-sm text-navy-900/80 whitespace-pre-wrap">{evidence.reflection}</p>
            {evidence.voiceNote && <p className="text-xs text-navy-900/50 mt-2">Voice note transcript attached.</p>}
            {photoSrc && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoSrc} alt="Submitted student work (demo)" className="rounded-lg max-h-72 border border-navy-900/10" />
              </div>
            )}
            <details className="mt-3">
              <summary className="text-xs font-semibold text-navy-900/50 cursor-pointer">Checklist responses</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(evidence.checklist).map(([k, v]) => (
                  <li key={k}>{v ? "✓" : "✗"} {k}</li>
                ))}
              </ul>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
