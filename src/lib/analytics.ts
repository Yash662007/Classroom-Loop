/**
 * Analytics domain — aggregates across all teachers for the admin role.
 * Design constraints (spec §23/§25): aggregate-only, no teacher rankings,
 * no surveillance metrics. The intervention list answers "who needs support",
 * never "who is worst".
 */
import { getDb } from "@/db/instance";
import { ADOPTION_STAGES } from "@/db/schema";
import type { AdoptionStage } from "@/db/schema";
import { getLlmUsageSummary, type LlmUsageSummary } from "@/lib/llm-usage";

export type { LlmUsageSummary };

export interface FunnelResponse {
  stage: string;
  label: string;
  /** Teachers (or teacher-competency pairs) that reached this stage. */
  count: number;
  /** Fraction of teachers who entered the funnel. */
  ofTeachers: number;
}

export function getTrainingToPracticeFunnel(): FunnelResponse[] {
  const db = getDb();
  const teachers = (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'teacher'`).get() as { n: number }).n || 1;

  const counts = {
    trained: (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM module_completions`).get() as { n: number }).n,
    checked: (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM competency_results`).get() as { n: number }).n,
    tasked: (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM implementation_tasks`).get() as { n: number }).n,
    practised: (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM practice_sessions`).get() as { n: number }).n,
    attempted: (
      db
        .prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM adoption_events WHERE stage IN ('attempted','evidence_submitted','feedback_received','retried','repeated','sustained')`)
        .get() as { n: number }
    ).n,
    evidence: (
      db
        .prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM adoption_events WHERE stage IN ('evidence_submitted','feedback_received','retried','repeated','sustained')`)
        .get() as { n: number }
    ).n,
    feedback: (
      db
        .prepare(`SELECT COUNT(DISTINCT t.user_id) AS n FROM mentor_feedback f JOIN evidence_submissions e ON e.id = f.evidence_id JOIN implementation_tasks t ON t.id = e.task_id WHERE f.status = 'sent'`)
        .get() as { n: number }
    ).n,
    retried: (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM adoption_events WHERE stage IN ('retried','repeated','sustained')`).get() as { n: number }).n,
    repeated: (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM adoption_events WHERE stage IN ('repeated','sustained')`).get() as { n: number }).n,
    sustained: (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM adoption_events WHERE stage = 'sustained'`).get() as { n: number }).n,
  };

  const mk = (stage: string, label: string, count: number): FunnelResponse => ({
    stage,
    label,
    count,
    ofTeachers: Math.round((count / teachers) * 100),
  });

  return [
    mk("trained", "Training completed", counts.trained),
    mk("checked", "Competency checked", counts.checked),
    mk("tasked", "Implementation task received", counts.tasked),
    mk("practised", "Practised (AI scenario)", counts.practised),
    mk("attempted", "Attempted in classroom", counts.attempted),
    mk("evidence", "Evidence submitted", counts.evidence),
    mk("feedback", "Feedback received", counts.feedback),
    mk("retried", "Retried", counts.retried),
    mk("repeated", "Repeated implementation", counts.repeated),
    mk("sustained", "Sustained adoption", counts.sustained),
  ];
}

export interface ImplementationMetrics {
  tasksGenerated: number;
  practiceSessions: number;
  evidenceSubmitted: number;
  aiAnalyses: number;
  analysesBySource: { local_engine: number; llm: number };
  feedbackDrafted: number;
  feedbackSent: number;
  retriesStarted: number;
  avgTimeToFirstAttemptHours: number | null;
  avgFeedbackTurnaroundHours: number | null;
  supportFlaggedAnalyses: number;
}

export interface StageDropOff {
  stage: string;
  label: string;
  teachers: number;
  /** Share of the previous stage's cohort that did not reach this stage. */
  stepDropOffPercent: number | null;
}

/**
 * Drop-off analysis (#17): for every funnel stage, how many teachers were
 * lost from the previous step. First stage has no previous step (null).
 */
export function getFunnelDropOff(): StageDropOff[] {
  const funnel = getTrainingToPracticeFunnel();
  return funnel.map((f, i) => {
    const prev = i > 0 ? funnel[i - 1].count : null;
    return {
      stage: f.stage,
      label: f.label,
      teachers: f.count,
      stepDropOffPercent: prev !== null && prev > 0 ? Math.round((1 - f.count / prev) * 100) : null,
    };
  });
}

