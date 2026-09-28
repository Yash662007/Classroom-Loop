/**
 * Centralized workflow engine — the single source of truth for pipeline state.
 *
 * Core pipeline:
 *   TRAIN → UNDERSTAND → PERSONALIZE → PRACTISE → APPLY → EVIDENCE
 *     → AI ANALYSIS → MENTOR REVIEW → FEEDBACK → RETRY → ADOPT
 *
 * Design:
 * - WORKFLOW_STATES is the required state vocabulary (23 concepts), including
 *   branching states (SUPPORT_REQUIRED, RETRY_REQUIRED) and the client-side
 *   sync states (SYNC_PENDING / SYNC_FAILED) that live in the offline outbox
 *   layer; the server observes their RESOLUTION and tags the resulting events
 *   with the syncing actor (see submitEvidence).
 * - recordWorkflowEvent() appends to workflow_events: what happened (state),
 *   when (occurred_at), who/what caused it (actor), the resulting state and
 *   the previous state. The previous state is derived automatically when not
 *   supplied.
 * - Recording is IDEMPOTENT per (user, competency, attempt, state, task) via a
 *   unique index — replayed offline syncs and interrupted/retried requests can
 *   never duplicate history entries. The event log therefore records one event
 *   per state transition per attempt, which is the granularity the loop needs.
 * - deriveWorkflowState() connects Current State + Event History + Attempts +
 *   AI Jobs + Mentor Decisions + Adoption by reading the domain tables
 *   directly (no circular imports: this module never imports domain code).
 *
 * Domain functions (teacher-loop / mentor-loop / adoption) call
 * recordWorkflowEvent() at each real transition; adoption remains the
 * config-driven ladder, and this log is the audit trail behind it.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/instance";

export const WORKFLOW_STATES = [
  "NOT_STARTED",
  "TRAINING_COMPLETE",
  "CONTEXT_READY",
  "ACTION_ASSIGNED",
  "PRACTICE_PENDING",
  "PRACTICE_COMPLETE",
  "CLASSROOM_ATTEMPT_PENDING",
  "CLASSROOM_ATTEMPT_RECORDED",
  "EVIDENCE_PENDING",
  "EVIDENCE_SUBMITTED",
  "AI_ANALYSIS_PENDING",
  "AI_ANALYSIS_COMPLETE",
  "MENTOR_REVIEW_PENDING",
  "MENTOR_REVIEWED",
  "FEEDBACK_SENT",
  "RETRY_REQUIRED",
  "RETRY_IN_PROGRESS",
  "RETRY_COMPLETED",
  "REPEATED_IMPLEMENTATION",
  "SUSTAINED_ADOPTION",
  "SUPPORT_REQUIRED",
  "SYNC_PENDING",
  "SYNC_FAILED",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

const STATE_SET: ReadonlySet<string> = new Set(WORKFLOW_STATES);

export interface WorkflowEventInput {
  userId: string;
  competencyId: string;
  state: WorkflowState;
  attemptNumber?: number;
  taskId?: string | null;
  /** Defaults to the latest known state for this user+competency. */
  previousState?: string | null;
  /** Defaults to "<role>:<name>" resolved from the acting user row. */
  actor?: string;
  detail?: string;
  occurredAt?: string;
}

function resolveActor(userId: string, explicit?: string): string {
  if (explicit) return explicit;
  const row = getDb()
    .prepare(`SELECT role, name FROM users WHERE id = ?`)
    .get(userId) as { role: string; name: string } | undefined;
  return row ? `${row.role}:${row.name}` : "system";
}

/** Latest recorded state for a user+competency (null when the loop never started). */
export function getLatestWorkflowState(userId: string, competencyId: string): string | null {
  const row = getDb()
    .prepare(
      `SELECT state FROM workflow_events WHERE user_id = ? AND competency_id = ? ORDER BY rowid DESC LIMIT 1`
    )
    .get(userId, competencyId) as { state: string } | undefined;
  return row?.state ?? null;
}

/** Latest recorded state for a user across ALL competencies (causal-chain fallback). */
function getLatestWorkflowStateAny(userId: string): string | null {
  const row = getDb()
    .prepare(`SELECT state FROM workflow_events WHERE user_id = ? ORDER BY rowid DESC LIMIT 1`)
    .get(userId) as { state: string } | undefined;
  return row?.state ?? null;
}

/** Append-only, idempotent event recording. Unknown states are a programming error. */
export function recordWorkflowEvent(input: WorkflowEventInput): void {
  if (!STATE_SET.has(input.state)) {
    throw new Error(`Unknown workflow state: ${input.state}`);
  }
  const previous =
    input.previousState ??
    getLatestWorkflowState(input.userId, input.competencyId) ??
    getLatestWorkflowStateAny(input.userId);
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO workflow_events
         (id, user_id, competency_id, attempt_number, task_id, state, previous_state, actor, detail, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      input.userId,
      input.competencyId,
      input.attemptNumber ?? 0,
      input.taskId ?? "",
      input.state,
      previous,
      resolveActor(input.userId, input.actor),
      input.detail ?? null,
      input.occurredAt ?? new Date().toISOString()
    );
}

