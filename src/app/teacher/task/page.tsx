"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, idempotencyKey, clearIdempotencyKey, NetworkError } from "@/lib/client-api";
import { saveDraft, getDraft, getAllDrafts, clearDraft, enqueueEvidence } from "@/lib/offline/db";
import type { EvidenceDraft } from "@/lib/offline/db";
import { useSync } from "@/components/SyncProvider";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { VoiceRecorder } from "@/components/evidence/VoiceRecorder";
import { PhotoCapture } from "@/components/evidence/PhotoCapture";
import { QualityCheck } from "@/components/evidence/QualityCheck";
import { NeedHelpButton } from "@/components/evidence/NeedHelpButton";

interface TaskView {
  id: string;
  competency_id: string;
  attempt_number: number;
  status: string;
  title: string;
  activity: string;
  practice_scenario: string;
  scenario_choices: string;
  recommended_choice: number | null;
  difficulty: string;
  micro_learning: string;
  support: string | null;
  reasoning: string | null;
  generated_by: string;
  created_at: string;
}

interface PracticeSession {
  chosen_option: number;
  was_correct: number;
  reflection: string | null;
  completed_at: string;
}

export default function TaskPage() {
  const [task, setTask] = useState<TaskView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [reflection, setReflection] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null); // recorded audio (GOAL 16)
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ evidenceId: string; duplicate: boolean } | null>(null);

  const [practice, setPractice] = useState<PracticeSession | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [practiceReflection, setPracticeReflection] = useState("");
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceDone, setPracticeDone] = useState<{ wasCorrect: boolean; recommendedChoice: number } | null>(null);

  const [queuedOffline, setQueuedOffline] = useState(false);
  const [photoMeta, setPhotoMeta] = useState<{ name: string; size: number } | null>(null);
  const { syncNow } = useSync();
  const draftLoadedRef = useRef(false);
  const taskIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // A saved draft wins over any cached/submitted view: while a draft exists
    // the evidence form must stay open, online or offline.
    let offlineDrafts: EvidenceDraft[] = [];
    try {
      offlineDrafts = await getAllDrafts();
    } catch {
      offlineDrafts = [];
    }

    try {
      const dash = await apiFetch<{
        currentTask: TaskView | null;
        lastTask: TaskView | null;
        focus: { id: string } | null;
      }>("/api/teacher/dashboard");
      const t = dash.currentTask ?? dash.lastTask;
      setTask(t);
      taskIdRef.current = t?.id ?? null;
      if (t) {
        const pr = await apiFetch<{ session: PracticeSession | null }>(`/api/practice/sessions?task_id=${t.id}`);
        setPractice(pr.session);
        if (pr.session) {
          setChoice(pr.session.chosen_option);
          setPracticeDone({ wasCorrect: Number(pr.session.was_correct) === 1, recommendedChoice: t.recommended_choice ?? -1 });
        }
        // Checklist mirrors the competency rubric criteria.
        const comps = await apiFetch<{ competencies: Array<{ id: string; criteria: Array<{ label: string }> }> }>("/api/teacher/competencies");
        const comp = comps.competencies.find((c) => c.id === t.competency_id);
        const defaultChecklist: Record<string, boolean> = {};
        comp?.criteria.forEach((cr) => (defaultChecklist[cr.label] = false));
        const latest = await fetchLatestEvidence(t.id);
        const saved = offlineDrafts.find((d) => d.taskId === t.id);
        if (saved) {
          // Draft has priority: keep the form open with its contents.
          setReflection(saved.reflection);
          setVoiceText(saved.voiceText);
          setChecklist(Object.keys(saved.checklist).length ? saved.checklist : defaultChecklist);
          if (saved.photoInfo) setPhotoMeta(saved.photoInfo);
        } else if (latest) {
          setChecklist(Object.keys(latest.checklist).length ? latest.checklist : defaultChecklist);
          setReflection(latest.reflection);
          setSubmitted({ evidenceId: latest.id, duplicate: false });
          await clearDraft(t.id);
        } else {
          setChecklist(defaultChecklist);
        }
      }
    } catch (err) {
      if (err instanceof NetworkError) {
        // Fully offline: work from the local draft, building a minimal task view.
        const saved = offlineDrafts[0];
        if (saved) {
          taskIdRef.current = saved.taskId;
          setTask({
            id: saved.taskId,
            competency_id: "offline",
            attempt_number: 0,
            status: "offline-draft",
            title: saved.taskTitle || "Your saved draft (offline)",
            activity: "Offline — the full task details will load when connectivity returns. Your draft is intact below.",
            practice_scenario: "",
            scenario_choices: "[]",
            recommended_choice: null,
            difficulty: "offline",
            micro_learning: "[]",
            support: null,
            reasoning: null,
            generated_by: "local_engine",
            created_at: saved.updatedAt,
          });
          setReflection(saved.reflection);
          setVoiceText(saved.voiceText);
          setChecklist(saved.checklist);
          if (saved.photoInfo) setPhotoMeta(saved.photoInfo);
          setError("You're offline — showing your saved draft. Everything you write stays on this device and submits when connectivity returns.");
        } else {
          setError("You're offline. Pages you've already opened stay readable, and any drafts you saved are kept on this device.");
        }
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function fetchLatestEvidence(taskId: string) {
    try {
      type HistEntry = { attempts: Array<{ taskId: string; evidence: Array<{ id: string; reflection: string; checklist: Record<string, boolean> }> }> };
      const hist = await apiFetch<{ history: HistEntry[] }>("/api/teacher/history");
      for (const c of hist.history) {
        for (const a of c.attempts) {
          if (a.taskId === taskId && a.evidence.length > 0) {
            const ev = a.evidence[a.evidence.length - 1];
            return { id: ev.id, reflection: ev.reflection, checklist: ev.checklist };
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async function submitPractice() {
    if (!task || choice == null) return;
    setPracticeBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ wasCorrect: boolean; recommendedChoice: number }>("/api/practice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, chosen_option: choice, reflection: practiceReflection || undefined }),
      });
      setPracticeDone(r);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPracticeBusy(false);
    }
  }

  // ---- Offline draft: autosave on every change (debounced) ----
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoInfo: EvidenceDraft["photoInfo"] = photo ? { name: photo.name, size: photo.size } : photoMeta;

  useEffect(() => {
    if (!task || submitted) return;
    if (!draftLoadedRef.current) {
      // Skip the very first autosave until initial load has restored/applied state.
      draftLoadedRef.current = true;
      return;
    }
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void saveDraft({
        taskId: task.id,
        taskTitle: task.title,
        reflection,
        voiceText,
        checklist,
        photoInfo,
        updatedAt: new Date().toISOString(),
      });
    }, 400);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, reflection, voiceText, checklist, photo]);

  async function submitEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const form = new FormData();
      form.set("task_id", task.id);
      const fullReflection = voiceText ? `${reflection}\n\n(Reflection dictated by voice: ${voiceText})` : reflection;
      form.set("reflection", fullReflection);
      form.set("checklist", JSON.stringify(checklist));
      // The idempotency key is captured BEFORE the attempt: offline queues reuse it.
      const key = idempotencyKey(`evidence-${task.id}`);
      form.set("client_token", key);
      if (photo) form.set("photo", photo);
      if (voiceFile) form.set("voice_file", voiceFile);

      const r = await apiFetch<{ evidenceId: string; duplicate: boolean }>("/api/evidence", {
        method: "POST",
        body: form,
      });
      clearIdempotencyKey(`evidence-${task.id}`);
      await clearDraft(task.id);
      setSubmitted({ evidenceId: r.evidenceId, duplicate: r.duplicate });
      await load();
    } catch (err) {
      if (err instanceof NetworkError) {
        // OFFLINE PATH: queue with the SAME idempotency key captured above.
        const key = idempotencyKey(`evidence-${task.id}`);
        await enqueueEvidence({
          idempotencyKey: key,
          taskId: task.id,
          taskTitle: task.title,
          attemptNumber: task.attempt_number,
          competencyTitle: "",
          payload: {
            reflection: voiceText ? `${reflection}\n\n(Reflection dictated by voice: ${voiceText})` : reflection,
            voiceNote: voiceText || null,
            checklist,
            hasPhoto: !!photo,
          },
          photoBlob: photo,
          photoType: photo?.type ?? null,
          voiceBlob: voiceFile,
          voiceType: voiceFile?.type ?? null,
          status: "queued",
          attempts: 0,
          lastError: null,
          queuedAt: new Date().toISOString(),
          flushedAt: null,
        });
        await clearDraft(task.id);
        clearIdempotencyKey(`evidence-${task.id}`);
        setQueuedOffline(true);
        void syncNow();
      } else {
        setSubmitError((err as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CardSkeleton label="Loading your task…" />;

  if (error) return <ErrorState message={error} />;

  if (!task) {
    return (
      <div className="card text-center py-10">
        <h1 className="text-xl font-bold mb-2">No task yet</h1>
        <p className="text-sm text-navy-900/60 mb-4">Complete the competency check, then generate your personalized task.</p>
        <Link href="/teacher/competencies" className="btn-primary">Go to competencies →</Link>
      </div>
    );
  }

  const choices: string[] = JSON.parse(task.scenario_choices);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-neutral">Attempt {task.attempt_number}</span>
            <span className="badge-neutral">{task.difficulty}</span>
            <span className="badge-teal">{task.generated_by === "llm" ? "AI (LLM)" : "AI (rubric engine)"}</span>
            <span className="badge-neutral">{task.status}</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-900">{task.title}</h1>
        </div>
        <Link href="/teacher/history" className="btn-secondary">History &amp; retry →</Link>
      </div>

      <div className="card">
        <h2 className="label">Your personalized activity (this week)</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm text-navy-900/85">{task.activity}</pre>
        {task.support && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Support suggested: {task.support}
          </p>
        )}
        {task.reasoning && (
          <details className="mt-3">
            <summary className="text-xs font-semibold text-navy-900/50 cursor-pointer">Why this task for you? (personalization reasoning)</summary>
            <p className="text-xs text-navy-900/60 mt-2">{task.reasoning}</p>
          </details>
        )}
      </div>

      <div className="card">
        <h2 className="label">Step 1 · Practice the decision (simulated classroom)</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm text-navy-900/85 mb-4">{task.practice_scenario}</pre>
        {practiceDone ? (
          <div className={`rounded-lg border px-3 py-2.5 text-sm ${practiceDone.wasCorrect ? "bg-teal-50 border-teal-200 text-teal-600" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
            {practiceDone.wasCorrect
              ? "Strong choice — that's the strategy the scenario rewards."
              : `Worth reflecting on: option ${practiceDone.recommendedChoice + 1} is the stronger strategy here.`}
            {practice?.reflection && <p className="text-navy-900/60 mt-1 text-xs">Your note: {practice.reflection}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {choices.map((c, i) => (
              <label key={i} className={`block cursor-pointer rounded-lg border p-3 text-sm transition-colors ${choice === i ? "bg-softblue-100 border-primary-600" : "border-slate-300 hover:bg-softblue-50"}`}>
                <input type="radio" name="choice" className="sr-only" checked={choice === i} onChange={() => setChoice(i)} />
                <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                {c}
              </label>
            ))}
            <textarea
              className="input min-h-[60px]"
              placeholder="Optional: how would you adapt this to your own classroom?"
              value={practiceReflection}
              onChange={(e) => setPracticeReflection(e.target.value)}
              maxLength={2000}
            />
            <button type="button" className="btn-teal" disabled={choice == null || practiceBusy} onClick={submitPractice}>
              {practiceBusy ? "Saving…" : "Submit practice decision"}
            </button>
          </div>
        )}
        {practice && !practiceDone && <p className="text-xs text-navy-900/50 mt-2">You completed this practice on {new Date(practice.completed_at).toLocaleString()}.</p>}
      </div>

      <div className="card">
        <h2 className="label">Step 2 · After teaching the lesson: submit classroom evidence</h2>
        {queuedOffline ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2.5 text-sm">
              <strong>Saved on this device.</strong> You appear to be offline, so your evidence is queued safely with a submission key —
              it will send automatically when connectivity returns. Nothing is lost; do not write a duplicate.
            </div>
          </div>
        ) : submitted ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-teal-50 border border-teal-200 text-teal-600 px-3 py-2.5 text-sm">
              Evidence submitted{submitted.duplicate ? " (already received — duplicate ignored)" : ""}. Your AI insight is ready.
            </div>
            <Link href={`/teacher/evidence/${submitted.evidenceId}`} className="btn-primary">View AI insight →</Link>
          </div>
        ) : (
          <form onSubmit={submitEvidence} className="space-y-4">
            <div>
              <label className="label" htmlFor="reflection">What happened when you tried the technique? (required)</label>
              <textarea
                id="reflection"
                className="input min-h-[120px]"
                required
                maxLength={5000}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Describe the lesson, your questions, who answered, what you noticed…"
              />
              <p className="text-[11px] text-navy-900/40 mt-1">Typed text is saved on your device as you write; if you're offline, submit anyway and it will sync when connectivity returns.</p>
            </div>

            <div>
              <label className="label">Voice reflection (optional — records audio your mentor can play)</label>
              <VoiceRecorder onSaved={setVoiceFile} />
            </div>

            <fieldset>
              <legend className="label">Technique checklist (what actually happened)</legend>
              <div className="space-y-1.5">
                {Object.entries(checklist).length === 0 && <p className="text-sm text-navy-900/50">Checklist loads with your competency criteria.</p>}
                {Object.entries(checklist).map(([label, checked]) => (
                  <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChecklist((c) => ({ ...c, [label]: e.target.checked }))}
                      className="h-4 w-4 accent-[#0F766E]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="label">Photo of student work (optional · compressed automatically · no student faces or names)</label>
              <PhotoCapture onFile={setPhoto} />
            </div>

            <QualityCheck reflection={reflection} checklistCount={Object.values(checklist).filter(Boolean).length} />

            {submitError && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{submitError}</div>}

            <button type="submit" className="btn-primary" disabled={submitting || !reflection.trim()}>
              {submitting ? "Submitting & analyzing with AI…" : "Submit evidence for AI analysis"}
            </button>
            {!reflection.trim() && <p className="text-xs text-navy-900/50">Write your reflection to enable submission.</p>}
          </form>
        )}
      </div>

      <MicroLearning microLearning={task.micro_learning} />

      <div className="card">
        <NeedHelpButton taskId={task.id} />
      </div>
    </div>
  );
}

function MicroLearning({ microLearning }: { microLearning: string }) {
  let items: string[] = [];
  try {
    items = JSON.parse(microLearning);
  } catch {
    items = [];
  }
  if (items.length === 0) return null;
  return (
    <div className="card">
      <h2 className="label">Suggested micro-learning</h2>
      <ul className="space-y-1.5">
        {items.map((m, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="text-teal-600 font-bold">→</span> {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
