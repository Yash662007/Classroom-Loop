"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";

interface ReviewData {
  evidence: {
    id: string; taskId: string; attemptNumber: number; reflection: string;
    voiceNote: string | null; checklist: Record<string, boolean>; photoPath: string | null; submittedAt: string;
  };
  analysis: {
    observed: string[]; interpretation: string[]; recommendation: string[];
    criterionHits: Array<{ label: string; hit: boolean; evidence: string[] }>;
    supportFlags: Array<{ signal: string; detail: string; severity: string }>;
    supportRecommended: boolean; source: string;
  } | null;
  teacher: { id: string; name: string; email: string; context: { experience_years: number; multigrade: boolean; class_size: number | null; confidence: number; challenges: string[]; school_context: string | null } | null };
  task: { title: string; activity: string; difficulty: string; attemptNumber: number };
  competency: { id: string; title: string };
  practice: { chosenOption: number; wasCorrect: boolean; reflection: string | null } | null;
  existingFeedback: { draft: string; status: string; draftedBy: string; editedByMentor: boolean } | null;
  adoption: { stage: string };
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draftLoading, setDraftLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const [aiDraftUsed, setAiDraftUsed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ teacherName: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<ReviewData>(`/api/mentor/evidence/${params.id}`);
      setData(d);
      if (d.existingFeedback) {
        setMessage(d.existingFeedback.draft);
        setAiDraftUsed(d.existingFeedback.draftedBy !== "mentor_written");
        setEdited(d.existingFeedback.editedByMentor);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadAiDraft() {
    setDraftLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ draft: string; created: boolean }>("/api/mentor/feedback/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence_id: params.id }),
      });
      setMessage(r.draft);
      setAiDraftUsed(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDraftLoading(false);
    }
  }