/* ------------------------------------------------------------------ */
/* Derived view: current state + history + attempts + AI + mentor      */
/* ------------------------------------------------------------------ */

export interface WorkflowEventView {
  state: string;
  previousState: string | null;
  actor: string;
  detail: string | null;
  attemptNumber: number;
  taskId: string;
  occurredAt: string;
}

export interface AttemptView {
  attemptNumber: number;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  generatedBy: string;
  createdAt: string;
  practiceComplete: boolean;
  evidence: Array<{
    id: string;
    status: string;
    viaOfflineSync: boolean;
    submittedAt: string;
    analysis: { source: string; generatedAt: string; supportRecommended: boolean; supportFlags: unknown } | null;
    feedback: { status: string; sentAt: string | null; editedByMentor: boolean } | null;
  }>;
}

export interface DerivedWorkflow {
  currentState: WorkflowState;
  adoptionStage: string | null;
  support: { required: boolean; flags: unknown } | null;
  events: WorkflowEventView[];
  attempts: AttemptView[];
}

export function deriveWorkflowState(userId: string, competencyId: string): DerivedWorkflow {
  const db = getDb();

  const events = (
    db
      .prepare(
        `SELECT state, previous_state, actor, detail, attempt_number, task_id, occurred_at
         FROM workflow_events WHERE user_id = ? AND (competency_id = ? OR competency_id = '')
         ORDER BY rowid`
      )
      .all(userId, competencyId) as Array<{
      state: string; previous_state: string | null; actor: string; detail: string | null;
      attempt_number: number; task_id: string; occurred_at: string;
    }>
  ).map((e) => ({
    state: e.state,
    previousState: e.previous_state,
    actor: e.actor,
    detail: e.detail,
    attemptNumber: e.attempt_number,
    taskId: e.task_id,
    occurredAt: e.occurred_at,
  }));

  const taskRows = db
    .prepare(
      `SELECT id, attempt_number, status, title, generated_by, created_at
       FROM implementation_tasks WHERE user_id = ? AND competency_id = ? ORDER BY attempt_number`
    )
    .all(userId, competencyId) as Array<{
    id: string; attempt_number: number; status: string; title: string; generated_by: string; created_at: string;
  }>;

  let support: DerivedWorkflow["support"] = null;
  const attempts: AttemptView[] = taskRows.map((t) => {
    const practice = db
      .prepare(`SELECT 1 AS x FROM practice_sessions WHERE task_id = ? LIMIT 1`)
      .get(t.id) as { x: number } | undefined;

    const evidenceRows = db
      .prepare(
        `SELECT id, status, client_token, submitted_at FROM evidence_submissions WHERE task_id = ? ORDER BY submitted_at`
      )
      .all(t.id) as Array<{ id: string; status: string; client_token: string | null; submitted_at: string }>;

    const evidence = evidenceRows.map((e) => {
      const analysis = db
        .prepare(
          `SELECT generated_by, generated_at, support_recommended, support_flags
           FROM ai_analyses WHERE evidence_id = ? ORDER BY generated_at DESC LIMIT 1`
        )
        .get(e.id) as
        | { generated_by: string; generated_at: string; support_recommended: number; support_flags: string }
        | undefined;
      const feedback = db
        .prepare(
          `SELECT status, sent_at, edited_by_mentor FROM mentor_feedback WHERE evidence_id = ? ORDER BY created_at DESC LIMIT 1`
        )
        .get(e.id) as { status: string; sent_at: string | null; edited_by_mentor: number } | undefined;

      if (analysis?.support_recommended && !support) {
        support = {
          required: true,
          flags: JSON.parse(analysis.support_flags || "[]"),
        };
      }

      return {
        id: e.id,
        status: e.status,
        viaOfflineSync: Boolean(e.client_token),
        submittedAt: e.submitted_at,
        analysis: analysis
          ? {
              source: analysis.generated_by,
              generatedAt: analysis.generated_at,
              supportRecommended: Boolean(analysis.support_recommended),
              supportFlags: JSON.parse(analysis.support_flags || "[]"),
            }
          : null,
        feedback: feedback
          ? { status: feedback.status, sentAt: feedback.sent_at, editedByMentor: Boolean(feedback.edited_by_mentor) }
          : null,
      };
    });

    return {
      attemptNumber: t.attempt_number,
      taskId: t.id,
      taskTitle: t.title,
      taskStatus: t.status,
      generatedBy: t.generated_by,
      createdAt: t.created_at,
      practiceComplete: Boolean(practice),
      evidence,
    };
  });

  const adoption = db
    .prepare(
      `SELECT stage FROM adoption_events WHERE user_id = ? AND competency_id = ? ORDER BY rowid DESC LIMIT 1`
    )
    .get(userId, competencyId) as { stage: string } | undefined;

  const currentState = (events.at(-1)?.state ?? "NOT_STARTED") as WorkflowState;

  return {
    currentState,
    adoptionStage: adoption?.stage ?? null,
    support,
    events,
    attempts,
  };
}
