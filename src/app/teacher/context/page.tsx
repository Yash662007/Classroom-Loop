"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

interface ContextData {
  experience_years: number;
  grades_taught: number[];
  subjects: string[];
  class_size: number | null;
  multigrade: boolean;
  school_context: string | null;
  challenges: string[];
  confidence: number;
}

const CHALLENGE_OPTIONS = [
  "managing multiple grades at once",
  "large class management",
  "time pressure",
  "low student participation",
  "limited teaching materials",
  "students at very different levels",
];

export default function ContextPage() {
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [challengeInput, setChallengeInput] = useState("");

  useEffect(() => {
    apiFetch<{ context: ContextData | null }>("/api/teacher/context")
      .then((d) =>
        setCtx(
          d.context ?? {
            experience_years: 5,
            grades_taught: [],
            subjects: [],
            class_size: null,
            multigrade: false,
            school_context: "",
            challenges: [],
            confidence: 3,
          }
        )
      )
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error && !ctx) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!ctx) return <div className="card animate-pulse text-sm text-navy-900/50">Loading…</div>;

  function update<K extends keyof ContextData>(key: K, value: ContextData[K]) {
    setSaved(false);
    setCtx((c) => (c ? { ...c, [key]: value } : c));
  }

  async function save() {
    if (!ctx) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/teacher/context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ctx,
          class_size: ctx.class_size === null || Number.isNaN(ctx.class_size) ? null : Number(ctx.class_size),
        }),
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">My teaching context</h1>
        <p className="text-sm text-navy-900/60">
          The AI uses this — together with your competency check and history — to personalize tasks.
          There are no weak or advanced labels: new and experienced teachers simply get different starting points.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="years">Years of teaching experience</label>
            <input id="years" type="number" min={0} max={45} className="input" value={ctx.experience_years}
              onChange={(e) => update("experience_years", Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="classsize">Typical class size (leave empty if it varies)</label>
            <input id="classsize" type="number" min={1} max={200} className="input" value={ctx.class_size ?? ""}
              onChange={(e) => update("class_size", e.target.value === "" ? null : Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="grades">Grades taught (tap to toggle)</label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => {
              const on = ctx.grades_taught.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => update("grades_taught", on ? ctx.grades_taught.filter((x) => x !== g) : [...ctx.grades_taught, g].sort((a, b) => a - b))}
                  className={`h-8 w-8 rounded-lg text-sm font-semibold border transition-colors ${on ? "bg-primary-600 text-white border-primary-600" : "border-slate-300 hover:bg-softblue-50"}`}
                  aria-pressed={on}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="subjects">Subjects (comma separated)</label>
          <input id="subjects" className="input" value={ctx.subjects.join(", ")}
            onChange={(e) => update("subjects", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={ctx.multigrade}
              onChange={(e) => update("multigrade", e.target.checked)} />
            I teach multi-grade classes (several grades in the same room)
          </label>
        </div>

        <div>
          <label className="label" htmlFor="school">School context (optional)</label>
          <textarea id="school" className="input min-h-[64px]" maxLength={300} value={ctx.school_context ?? ""}
            onChange={(e) => update("school_context", e.target.value)}
            placeholder="e.g. rural single-teacher school, shared classroom, evening shift…" />
        </div>

        <div>
          <span className="label">Current challenges (tap to toggle, or add your own)</span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CHALLENGE_OPTIONS.map((c) => {
              const on = ctx.challenges.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on}
                  onClick={() => update("challenges", on ? ctx.challenges.filter((x) => x !== c) : [...ctx.challenges, c])}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-softblue-200 border-softblue-500 font-medium" : "border-navy-900/15 hover:bg-softblue-50"}`}>
                  {c}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="Add your own challenge…" value={challengeInput}
              onChange={(e) => setChallengeInput(e.target.value)} maxLength={120} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => {
              const v = challengeInput.trim();
              if (v && !ctx.challenges.includes(v)) update("challenges", [...ctx.challenges, v]);
              setChallengeInput("");
            }}>Add</button>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="confidence">How confident do you feel about this competency right now? (1–5)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => update("confidence", n)} aria-pressed={ctx.confidence === n}
                className={`h-9 w-9 rounded-lg text-sm font-semibold border transition-colors ${ctx.confidence === n ? "bg-teal-600 text-white border-teal-600" : "border-navy-900/15 hover:bg-softblue-100"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{error}</div>}
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save context"}
          </button>
          {saved && <span className="text-sm text-teal-600 font-medium">Context saved — it now shapes your personalization.</span>}
        </div>
      </div>
    </div>
  );
}
