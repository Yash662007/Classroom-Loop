/**
 * Adoption progression (spec §19) — config-driven, not a scientific definition.
 *
 *   not_started -> practised -> attempted -> evidence_submitted
 *     -> feedback_received -> retried -> repeated -> sustained
 *
 * Rules live here so the ladder can be tuned without touching routes.
 */
import { getDb } from "@/db/instance";
import { ADOPTION_STAGES } from "@/db/schema";
import type { AdoptionStage } from "@/db/schema";

export { ADOPTION_STAGES };
export type { AdoptionStage };

export interface AdoptionRule {
  stage: AdoptionStage;
  /** Human description used in tooltips/UI. */
  description: string;
}

export const ADOPTION_RULES: Record<AdoptionStage, AdoptionRule> = {
  not_started: { stage: "not_started", description: "Training done; implementation not begun." },
  practised: { stage: "practised", description: "Completed an AI practice scenario." },
  attempted: { stage: "attempted", description: "Applied the technique in a real classroom lesson." },
  evidence_submitted: { stage: "evidence_submitted", description: "Submitted classroom evidence." },
  feedback_received: { stage: "feedback_received", description: "Received mentor feedback on an attempt." },
  retried: { stage: "retried", description: "Started another attempt after feedback." },
  repeated: { stage: "repeated", description: "Completed a second full attempt with evidence." },
  sustained: { stage: "sustained", description: "Three or more complete attempts with evidence and feedback." },
};

/** Records an adoption stage event if it advances the ladder for that competency. */
export function recordAdoptionEvent(
  userId: string,
  competencyId: string,
  stage: AdoptionStage,
  attemptNumber: number,
  detail?: string
): void {
  const db = getDb();
  const stageIndex = ADOPTION_STAGES.indexOf(stage);
  if (stageIndex < 0) return; // unknown stage — ignore rather than corrupt history

  const last = db
    .prepare(
      `SELECT stage FROM adoption_events WHERE user_id = ? AND competency_id = ? ORDER BY occurred_at DESC, rowid DESC LIMIT 1`
    )
    .get(userId, competencyId) as { stage: string } | undefined;

  const lastIndex = last ? ADOPTION_STAGES.indexOf(last.stage as AdoptionStage) : -1;
  // Never regress the visible ladder; retried can follow feedback_received, etc.
  if (stageIndex <= lastIndex) return;

  db.prepare(
    `INSERT INTO adoption_events (id, user_id, competency_id, stage, attempt_number, detail, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), userId, competencyId, stage, attemptNumber, detail ?? null, new Date().toISOString());
}

export interface AdoptionStatus {
  stage: AdoptionStage;
  stageIndex: number;
  label: string;
  description: string;
  nextStage: AdoptionStage | null;
  history: Array<{ stage: AdoptionStage; attempt_number: number; detail: string | null; occurred_at: string }>;
}

export function getAdoptionStatus(userId: string, competencyId: string): AdoptionStatus {
  const db = getDb();
  const history = db
    .prepare(
      `SELECT stage, attempt_number, detail, occurred_at FROM adoption_events
       WHERE user_id = ? AND competency_id = ? ORDER BY occurred_at ASC, rowid ASC`
    )
    .all(userId, competencyId) as AdoptionStatus["history"];

  const current =
    history.length > 0
      ? history.reduce(
          (acc, h) => {
            const idx = ADOPTION_STAGES.indexOf(h.stage);
            return idx > acc.idx ? { idx, stage: h.stage } : acc;
          },
          { idx: -1, stage: "not_started" as AdoptionStage }
        )
      : { idx: -1, stage: "not_started" as AdoptionStage };

  // "not_started" is the head of ADOPTION_STAGES (index 0) but is represented
  // internally by idx -1, so clamp to 0 before stepping to the next stage.
  const nextIdx = Math.max(current.idx, 0) + 1;
  const nextStage = nextIdx < ADOPTION_STAGES.length ? ADOPTION_STAGES[nextIdx] : null;
  return {
    stage: current.stage,
    stageIndex: current.idx,
    label: ADOPTION_RULES[current.stage].description,
    description: ADOPTION_RULES[current.stage].description,
    nextStage,
    history,
  };
}

/**
 * Sustained adoption rule (configurable): 3+ attempts each with evidence
 * and sent feedback. Returns true when the teacher qualifies.
 */
export function qualifiesForSustained(userId: string, competencyId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT t.attempt_number) AS attempts FROM implementation_tasks t
       WHERE t.user_id = ? AND t.competency_id = ?
         AND EXISTS (SELECT 1 FROM evidence_submissions e WHERE e.task_id = t.id)
         AND EXISTS (SELECT 1 FROM mentor_feedback f JOIN evidence_submissions e2 ON e2.id = f.evidence_id WHERE e2.task_id = t.id AND f.status = 'sent')`
    )
    .get(userId, competencyId) as { attempts: number };
  return row.attempts >= 3;
}
