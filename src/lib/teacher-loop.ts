/**
 * Teacher loop domain layer.
 *
 * All state changes for the teacher journey live here so API routes stay thin:
 * context -> competency check -> personalized task -> practice -> classroom
 * evidence -> AI analysis -> (mentor feedback arrives in the mentor pass) -> retry.
 */
import { randomUUID } from "node:crypto";
import { ApiError } from "./api";
import { getDb } from "@/db/instance";
import { analyzeEvidence, generatePersonalization, generatePracticeScenario } from "./ai/service";
import type {
  TeacherContextData,
  HistorySummary,
  CriterionHit,
  SupportFlag,
  AiSource,
} from "./ai/types";
import { recordAdoptionEvent, getAdoptionStatus, qualifiesForSustained } from "./adoption";
import { ADOPTION_STAGES } from "@/db/schema";
import type { AdoptionStage } from "@/db/schema";

/* ------------------------------------------------------------------ */
/* Row shapes                                                          */
/* ------------------------------------------------------------------ */

export interface TaskRow {
  id: string;
  user_id: string;
  competency_id: string;
  attempt_number: number;
  status: "assigned" | "practised" | "attempted" | "completed";
  title: string;
  activity: string;
  practice_scenario: string;
  scenario_choices: string;
  recommended_choice: number | null;
  difficulty: string;
  micro_learning: string;
  support: string | null;
  reasoning: string | null;
  generated_by: AiSource;
  personalization_snapshot: string;
  created_at: string;
}

export interface EvidenceRow {
  id: string;
  user_id: string;
  task_id: string;
  attempt_number: number;
  reflection: string;
  voice_note: string | null;
  checklist: string;
  photo_path: string | null;
  status: "submitted" | "analyzed";
  client_token: string | null;
  submitted_at: string;
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export async function upsertContext(userId: string, data: TeacherContextData): Promise<void> {
  const db = getDb();
  db.prepare(
    `INSERT INTO teacher_contexts
       (user_id, experience_years, grades_taught, subjects, class_size, multigrade, school_context, challenges, confidence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       experience_years = excluded.experience_years,
       grades_taught = excluded.grades_taught,
       subjects = excluded.subjects,
       class_size = excluded.class_size,
       multigrade = excluded.multigrade,
       school_context = excluded.school_context,
       challenges = excluded.challenges,
       confidence = excluded.confidence,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    data.experience_years,
    JSON.stringify(data.grades_taught),
    JSON.stringify(data.subjects),
    data.class_size,
    data.multigrade ? 1 : 0,
    data.school_context,
    JSON.stringify(data.challenges),
    data.confidence,
    new Date().toISOString()
  );
}

export function getContext(userId: string): TeacherContextData | null {
  const row = getDb()
    .prepare(`SELECT * FROM teacher_contexts WHERE user_id = ?`)
    .get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    experience_years: Number(row.experience_years),
    grades_taught: JSON.parse(String(row.grades_taught)) as number[],
    subjects: JSON.parse(String(row.subjects)) as string[],
    class_size: row.class_size == null ? null : Number(row.class_size),
    multigrade: Number(row.multigrade) === 1,
    school_context: row.school_context == null ? null : String(row.school_context),
    challenges: JSON.parse(String(row.challenges)) as string[],
    confidence: Number(row.confidence),
  };
}

/* ------------------------------------------------------------------ */
/* Competency + check                                                  */
/* ------------------------------------------------------------------ */

export function getCompetency(competencyId: string) {
  const db = getDb();
  const comp = db.prepare(`SELECT * FROM competencies WHERE id = ?`).get(competencyId) as
    | { id: string; title: string; description: string }
    | undefined;
  if (!comp) throw new ApiError(404, "Competency not found", "not_found");
  const criteria = db
    .prepare(`SELECT label, keywords FROM competency_criteria WHERE competency_id = ? ORDER BY display_order`)
    .all(competencyId) as Array<{ label: string; keywords: string }>;
  return { ...comp, criteria: criteria.map((c) => ({ label: c.label, keywords: JSON.parse(c.keywords) as string[] })) };
}

export function listCompetenciesWithStatus(userId: string) {
  const db = getDb();
  const comps = db.prepare(`SELECT * FROM competencies ORDER BY created_at`).all() as Array<{
    id: string; title: string; description: string;
  }>;
  const criteriaCount = (cid: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM competency_criteria WHERE competency_id = ?`).get(cid) as { n: number }).n;
  const getCriteria = (cid: string) =>
    (db.prepare(`SELECT label FROM competency_criteria WHERE competency_id = ? ORDER BY display_order`).all(cid) as Array<{ label: string }>).map(
      (r) => ({ label: r.label })
    );
  return comps.map((c) => {
    const modules = db
      .prepare(`SELECT id, title, description, display_order FROM training_modules WHERE competency_id = ? ORDER BY display_order`)
      .all(c.id) as Array<{ id: string; title: string; description: string; display_order: number }>;
    const completions = modules.length
      ? (db
          .prepare(
            `SELECT module_id, completed_at FROM module_completions WHERE user_id = ? AND module_id IN (${modules.map(() => "?").join(",")})`
          )
          .all(userId, ...modules.map((m) => m.id)) as Array<{ module_id: string; completed_at: string }>)
      : [];
    const completedIds = new Set(completions.map((m) => m.module_id));
    const result = db
      .prepare(`SELECT status, score, checked_at FROM competency_results WHERE user_id = ? AND competency_id = ? ORDER BY checked_at DESC, rowid DESC LIMIT 1`)
      .get(userId, c.id) as { status: string; score: number; checked_at: string } | undefined;
    const trainingDone = modules.length > 0 && modules.every((m) => completedIds.has(m.id));
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      criteria: getCriteria(c.id),
      modules: modules.map((m) => ({ ...m, completed: completedIds.has(m.id) })),
      trainingComplete: trainingDone,
      check: result ? { status: result.status, score: result.score, total: criteriaCount(c.id) * 2, checkedAt: result.checked_at } : null,
    };
  });
}