/** LLM spend summary for the admin view (empty when no LLM calls were metered). */
export function getLlmUsage(): ReturnType<typeof getLlmUsageSummary> {
  return getLlmUsageSummary();
}

export function getImplementationMetrics(): ImplementationMetrics {
  const db = getDb();
  const one = (sql: string, ...params: unknown[]): number =>
    (db.prepare(sql).get(...(params as never[])) as { n: number }).n;

  const analysesBySource = {
    local_engine: one(`SELECT COUNT(*) AS n FROM ai_analyses WHERE generated_by = 'local_engine'`),
    llm: one(`SELECT COUNT(*) AS n FROM ai_analyses WHERE generated_by = 'llm'`),
  };

  // Time to first attempt: training completion -> first evidence submission per teacher.
  const ttf = db
    .prepare(
      `SELECT MIN(mc.completed_at) AS trained_at,
              (SELECT MIN(e.submitted_at) FROM evidence_submissions e WHERE e.user_id = mc.user_id) AS first_evidence
       FROM module_completions mc GROUP BY mc.user_id`
    )
    .all() as Array<{ trained_at: string; first_evidence: string | null }>;
  const ttfHours = ttf
    .filter((r): r is { trained_at: string; first_evidence: string } => Boolean(r.first_evidence))
    .map((r) => (new Date(r.first_evidence).getTime() - new Date(r.trained_at).getTime()) / 3_600_000)
    .filter((h) => h >= 0);

  const turnaround = db
    .prepare(
      `SELECT e.submitted_at, f.sent_at FROM mentor_feedback f JOIN evidence_submissions e ON e.id = f.evidence_id
       WHERE f.status = 'sent' AND f.sent_at IS NOT NULL`
    )
    .all() as Array<{ submitted_at: string; sent_at: string }>;
  const turnHours = turnaround
    .map((r) => (new Date(r.sent_at).getTime() - new Date(r.submitted_at).getTime()) / 3_600_000)
    .filter((h) => h >= 0);

  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

  return {
    tasksGenerated: one(`SELECT COUNT(*) AS n FROM implementation_tasks`),
    practiceSessions: one(`SELECT COUNT(*) AS n FROM practice_sessions`),
    evidenceSubmitted: one(`SELECT COUNT(*) AS n FROM evidence_submissions`),
    aiAnalyses: one(`SELECT COUNT(*) AS n FROM ai_analyses`),
    analysesBySource,
    feedbackDrafted: one(`SELECT COUNT(*) AS n FROM mentor_feedback`),
    feedbackSent: one(`SELECT COUNT(*) AS n FROM mentor_feedback WHERE status = 'sent'`),
    retriesStarted: one(`SELECT COUNT(*) AS n FROM implementation_tasks WHERE attempt_number > 1`),
    avgTimeToFirstAttemptHours: avg(ttfHours),
    avgFeedbackTurnaroundHours: avg(turnHours),
    supportFlaggedAnalyses: one(`SELECT COUNT(*) AS n FROM ai_analyses WHERE support_recommended = 1`),
  };
}

export interface AdoptionDistribution {
  byStage: Array<{ stage: AdoptionStage; teachers: number }>;
  byCompetency: Array<{ competencyId: string; title: string; topStage: string; teachersAtTopStage: number; totalAttempts: number }>;
  sustainedTeachers: number;
}