  async function approveAndSend() {
    setSending(true);
    setError(null);
    try {
      const r = await apiFetch<{ teacherName: string }>("/api/mentor/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence_id: params.id, message, action: "approve_send", edited_by_mentor: edited || (aiDraftUsed && message !== data?.existingFeedback?.draft) }),
      });
      setSent({ teacherName: r.teacherName });
      setTimeout(() => router.push("/mentor/queue"), 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (error && !data) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!data) return <div className="card animate-pulse text-sm text-navy-900/50">Loading submission…</div>;

  const photoSrc = data.evidence.photoPath
    ? `/api/mentor/uploads/${data.evidence.photoPath.split(/[\\/]/).map(encodeURIComponent).join("/")}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Evidence review</h1>
          <p className="text-sm text-navy-900/60">
            {data.teacher.name} · Attempt {data.evidence.attemptNumber} · {data.competency.title} ·
            submitted {new Date(data.evidence.submittedAt).toLocaleString()}
          </p>
        </div>
        <Link href={`/mentor/teachers/${data.teacher.id}`} className="btn-secondary">Teacher history →</Link>
      </div>

      {sent && (
        <div className="rounded-lg bg-teal-50 border border-teal-200 text-teal-600 text-sm px-3 py-2.5">
          Feedback sent to {sent.teacherName}. Their adoption status advanced to “feedback received”. Redirecting to the queue…
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="label">What the teacher submitted</h2>
          <p className="text-sm text-navy-900/85 whitespace-pre-wrap">{data.evidence.reflection}</p>
          {data.evidence.voiceNote && <p className="text-xs text-navy-900/50 mt-2">Voice transcript attached.</p>}
          {photoSrc && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc} alt="Teacher-submitted student work" className="rounded-lg max-h-64 border border-navy-900/10" />
            </div>
          )}
          <details className="mt-3">
            <summary className="text-xs font-semibold text-navy-900/50 cursor-pointer">Checklist &amp; practice</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(data.evidence.checklist).map(([k, v]) => <li key={k}>{v ? "✓" : "✗"} {k}</li>)}
            </ul>
            {data.practice && (
              <p className="mt-2 text-xs text-navy-900/60">
                Practice: chose option {String.fromCharCode(65 + data.practice.chosenOption)} ({data.practice.wasCorrect ? "recommended strategy" : "different strategy"}).
                {data.practice.reflection && ` “${data.practice.reflection}”`}
              </p>
            )}
          </details>
          {data.teacher.context && (
            <div className="mt-3 border-t border-navy-900/10 pt-3">
              <p className="text-xs text-navy-900/60">
                <strong>Context:</strong> {data.teacher.context.experience_years} yrs ·{" "}
                {data.teacher.context.multigrade ? "multi-grade" : "single-grade"} · class of {data.teacher.context.class_size ?? "?"} ·
                confidence {data.teacher.context.confidence}/5
                {data.teacher.context.challenges.length > 0 && ` · challenges: ${data.teacher.context.challenges.join(", ")}`}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {data.analysis ? (
            <>
              <div className="card">
                <h3 className="text-xs font-bold text-navy-900/60 uppercase mb-2">Observed (from evidence)</h3>
                <ul className="text-sm space-y-1 list-disc pl-4 text-navy-900/80">
                  {data.analysis.observed.slice(0, 8).map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
              <div className="card">
                <h3 className="text-xs font-bold text-navy-900/60 uppercase mb-2">AI interpretation (not fact)</h3>
                <ul className="text-sm space-y-1 list-disc pl-4 text-navy-900/80">
                  {data.analysis.interpretation.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
                <h3 className="text-xs font-bold text-teal-600 uppercase mb-2 mt-3">AI recommended next actions</h3>
                <ul className="text-sm space-y-1 list-disc pl-4 text-navy-900/80">
                  {data.analysis.recommendation.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
              {data.analysis.supportFlags.length > 0 && (
                <div className="card border-amber-200 bg-amber-50/50">
                  <h3 className="text-xs font-bold text-amber-700 uppercase mb-2">Support signals</h3>
                  <ul className="text-sm space-y-1.5">
                    {data.analysis.supportFlags.map((f, i) => (
                      <li key={i}>
                        <span className={`badge ${f.severity === "alert" ? "badge-red" : f.severity === "watch" ? "badge-amber" : "badge-neutral"}`}>{f.severity}</span>{" "}
                        <span className="font-medium">{f.signal}</span> — {f.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="card text-sm text-navy-900/60">AI analysis is not ready yet — refresh in a moment.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="label">Feedback to {data.teacher.name} (AI assists — you decide)</h2>
        {!message && !draftLoading && (
          <div className="mb-3">
            <button type="button" className="btn-secondary" onClick={loadAiDraft}>
              Draft with AI assistance
            </button>
            <p className="text-xs text-navy-900/50 mt-1.5">
              The AI drafts from the analysis and rubric — it is a starting point only. Edit freely; your words are what gets sent. You can also write from scratch below.
            </p>
          </div>
        )}
        {draftLoading && <p className="text-sm text-navy-900/50 mb-3">Drafting with AI…</p>}
        <textarea
          className="input min-h-[180px] font-sans"
          placeholder={"### What appears to have worked\n…\n\n### Possible improvement area\n…\n\n### Suggested next attempt\n…"}
          value={message}
          onChange={(e) => { setMessage(e.target.value); setEdited(true); }}
          maxLength={8000}
        />
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button type="button" className="btn-teal" disabled={sending || message.trim().length < 10 || !!sent} onClick={approveAndSend}>
            {sending ? "Sending…" : "Approve & send to teacher"}
          </button>
          {aiDraftUsed && <span className="badge-neutral">AI-assisted draft</span>}
          {edited && <span className="badge-neutral">Edited by you</span>}
          <span className="text-xs text-navy-900/50">
            Sending marks this evidence reviewed and advances the teacher's adoption to “feedback received”.
          </span>
        </div>
        {error && <div role="alert" className="mt-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{error}</div>}
      </div>
    </div>
  );
}