/**
 * Marks a training module complete for a teacher (idempotent — INSERT OR
 * IGNORE). The competency check unlocks only when every module is done.
 */
export function completeModule(userId: string, moduleId: string): { completed: number; total: number; trainingComplete: boolean } {
  const db = getDb();
  const module = db
    .prepare(
      `SELECT m.id,
              m.competency_id,
              (SELECT COUNT(*) FROM training_modules WHERE competency_id = m.competency_id) AS total
       FROM training_modules m WHERE m.id = ?`
    )
    .get(moduleId) as { id: string; competency_id: string; total: number } | undefined;
  if (!module) throw new ApiError(404, "Training module not found", "not_found");

  db.prepare(
    `INSERT OR IGNORE INTO module_completions (user_id, module_id, completed_at) VALUES (?, ?, ?)`
  ).run(userId, moduleId, new Date().toISOString());

  const completed = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM module_completions
         WHERE user_id = ? AND module_id IN (SELECT id FROM training_modules WHERE competency_id = ?)`
      )
      .get(userId, module.competency_id) as { n: number }
  ).n;
  return { completed, total: module.total, trainingComplete: module.total > 0 && completed >= module.total };
}

export function submitCompetencyCheck(
  userId: string,
  competencyId: string,
  answers: Record<string, number>
): { status: "passed" | "needs_review"; score: number; total: number } {
  const db = getDb();
  const comp = getCompetency(competencyId);
  if (comp.criteria.length === 0) throw new ApiError(400, "Competency has no check items", "no_items");

  let score = 0;
  const total = comp.criteria.length * 2;
  for (const c of comp.criteria) {
    const v = answers[c.label] ?? 0;
    score += Math.max(0, Math.min(2, v));
  }
  const ratio = score / total;
  const status = ratio >= 0.8 ? "passed" : "needs_review";

  db.prepare(
    `INSERT INTO competency_results (id, user_id, competency_id, status, score, answers, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), userId, competencyId, status, score, JSON.stringify({ items: answers, total }), new Date().toISOString());

  return { status, score, total };
}

/* ------------------------------------------------------------------ */
/* History summary for personalization                                 */
/* ------------------------------------------------------------------ */