export function getAdoptionDistribution(): AdoptionDistribution {
  const db = getDb();

  // Highest stage reached per teacher (across competencies).
  const events = db.prepare(`SELECT user_id, stage FROM adoption_events`).all() as Array<{ user_id: string; stage: string }>;
  const highest = new Map<string, AdoptionStage>();
  for (const e of events) {
    const idx = ADOPTION_STAGES.indexOf(e.stage as AdoptionStage);
    const cur = highest.get(e.user_id);
    if (!cur || idx > ADOPTION_STAGES.indexOf(cur)) highest.set(e.user_id, e.stage as AdoptionStage);
  }

  const byStage = ADOPTION_STAGES.map((s) => ({
    stage: s,
    teachers: [...highest.values()].filter((v) => v === s).length,
  }));

  const byCompetency = (
    db.prepare(`SELECT id, title FROM competencies ORDER BY created_at`).all() as Array<{ id: string; title: string }>
  ).map((c) => {
    const compEvents = db
      .prepare(`SELECT user_id, stage FROM adoption_events WHERE competency_id = ?`)
      .all(c.id) as Array<{ user_id: string; stage: string }>;
    const perTeacher = new Map<string, AdoptionStage>();
    for (const e of compEvents) {
      const idx = ADOPTION_STAGES.indexOf(e.stage as AdoptionStage);
      const cur = perTeacher.get(e.user_id);
      if (!cur || idx > ADOPTION_STAGES.indexOf(cur)) perTeacher.set(e.user_id, e.stage as AdoptionStage);
    }
    // Highest stage any assigned teacher reached, and how many sit there.
    let topStage: AdoptionStage = "not_started";
    for (const st of perTeacher.values()) {
      if (ADOPTION_STAGES.indexOf(st) > ADOPTION_STAGES.indexOf(topStage)) topStage = st;
    }
    const teachersAtTopStage = [...perTeacher.values()].filter((s) => s === topStage).length;
    const totalAttempts = (db.prepare(`SELECT COUNT(*) AS n FROM implementation_tasks WHERE competency_id = ?`).get(c.id) as { n: number }).n;
    return {
      competencyId: c.id,
      title: c.title,
      topStage,
      teachersAtTopStage,
      totalAttempts,
    };
  });

  const sustainedTeachers = (db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM adoption_events WHERE stage = 'sustained'`).get() as { n: number }).n;

  return { byStage, byCompetency, sustainedTeachers };
}

export interface InterventionTeacher {
  id: string;
  name: string;
  /** Why support is suggested — signals, never scores or ranks. */
  signals: string[];
  adoptionStage: string;
  attempts: number;
  evidencePending: number;
}

/**
 * Teachers needing intervention: rule-based support signals only
 * (AI 4). Deliberately NOT a ranking; several teachers can appear, order is
 * by signal severity for triage, not by "performance".
 */
export function getTeachersNeedingIntervention(): InterventionTeacher[] {
  const db = getDb();
  const teachers = db.prepare(`SELECT id, name FROM users WHERE role = 'teacher' ORDER BY name`).all() as Array<{ id: string; name: string }>;
  const out: InterventionTeacher[] = [];

  for (const t of teachers) {
    const signals: string[] = [];

    const attempts = (db.prepare(`SELECT COUNT(*) AS n FROM implementation_tasks WHERE user_id = ?`).get(t.id) as { n: number }).n;
    const evidence = (db.prepare(`SELECT COUNT(*) AS n FROM evidence_submissions WHERE user_id = ?`).get(t.id) as { n: number }).n;
    const feedback = (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM mentor_feedback f JOIN evidence_submissions e ON e.id = f.evidence_id WHERE e.user_id = ? AND f.status = 'sent'`
        )
        .get(t.id) as { n: number }
    ).n;
    const pending = (
      db.prepare(`SELECT COUNT(*) AS n FROM evidence_submissions WHERE user_id = ? AND status = 'submitted'`).get(t.id) as { n: number }
    ).n;

    if (pending > 0) signals.push(`${pending} evidence submission(s) awaiting mentor review`);
    if (attempts >= 2 && feedback === 0) signals.push("multiple attempts without any mentor feedback");
    if (attempts > 0 && evidence === 0) signals.push("task(s) generated but no classroom evidence yet");

    const latestAnalysis = db
      .prepare(
        `SELECT ai.support_flags FROM ai_analyses ai JOIN evidence_submissions e ON e.id = ai.evidence_id
         WHERE e.user_id = ? ORDER BY ai.generated_at DESC LIMIT 1`
      )
      .get(t.id) as { support_flags: string } | undefined;
    if (latestAnalysis) {
      const flags = JSON.parse(latestAnalysis.support_flags) as Array<{ signal: string; severity: string }>;
      for (const f of flags) {
        if (f.severity === "alert") signals.push(`AI support signal: ${f.signal.toLowerCase()}`);
        else if (f.severity === "watch") signals.push(`AI watch signal: ${f.signal.toLowerCase()}`);
      }
    }

    const adoption = db
      .prepare(`SELECT stage FROM adoption_events WHERE user_id = ? ORDER BY occurred_at DESC, rowid DESC LIMIT 1`)
      .get(t.id) as { stage: string } | undefined;

    if (signals.length > 0) {
      out.push({
        id: t.id,
        name: t.name,
        signals,
        adoptionStage: adoption?.stage ?? "not_started",
        attempts,
        evidencePending: pending,
      });
    }
  }
  return out;
}
