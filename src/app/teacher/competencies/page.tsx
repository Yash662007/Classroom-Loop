"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client-api";
import { GenerateTaskButton } from "@/components/implementation/GenerateTaskButton";

interface CompetencyView {
  id: string;
  title: string;
  description: string;
  modules: Array<{ id: string; title: string; description: string; completed: boolean }>;
  trainingComplete: boolean;
  check: { status: string; score: number; total: number; checkedAt: string } | null;
  criteria: Array<{ label: string; keywords: string[] }>;
}

const LEVELS = [
  { value: 0, label: "Not yet" },
  { value: 1, label: "Partly" },
  { value: 2, label: "Consistently" },
];

export default function CompetenciesPage() {
  const [comps, setComps] = useState<CompetencyView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ competencies: CompetencyView[] }>("/api/teacher/competencies");
      setComps(data.competencies);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitCheck(competencyId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/competencies/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competency_id: competencyId, answers }),
      });
      setCheckingId(null);
      setAnswers({});
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !comps) {
    return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  }
  if (!comps) {
    return <div className="card animate-pulse text-sm text-navy-900/50">Loading competencies…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Training &amp; competencies</h1>
        <p className="text-sm text-navy-900/60">Complete training, check your competency, then get a personalized implementation task.</p>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{error}</div>}

      {comps.map((c) => (
        <div key={c.id} className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-navy-900">{c.title}</h2>
              <p className="text-sm text-navy-900/70 max-w-2xl">{c.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {c.trainingComplete && <span className="badge-teal">Training complete</span>}
              {c.check && (
                <span className={c.check.status === "passed" ? "badge-teal" : "badge-amber"}>
                  Check: {c.check.status === "passed" ? "Passed" : "Needs review"} · {c.check.score}/{c.check.total}
                </span>
              )}
            </div>
          </div>

          <div>
            <h3 className="label">Training modules</h3>
            <ul className="space-y-1.5">
              {c.modules.map((m) => (
                <li key={m.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${m.completed ? "bg-teal-500 text-white" : "bg-softblue-100 text-navy-900/50"}`}>
                    {m.completed ? "✓" : "•"}
                  </span>
                  <span>
                    <span className="font-medium">{m.title}</span>
                    <span className="text-navy-900/60"> — {m.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {c.check ? (
            <div className="border-t border-navy-900/10 pt-4">
              {c.check.status === "passed" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-navy-900/70">You're ready to implement. Generate a task personalized to your context and history.</p>
                  <GenerateTaskButton competencyId={c.id} />
                  <Link href="/teacher/task" className="btn-secondary">View my task →</Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-amber-700">Needs review — revisit the modules, then retake the check.</p>
                  <button type="button" className="btn-secondary" onClick={() => { setCheckingId(c.id); setAnswers({}); }}>Retake check</button>
                </div>
              )}
            </div>
          ) : checkingId === c.id ? (
            <div className="border-t border-navy-900/10 pt-4 space-y-3">
              <h3 className="label">Self-check: how consistently do you do each of these? (Be honest — this only shapes your personalization.)</h3>
              {c.criteria.map((cr) => (
                <div key={cr.label} className="rounded-lg border border-navy-900/10 p-3">
                  <p className="text-sm font-medium mb-2">{cr.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((lv) => (
                      <label key={lv.value} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors ${answers[cr.label] === lv.value ? "bg-primary-600 text-white border-primary-600" : "border-slate-300 hover:bg-softblue-50"}`}>
                        <input
                          type="radio"
                          name={`${c.id}--${cr.label}`}
                          className="sr-only"
                          checked={answers[cr.label] === lv.value}
                          onChange={() => setAnswers((a) => ({ ...a, [cr.label]: lv.value }))}
                        />
                        {lv.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" className="btn-primary" disabled={busy || Object.keys(answers).length < c.criteria.length} onClick={() => submitCheck(c.id)}>
                  {busy ? "Saving…" : "Submit check"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setCheckingId(null)}>Cancel</button>
              </div>
              {Object.keys(answers).length < c.criteria.length && (
                <p className="text-xs text-navy-900/50">Answer every item to submit.</p>
              )}
            </div>
          ) : (
            <div className="border-t border-navy-900/10 pt-4">
              <button type="button" className="btn-primary" onClick={() => { setCheckingId(c.id); setAnswers({}); }}>
                Take the competency check
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