export function getHistorySummary(userId: string, competencyId: string): HistorySummary {
  const db = getDb();
  const attempts = db
    .prepare(`SELECT COUNT(*) AS n FROM implementation_tasks WHERE user_id = ? AND competency_id = ?`)
    .get(userId, competencyId) as { n: number };
  const evidence = db
    .prepare(
      `SELECT COUNT(*) AS n FROM evidence_submissions e JOIN implementation_tasks t ON t.id = e.task_id
       WHERE e.user_id = ? AND t.competency_id = ?`
    )
    .get(userId, competencyId) as { n: number };
  const feedback = db
    .prepare(
      `SELECT COUNT(*) AS n FROM mentor_feedback f
       JOIN evidence_submissions e ON e.id = f.evidence_id
       JOIN implementation_tasks t ON t.id = e.task_id
       WHERE t.user_id = ? AND t.competency_id = ? AND f.status = 'sent'`
    )
    .get(userId, competencyId) as { n: number };
  return {
    priorAttempts: attempts.n,
    priorEvidence: evidence.n,
    priorFeedback: feedback.n,
    priorRetries: Math.max(0, attempts.n - 1),
  };
}

/* ------------------------------------------------------------------ */
/* Personalized task generation                                        */
/* ------------------------------------------------------------------ */

export async function generateTask(
  userId: string,
  competencyId: string,
  opts: { forceNew?: boolean } = {}
): Promise<{ task: TaskRow; aiSource: AiSource; reusedExisting: boolean }> {
  const db = getDb();
  const comp = getCompetency(competencyId);

  // Reuse an in-flight task unless the caller explicitly forces a new one.
  const existing = db
    .prepare(
      `SELECT * FROM implementation_tasks
       WHERE user_id = ? AND competency_id = ? AND status IN ('assigned', 'practised', 'attempted')
       ORDER BY attempt_number DESC LIMIT 1`
    )
    .get(userId, competencyId) as TaskRow | undefined;
  if (existing && !opts.forceNew) {
    return { task: existing, aiSource: existing.generated_by, reusedExisting: true };
  }

  const context = getContext(userId);
  if (!context) {
    throw new ApiError(400, "Complete your teaching context first so the task can be personalized.", "context_required");
  }
  const result = db
    .prepare(`SELECT status, score FROM competency_results WHERE user_id = ? AND competency_id = ? ORDER BY checked_at DESC, rowid DESC LIMIT 1`)
    .get(userId, competencyId) as { status: string; score: number } | undefined;
  if (!result) {
    throw new ApiError(400, "Complete the competency check before requesting your personalized task.", "check_required");
  }

  const history = getHistorySummary(userId, competencyId);
  const personalization = await generatePersonalization({
    teacherName: getTeacherName(userId),
    competencyId,
    competencyTitle: comp.title,
    competencyDescription: comp.description,
    checkScore: result.score,
    checkScale: comp.criteria.length * 2,
    context,
    history,
  });

  const scenario = await generatePracticeScenario({
    competencyTitle: comp.title,
    competencyDescription: comp.description,
    context,
  });

  const attemptNumber =
    (
      db
        .prepare(`SELECT COALESCE(MAX(attempt_number), 0) AS n FROM implementation_tasks WHERE user_id = ? AND competency_id = ?`)
        .get(userId, competencyId) as { n: number }
    ).n + 1;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO implementation_tasks
       (id, user_id, competency_id, attempt_number, status, title, activity, practice_scenario, scenario_choices, recommended_choice, difficulty, micro_learning, support, reasoning, generated_by, personalization_snapshot, created_at)
     VALUES (?, ?, ?, ?, 'assigned', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    competencyId,
    attemptNumber,
    personalization.result.title,
    personalization.result.activity,
    scenario.result.scenario,
    JSON.stringify(scenario.result.choices),
    scenario.result.recommendedChoice,
    personalization.result.difficulty,
    JSON.stringify(personalization.result.microLearning),
    personalization.result.support,
    personalization.result.reasoning,
    personalization.source,
    JSON.stringify({ factors: personalization.result.personalizationFactors, context: { experience: context.experience_years, multigrade: context.multigrade, classSize: context.class_size, confidence: context.confidence } }),
    new Date().toISOString()
  );

  const task = db.prepare(`SELECT * FROM implementation_tasks WHERE id = ?`).get(id) as TaskRow;
  return { task, aiSource: personalization.source, reusedExisting: false };
}

function getTeacherName(userId: string): string {
  const row = getDb().prepare(`SELECT name FROM users WHERE id = ?`).get(userId) as { name: string } | undefined;
  return row?.name ?? "Teacher";
}

/* ------------------------------------------------------------------ */
/* Practice                                                            */
/* ------------------------------------------------------------------ */

export function savePracticeSession(
  userId: string,
  taskId: string,
  chosenOption: number,
  reflection?: string
): { wasCorrect: boolean; recommendedChoice: number } {
  const db = getDb();
  const task = db.prepare(`SELECT * FROM implementation_tasks WHERE id = ? AND user_id = ?`).get(taskId, userId) as TaskRow | undefined;
  if (!task) throw new ApiError(404, "Task not found", "not_found");

  const existing = db
    .prepare(`SELECT id FROM practice_sessions WHERE task_id = ? AND user_id = ? ORDER BY completed_at DESC LIMIT 1`)
    .get(taskId, userId) as { id: string } | undefined;
  if (existing) {
    throw new ApiError(409, "Practice for this task is already complete.", "already_practised");
  }

  const recommended = task.recommended_choice;
  const wasCorrect = recommended != null && chosenOption === recommended;

  db.prepare(
    `INSERT INTO practice_sessions (id, task_id, user_id, chosen_option, was_correct, reflection, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), taskId, userId, chosenOption, wasCorrect ? 1 : 0, reflection ?? null, new Date().toISOString());

  if (task.status === "assigned") {
    db.prepare(`UPDATE implementation_tasks SET status = 'practised' WHERE id = ?`).run(taskId);
  }
  recordAdoptionEvent(userId, task.competency_id, "practised", task.attempt_number, "Practice scenario completed");

  return { wasCorrect, recommendedChoice: recommended ?? -1 };
}

export function getPracticeSession(userId: string, taskId: string) {
  return getDb()
    .prepare(`SELECT * FROM practice_sessions WHERE task_id = ? AND user_id = ? ORDER BY completed_at DESC LIMIT 1`)
    .get(taskId, userId) as
    | { id: string; chosen_option: number; was_correct: number; reflection: string | null; completed_at: string }
    | undefined;
}

/* ------------------------------------------------------------------ */
/* Evidence + AI analysis                                              */
/* ------------------------------------------------------------------ */

export interface SubmitEvidenceInput {
  userId: string;
  taskId: string;
  reflection: string;
  voiceNote: string | null;
  checklist: Record<string, boolean>;
  photoPath: string | null;
  clientToken: string | null;
}

export interface SubmitEvidenceResult {
  evidenceId: string;
  duplicate: boolean;
  /** Null when the AI analysis is still pending — the evidence itself is always saved. */
  analysis: {
    id: string;
    observed: string[];
    interpretation: string[];
    recommendation: string[];
    criterionHits: CriterionHit[];
    supportFlags: SupportFlag[];
    supportRecommended: boolean;
    source: AiSource;
    generatedAt: string;
  } | null;
}

export async function submitEvidence(input: SubmitEvidenceInput): Promise<SubmitEvidenceResult> {
  const db = getDb();

  // Idempotency: a repeated client_token returns the original result untouched.
  if (input.clientToken) {
    const dup = db.prepare(`SELECT id FROM evidence_submissions WHERE client_token = ?`).get(input.clientToken) as { id: string } | undefined;
    if (dup) {
      // Self-heal: if the original submission's analysis failed mid-flight, retry
      // it once now instead of 500-ing forever (the evidence row survived).
      let analysis = getAnalysisByEvidenceId(dup.id);
      if (!analysis) analysis = await regenerateAnalysis(dup.id);
      if (!analysis) throw new ApiError(503, "Evidence was received; its analysis is still pending. Please retry shortly.", "analysis_pending");
      return { evidenceId: dup.id, duplicate: true, analysis };
    }
  }

  const task = db.prepare(`SELECT * FROM implementation_tasks WHERE id = ? AND user_id = ?`).get(input.taskId, input.userId) as TaskRow | undefined;
  if (!task) throw new ApiError(404, "Task not found", "not_found");

  // Failure recovery (spec §30): the evidence row is persisted FIRST, so if the
  // AI step throws, the submission survives (status 'submitted') and analysis
  // can be regenerated later. The AI is never allowed to destroy user data.
  const id = randomUUID();
  db.prepare(
    `INSERT INTO evidence_submissions (id, user_id, task_id, attempt_number, reflection, voice_note, checklist, photo_path, status, client_token, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`
  ).run(
    id,
    input.userId,
    input.taskId,
    task.attempt_number,
    input.reflection,
    input.voiceNote,
    JSON.stringify(input.checklist),
    input.photoPath,
    input.clientToken,
    new Date().toISOString()
  );

  const comp = getCompetency(task.competency_id);
  const keywords = Object.fromEntries(comp.criteria.map((c) => [c.label, c.keywords]));
  const analysisInput = {
    reflection: input.reflection,
    checklist: input.checklist,
    voiceNote: input.voiceNote,
    criteria: comp.criteria.map((c) => c.label),
    keywordsByCriterion: keywords,
    context: getContext(input.userId),
    history: getHistorySummary(input.userId, task.competency_id),
  };
  const ai = await analyzeEvidence(analysisInput).catch((err: unknown) => {
    console.error("[ai] evidence analysis failed; evidence kept for retry:", err instanceof Error ? err.message : err);
    return null;
  });

  if (ai) {

  const analysisId = randomUUID();
  db.prepare(
    `INSERT INTO ai_analyses (id, evidence_id, observed, interpretation, recommendation, criterion_hits, support_flags, support_recommended, generated_by, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    analysisId,
    id,
    JSON.stringify(ai.result.observed),
    JSON.stringify(ai.result.interpretation),
    JSON.stringify(ai.result.recommendation),
    JSON.stringify(ai.result.criterionHits),
    JSON.stringify(ai.result.supportFlags),
    ai.result.supportRecommended ? 1 : 0,
    ai.source,
    new Date().toISOString()
  );
  db.prepare(`UPDATE evidence_submissions SET status = 'analyzed' WHERE id = ?`).run(id);
  }

  // Evidence submission completes the classroom-application step of the attempt
  // (adoption advances even if analysis is still pending — the classroom attempt
  // itself is real; the AI insight is a later enhancement).
  db.prepare(
    `UPDATE implementation_tasks SET status = 'completed' WHERE id = ? AND status IN ('assigned','practised','attempted')`
  ).run(input.taskId);

  recordAdoptionEvent(input.userId, task.competency_id, "attempted", task.attempt_number, "Applied technique in classroom");
  recordAdoptionEvent(input.userId, task.competency_id, "evidence_submitted", task.attempt_number, "Evidence submitted");

  if (qualifiesForSustained(input.userId, task.competency_id)) {
    recordAdoptionEvent(input.userId, task.competency_id, "sustained", task.attempt_number, "3+ attempts with evidence and sent feedback");
  }

  const analysis = getAnalysisByEvidenceId(id);
  return { evidenceId: id, duplicate: false, analysis };
}

/**
 * Regenerates the AI analysis for an evidence row that was saved but never
 * analyzed (server failure mid-submission). Idempotent: no-op if analysis
 * already exists. Returns null when regeneration is not possible.
 */
export async function regenerateAnalysis(evidenceId: string) {
  const db = getDb();
  const existing = getAnalysisByEvidenceId(evidenceId);
  if (existing) return existing;
  const row = db
    .prepare(
      `SELECT e.*, t.competency_id, t.attempt_number AS task_attempt FROM evidence_submissions e
       JOIN implementation_tasks t ON t.id = e.task_id WHERE e.id = ?`
    )
    .get(evidenceId) as
    | (EvidenceRow & { competency_id: string; task_attempt: number })
    | undefined;
  if (!row) return null;

  const comp = getCompetency(row.competency_id);
  const keywords = Object.fromEntries(comp.criteria.map((c) => [c.label, c.keywords]));
  const ai = await analyzeEvidence({
    reflection: row.reflection,
    checklist: JSON.parse(row.checklist) as Record<string, boolean>,
    voiceNote: row.voice_note,
    criteria: comp.criteria.map((c) => c.label),
    keywordsByCriterion: keywords,
    context: getContext(row.user_id),
    history: getHistorySummary(row.user_id, row.competency_id),
  }).catch((err: unknown) => {
    console.error("[ai] analysis regeneration failed:", err instanceof Error ? err.message : err);
    return null;
  });
  if (!ai) return null;

  db.prepare(
    `INSERT INTO ai_analyses (id, evidence_id, observed, interpretation, recommendation, criterion_hits, support_flags, support_recommended, generated_by, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    evidenceId,
    JSON.stringify(ai.result.observed),
    JSON.stringify(ai.result.interpretation),
    JSON.stringify(ai.result.recommendation),
    JSON.stringify(ai.result.criterionHits),
    JSON.stringify(ai.result.supportFlags),
    ai.result.supportRecommended ? 1 : 0,
    ai.source,
    new Date().toISOString()
  );
  db.prepare(`UPDATE evidence_submissions SET status = 'analyzed' WHERE id = ?`).run(evidenceId);
  return getAnalysisByEvidenceId(evidenceId);
}

export function getAnalysisByEvidenceId(evidenceId: string) {
  const row = getDb()
    .prepare(`SELECT * FROM ai_analyses WHERE evidence_id = ?`)
    .get(evidenceId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    observed: JSON.parse(String(row.observed)) as string[],
    interpretation: JSON.parse(String(row.interpretation)) as string[],
    recommendation: JSON.parse(String(row.recommendation)) as string[],
    criterionHits: JSON.parse(String(row.criterion_hits)) as CriterionHit[],
    supportFlags: JSON.parse(String(row.support_flags)) as SupportFlag[],
    supportRecommended: Number(row.support_recommended) === 1,
    source: String(row.generated_by) as AiSource,
    generatedAt: String(row.generated_at),
  };
}

export function getEvidence(userId: string, evidenceId: string): { evidence: EvidenceRow; analysis: ReturnType<typeof getAnalysisByEvidenceId> } {
  const db = getDb();
  const evidence = db.prepare(`SELECT * FROM evidence_submissions WHERE id = ? AND user_id = ?`).get(evidenceId, userId) as EvidenceRow | undefined;
  if (!evidence) throw new ApiError(404, "Evidence not found", "not_found");
  return { evidence, analysis: getAnalysisByEvidenceId(evidenceId) };
}

/* ------------------------------------------------------------------ */
/* Retry                                                               */
/* ------------------------------------------------------------------ */

export async function startRetry(userId: string, competencyId: string, note?: string): Promise<{ task: TaskRow; aiSource: AiSource }> {
  const db = getDb();
  const comp = getCompetency(competencyId);

  const hasEvidence = db
    .prepare(
      `SELECT COUNT(*) AS n FROM evidence_submissions e JOIN implementation_tasks t ON t.id = e.task_id
       WHERE e.user_id = ? AND t.competency_id = ?`
    )
    .get(userId, competencyId) as { n: number };
  if (hasEvidence.n === 0) {
    throw new ApiError(400, "Submit classroom evidence before starting a retry.", "evidence_required");
  }
  const inflight = db
    .prepare(
      `SELECT id FROM implementation_tasks WHERE user_id = ? AND competency_id = ? AND status IN ('assigned','practised','attempted')`
    )
    .get(userId, competencyId) as { id: string } | undefined;
  if (inflight) {
    throw new ApiError(409, "An attempt is already in progress for this competency.", "attempt_in_progress");
  }

  const feedbackReceived = db
    .prepare(
      `SELECT COUNT(*) AS n FROM mentor_feedback f
       JOIN evidence_submissions e ON e.id = f.evidence_id
       JOIN implementation_tasks t ON t.id = e.task_id
       WHERE t.user_id = ? AND t.competency_id = ? AND f.status = 'sent'`
    )
    .get(userId, competencyId) as { n: number };

  const generated = await generateTask(userId, competencyId, { forceNew: true });
  if (feedbackReceived.n === 0) {
    // Retry without mentor feedback is allowed but flagged in the reasoning trail.
    db.prepare(`UPDATE implementation_tasks SET reasoning = ? WHERE id = ?`).run(
      `${generated.task.reasoning ?? ""} | Note: retry started before any mentor feedback was sent.${note ? ` Teacher note: ${note}` : ""}`,
      generated.task.id
    );
  } else if (note) {
    db.prepare(`UPDATE implementation_tasks SET reasoning = ? WHERE id = ?`).run(
      `${generated.task.reasoning ?? ""} | Retry note: ${note}`,
      generated.task.id
    );
  }
  recordAdoptionEvent(userId, competencyId, "retried", generated.task.attempt_number, note ?? "New attempt after feedback");
  // Re-read: the reasoning update above ran after generateTask snapshotted the row.
  const task = db.prepare(`SELECT * FROM implementation_tasks WHERE id = ?`).get(generated.task.id) as TaskRow;
  return { task, aiSource: generated.aiSource };
}

/* ------------------------------------------------------------------ */
/* Dashboard + history                                                 */
/* ------------------------------------------------------------------ */

export interface LoopStepView {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "attention";
  detail?: string;
}

export function getTeacherDashboard(userId: string) {
  const db = getDb();
  const context = getContext(userId);
  const competencies = listCompetenciesWithStatus(userId);

  const focus = competencies.find((c) => c.check?.status === "passed") ?? competencies[0] ?? null;
  const tasks = focus
    ? (db
        .prepare(`SELECT * FROM implementation_tasks WHERE user_id = ? AND competency_id = ? ORDER BY attempt_number DESC`)
        .all(userId, focus.id) as TaskRow[])
    : [];
  const currentTask = tasks.find((t) => t.status !== "completed") ?? null;
  const lastTask = tasks[0] ?? null;

  const evidenceCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM evidence_submissions e JOIN implementation_tasks t ON t.id = e.task_id WHERE e.user_id = ? AND t.competency_id = ?`
    )
    .get(userId, focus?.id ?? "") as { n: number };
  const feedbackSent = db
    .prepare(
      `SELECT COUNT(*) AS n FROM mentor_feedback f
       JOIN evidence_submissions e ON e.id = f.evidence_id
       JOIN implementation_tasks t ON t.id = e.task_id
       WHERE t.user_id = ? AND t.competency_id = ? AND f.status = 'sent'`
    )
    .get(userId, focus?.id ?? "") as { n: number };

  const adoption = focus ? getAdoptionStatus(userId, focus.id) : null;
  const sustained = focus ? qualifiesForSustained(userId, focus.id) : false;

  // Build the loop-step view for the dashboard.
  const step = (key: string, label: string, state: LoopStepView["state"], detail?: string): LoopStepView => ({ key, label, state, detail });
  const doneIf = (cond: boolean): LoopStepView["state"] => (cond ? "done" : "upcoming");
  const steps: LoopStepView[] = focus
    ? [
        step("train", "Training", doneIf(focus.trainingComplete), `${focus.modules.filter((m) => m.completed).length}/${focus.modules.length} modules`),
        step("check", "Competency", doneIf(!!focus.check), focus.check ? `${focus.check.status === "passed" ? "Passed" : "Needs review"} · ${focus.check.score}/${focus.check.total}` : undefined),
        step("context", "Context", doneIf(!!context)),
        step("task", "Personalized task", doneIf(tasks.length > 0)),
        step("practice", "Practice", doneIf(tasks.some((t) => db.prepare(`SELECT id FROM practice_sessions WHERE task_id = ?`).get(t.id))),
          tasks.length ? undefined : "Generate a task first"),
        step("evidence", "Evidence", doneIf(evidenceCount.n > 0), `${evidenceCount.n} submission(s)`),
        step("feedback", "Feedback", doneIf(feedbackSent.n > 0), feedbackSent.n ? `${feedbackSent.n} received` : undefined),
        step("retry", "Retry", tasks.length > 1 ? "done" : "upcoming", tasks.length > 1 ? `${tasks.length} attempts` : undefined),
        step("adopt", "Adoption", adoption && (adoption.stage === "repeated" || adoption.stage === "sustained" || sustained) ? "done" : "current",
          adoption ? adoption.stage.replace(/_/g, " ") : undefined),
      ]
    : [];

  return {
    context,
    competencies,
    focus,
    currentTask,
    lastTask,
    adoption,
    sustained,
    steps,
    counts: { evidence: evidenceCount.n, feedbackSent: feedbackSent.n, attempts: tasks.length },
  };
}

export interface SentFeedbackView {
  evidenceId: string;
  attemptNumber: number;
  message: string;
  sentAt: string;
  editedByMentor: boolean;
}

/** Latest sent mentor feedback for a competency (teacher-facing dashboard). */
export function listSentFeedback(userId: string, competencyId: string, limit = 3): SentFeedbackView[] {
  const rows = getDb()
    .prepare(
      `SELECT e.id AS evidence_id, t.attempt_number, f.sent_message, f.sent_at, f.edited_by_mentor
       FROM mentor_feedback f
       JOIN evidence_submissions e ON e.id = f.evidence_id
       JOIN implementation_tasks t ON t.id = e.task_id
       WHERE t.user_id = ? AND t.competency_id = ? AND f.status = 'sent'
       ORDER BY f.sent_at DESC LIMIT ?`
    )
    .all(userId, competencyId, limit) as Array<{
      evidence_id: string; attempt_number: number; sent_message: string; sent_at: string; edited_by_mentor: number;
    }>;
  return rows.map((r) => ({
    evidenceId: r.evidence_id,
    attemptNumber: r.attempt_number,
    message: r.sent_message,
    sentAt: r.sent_at,
    editedByMentor: Number(r.edited_by_mentor) === 1,
  }));
}

export function getImplementationHistory(userId: string) {
  const db = getDb();
  const comps = db.prepare(`SELECT id, title FROM competencies ORDER BY created_at`).all() as Array<{ id: string; title: string }>;
  const out: Array<{
    competency: { id: string; title: string };
    adoptionStage: AdoptionStage;
    attempts: Array<{
      attemptNumber: number;
      taskId: string;
      taskTitle: string;
      status: string;
      difficulty: string;
      createdAt: string;
      practice: { chosen_option: number; was_correct: boolean; completed_at: string } | null;
      evidence: Array<{
        id: string;
        reflection: string;
        status: string;
        submittedAt: string;
        analysis: ReturnType<typeof getAnalysisByEvidenceId>;
        feedback: { status: string; sentMessage: string | null; sentAt: string | null } | null;
      }>;
    }>;
  }> = [];

  for (const c of comps) {
    const tasks = db
      .prepare(`SELECT * FROM implementation_tasks WHERE user_id = ? AND competency_id = ? ORDER BY attempt_number ASC`)
      .all(userId, c.id) as TaskRow[];
    if (tasks.length === 0) continue;
    const adoption = getAdoptionStatus(userId, c.id);
    const attempts = tasks.map((t) => {
      const practice = getPracticeSession(userId, t.id) ?? null;
      const evidence = db
        .prepare(`SELECT * FROM evidence_submissions WHERE task_id = ? ORDER BY submitted_at ASC`)
        .all(t.id) as EvidenceRow[];
      return {
        attemptNumber: t.attempt_number,
        taskId: t.id,
        taskTitle: t.title,
        status: t.status,
        difficulty: t.difficulty,
        createdAt: t.created_at,
        practice: practice ? { chosen_option: practice.chosen_option, was_correct: Number(practice.was_correct) === 1, completed_at: practice.completed_at } : null,
        evidence: evidence.map((e) => {
          const fb = db
            .prepare(`SELECT status, sent_message, sent_at FROM mentor_feedback WHERE evidence_id = ? ORDER BY created_at DESC LIMIT 1`)
            .get(e.id) as { status: string; sent_message: string | null; sent_at: string | null } | undefined;
          return {
            id: e.id,
            reflection: e.reflection,
            checklist: JSON.parse(e.checklist) as Record<string, boolean>,
            status: e.status,
            submittedAt: e.submitted_at,
            analysis: getAnalysisByEvidenceId(e.id),
            feedback: fb ? { status: fb.status, sentMessage: fb.sent_message, sentAt: fb.sent_at } : null,
          };
        }),
      };
    });
    out.push({ competency: c, adoptionStage: adoption.stage, attempts });
  }
  return out;
}
