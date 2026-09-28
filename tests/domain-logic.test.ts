import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { getDb, resetDbForTests } from "@/db/instance";
import {
  WORKFLOW_STATES,
  deriveWorkflowState,
  getLatestWorkflowState,
  recordWorkflowEvent,
} from "@/lib/workflow";
import { acknowledgeSupportRequest, createSupportRequest } from "@/lib/support";
import { listMentorSupportRequests } from "@/lib/mentor-loop";
import {
  ADOPTION_RULES,
  getAdoptionStatus,
  qualifiesForSustained,
  recordAdoptionEvent,
} from "@/lib/adoption";
import { ADOPTION_STAGES } from "@/db/schema";
import {
  ApiError,
} from "@/lib/api";
import {
  completeModule,
  generateTask,
  listCompetenciesWithStatus,
  savePracticeSession,
  startRetry,
  submitCompetencyCheck,
  submitEvidence,
  upsertContext,
} from "@/lib/teacher-loop";

/**
 * Each test gets its own throwaway SQLite database. DATA_DIR must be set
 * BEFORE getDb() first runs; resetDbForTests() clears the singleton between
 * tests so the new DATA_DIR takes effect.
 */
let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "classroom-loop-test-"));
  process.env.DATA_DIR = dataDir;
  resetDbForTests();
});
afterAll(() => {
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Windows may keep WAL handles open — the OS temp dir reclaims it.
  }
});

/* ---------------- Fixtures ---------------- */

function createUser(id: string, role: "teacher" | "mentor" | "admin", mentorId?: string): string {
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, role, password_hash, mentor_id, is_demo, created_at)
       VALUES (?, ?, ?, ?, 'test-hash', ?, 0, ?)`
    )
    .run(id, `${id}@tests.demo`, `User ${id}`, role, mentorId ?? null, new Date().toISOString());
  return id;
}

function createCompetency(id: string, criteriaLabels: string[]): string[] {
  const db = getDb();
  db.prepare(`INSERT INTO competencies (id, title, description, created_at) VALUES (?, ?, ?, ?)`).run(
    id,
    `Competency ${id}`,
    "Test competency",
    new Date().toISOString()
  );
  for (const [i, label] of criteriaLabels.entries()) {
    db.prepare(
      `INSERT INTO competency_criteria (id, competency_id, label, keywords, display_order) VALUES (?, ?, ?, '[]', ?)`
    ).run(randomUUID(), id, label, i);
  }
  return criteriaLabels;
}

/** One complete attempt: task + evidence + mentor feedback marked 'sent'. */
function seedAttemptCycle(
  teacherId: string,
  competencyId: string,
  attemptNumber: number,
  mentorId: string,
  feedbackStatus: "sent" | "drafted" = "sent"
): { taskId: string; evidenceId: string } {
  const db = getDb();
  const now = new Date().toISOString();
  const taskId = randomUUID();
  db.prepare(
    `INSERT INTO implementation_tasks
       (id, user_id, competency_id, attempt_number, status, title, activity, practice_scenario,
        scenario_choices, recommended_choice, difficulty, micro_learning, support, reasoning,
        generated_by, personalization_snapshot, created_at)
     VALUES (?, ?, ?, ?, 'completed', 'Task', 'Activity', 'Scenario', '[]', NULL, 'core', '[]', NULL, NULL, 'local_engine', '{}', ?)`
  ).run(taskId, teacherId, competencyId, attemptNumber, now);
  const evidenceId = randomUUID();
  db.prepare(
    `INSERT INTO evidence_submissions
       (id, user_id, task_id, attempt_number, reflection, voice_note, checklist, photo_path, status, client_token, submitted_at)
     VALUES (?, ?, ?, ?, 'I tried the technique', NULL, '{}', NULL, 'analyzed', NULL, ?)`
  ).run(evidenceId, teacherId, taskId, attemptNumber, now);
  db.prepare(
    `INSERT INTO mentor_feedback
       (id, evidence_id, mentor_id, draft, sent_message, status, drafted_by, edited_by_mentor, created_at, sent_at)
     VALUES (?, ?, ?, 'draft', 'sent message', ?, 'local_engine', 0, ?, ?)`
  ).run(randomUUID(), evidenceId, mentorId, feedbackStatus, now, feedbackStatus === "sent" ? now : null);
  return { taskId, evidenceId };
}

const TEACHER = "t-ladder";
const MENTOR = "m-ladder";
const COMP = "comp-test";

/* ---------------- Adoption ladder ---------------- */

describe("adoption ladder (config-driven)", () => {
  it("defines a rule with a description for every stage of the ladder", () => {
    expect(Object.keys(ADOPTION_RULES)).toEqual([...ADOPTION_STAGES]);
    for (const stage of ADOPTION_STAGES) {
      expect(ADOPTION_RULES[stage].stage).toBe(stage);
      expect(ADOPTION_RULES[stage].description.length).toBeGreaterThan(0);
    }
    expect(ADOPTION_RULES.sustained.description).toMatch(/Three or more/);
  });

  it("reports not_started with no history for a fresh teacher", () => {
    const status = getAdoptionStatus(TEACHER, COMP);
    expect(status.stage).toBe("not_started");
    expect(status.history).toEqual([]);
    expect(status.nextStage).toBe("practised");
  });

  it("advances in order and keeps the full history", () => {
    createUser(TEACHER, "teacher");
    createCompetency(COMP, ["c1"]);
    recordAdoptionEvent(TEACHER, COMP, "practised", 1);
    recordAdoptionEvent(TEACHER, COMP, "attempted", 1);
    recordAdoptionEvent(TEACHER, COMP, "evidence_submitted", 1);
    recordAdoptionEvent(TEACHER, COMP, "feedback_received", 1);
    recordAdoptionEvent(TEACHER, COMP, "retried", 2);

    const status = getAdoptionStatus(TEACHER, COMP);
    expect(status.stage).toBe("retried");
    expect(status.history.map((h) => h.stage)).toEqual([
      "practised",
      "attempted",
      "evidence_submitted",
      "feedback_received",
      "retried",
    ]);
    expect(status.nextStage).toBe("repeated");
  });

  it("never regresses: an earlier stage after a later one is ignored", () => {
    createUser(TEACHER, "teacher");
    createCompetency(COMP, ["c1"]);
    recordAdoptionEvent(TEACHER, COMP, "attempted", 1);
    recordAdoptionEvent(TEACHER, COMP, "practised", 1); // backwards — must be ignored

    const status = getAdoptionStatus(TEACHER, COMP);
    expect(status.stage).toBe("attempted");
    expect(status.history).toHaveLength(1);
  });

  it("silently ignores an unknown stage instead of corrupting history", () => {
    createUser(TEACHER, "teacher");
    recordAdoptionEvent(TEACHER, COMP, "not_a_real_stage" as never, 1);
    expect(getAdoptionStatus(TEACHER, COMP).history).toEqual([]);
  });

  it("tracks ladders per competency independently and ends with no next stage", () => {
    createUser(TEACHER, "teacher");
    createCompetency("comp-a", ["a1"]);
    createCompetency(COMP, ["c1"]);
    recordAdoptionEvent(TEACHER, "comp-a", "practised", 1);
    recordAdoptionEvent(TEACHER, COMP, "practised", 1);
    expect(getAdoptionStatus(TEACHER, "comp-a").stage).toBe("practised");

    for (const stage of ADOPTION_STAGES.slice(1)) {
      recordAdoptionEvent(TEACHER, COMP, stage, 1);
    }
    const done = getAdoptionStatus(TEACHER, COMP);
    expect(done.stage).toBe("sustained");
    expect(done.nextStage).toBeNull();
  });
});

/* ---------------- Sustained adoption rule ---------------- */

describe("qualifiesForSustained", () => {
  beforeEach(() => {
    createUser(TEACHER, "teacher");
    createUser(MENTOR, "mentor");
    createCompetency(COMP, ["c1", "c2"]);
  });

  it("is false before any attempts exist", () => {
    expect(qualifiesForSustained(TEACHER, COMP)).toBe(false);
  });

  it("requires 3 distinct attempts each with evidence AND sent feedback", () => {
    for (let i = 1; i <= 3; i++) seedAttemptCycle(TEACHER, COMP, i, MENTOR);
    expect(qualifiesForSustained(TEACHER, COMP)).toBe(true);
  });

  it("is false with only 2 complete cycles", () => {
    for (let i = 1; i <= 2; i++) seedAttemptCycle(TEACHER, COMP, i, MENTOR);
    expect(qualifiesForSustained(TEACHER, COMP)).toBe(false);
  });

  it("does not count evidence without sent feedback", () => {
    for (let i = 1; i <= 3; i++) seedAttemptCycle(TEACHER, COMP, i, MENTOR, "drafted");
    expect(qualifiesForSustained(TEACHER, COMP)).toBe(false);
  });

  it("requires distinct attempts — 3 feedbacks on one attempt do not qualify", () => {
    const { evidenceId } = seedAttemptCycle(TEACHER, COMP, 1, MENTOR);
    const db = getDb();
    // Two extra 'sent' feedback rows on the same evidence/attempts.
    for (let i = 0; i < 2; i++) {
      db.prepare(
        `INSERT INTO mentor_feedback (id, evidence_id, mentor_id, draft, status, drafted_by, created_at)
         VALUES (?, ?, ?, 'draft', 'sent', 'mentor_written', ?)`
      ).run(randomUUID(), evidenceId, MENTOR, new Date().toISOString());
    }
    expect(qualifiesForSustained(TEACHER, COMP)).toBe(false);
  });
});

/* ---------------- Competency check threshold ---------------- */

describe("submitCompetencyCheck threshold", () => {
  const TEACHER = "t-check";
  const LABELS = ["q1", "q2", "q3", "q4", "q5"];

  beforeEach(() => {
    createUser(TEACHER, "teacher");
    createCompetency("comp-check", LABELS);
  });

  it("passes at exactly 80% (8/10) and persists the result", () => {
    const result = submitCompetencyCheck(TEACHER, "comp-check", { q1: 2, q2: 2, q3: 2, q4: 1, q5: 1 });
    expect(result).toEqual({ status: "passed", score: 8, total: 10 });

    const view = listCompetenciesWithStatus(TEACHER).find((c) => c.id === "comp-check");
    expect(view?.check).toMatchObject({ status: "passed", score: 8, total: 10 });
  });

  it("needs review below 80% (7/10), and the latest attempt wins", () => {
    const first = submitCompetencyCheck(TEACHER, "comp-check", { q1: 2, q2: 2, q3: 2, q4: 1, q5: 1 });
    expect(first.status).toBe("passed");
    const second = submitCompetencyCheck(TEACHER, "comp-check", { q1: 2, q2: 2, q3: 2, q4: 1, q5: 0 });
    expect(second).toEqual({ status: "needs_review", score: 7, total: 10 });

    const view = listCompetenciesWithStatus(TEACHER).find((c) => c.id === "comp-check");
    expect(view?.check?.status).toBe("needs_review");
  });

  it("clamps out-of-range answers instead of crashing or inflating the score", () => {
    const result = submitCompetencyCheck(TEACHER, "comp-check", { q1: 99, q2: -5 });
    expect(result).toEqual({ status: "needs_review", score: 2, total: 10 });
  });

  it("scores missing answers as 0", () => {
    const result = submitCompetencyCheck(TEACHER, "comp-check", {});
    expect(result).toEqual({ status: "needs_review", score: 0, total: 10 });
  });

  it("rejects a competency with no check items", () => {
    createCompetency("comp-empty", []);
    expect(() => submitCompetencyCheck(TEACHER, "comp-empty", {})).toThrowError(ApiError);
  });
});

/* ---------------- Training module completion ---------------- */

describe("completeModule + training gate", () => {
  const TEACHER = "t-train";

  beforeEach(() => {
    createUser(TEACHER, "teacher");
    const db = getDb();
    db.prepare(`INSERT INTO competencies (id, title, description, created_at) VALUES ('comp-train', 'T', 'd', ?)`).run(new Date().toISOString());
    db.prepare(`INSERT INTO training_modules (id, competency_id, title, description, display_order) VALUES ('mod-1', 'comp-train', 'M1', 'd', 0)`).run();
    db.prepare(`INSERT INTO training_modules (id, competency_id, title, description, display_order) VALUES ('mod-2', 'comp-train', 'M2', 'd', 1)`).run();
  });

  it("marks a module complete and reports progress toward the gate", () => {
    expect(completeModule(TEACHER, "mod-1")).toEqual({ completed: 1, total: 2, trainingComplete: false });
    expect(completeModule(TEACHER, "mod-2")).toEqual({ completed: 2, total: 2, trainingComplete: true });
  });

  it("is idempotent — repeating a module does not double-count", () => {
    completeModule(TEACHER, "mod-1");
    completeModule(TEACHER, "mod-1");
    expect(completeModule(TEACHER, "mod-1")).toEqual({ completed: 1, total: 2, trainingComplete: false });
  });

  it("unlocks the competency check only when every module is complete", () => {
    completeModule(TEACHER, "mod-1");
    expect(listCompetenciesWithStatus(TEACHER).find((c) => c.id === "comp-train")?.trainingComplete).toBe(false);
    completeModule(TEACHER, "mod-2");
    expect(listCompetenciesWithStatus(TEACHER).find((c) => c.id === "comp-train")?.trainingComplete).toBe(true);
  });

  it("rejects unknown module ids", () => {
    expect(() => completeModule(TEACHER, "nope")).toThrowError(ApiError);
  });
});

/* ---------------- Task generation guards ---------------- */

describe("generateTask guard rails", () => {
  const TEACHER = "t-task";

  beforeEach(() => {
    createUser(TEACHER, "teacher");
    createCompetency("comp-task", ["c1", "c2"]);
  });

  it("requires teaching context first", async () => {
    const err = await generateTask(TEACHER, "comp-task").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).code).toBe("context_required");
  });

  it("requires a competency check after context", async () => {
    await upsertContext(TEACHER, {
      experience_years: 4, grades_taught: [3, 4], subjects: ["Science"], class_size: 42,
      multigrade: false, school_context: null, challenges: [], confidence: 3,
    });
    const err = await generateTask(TEACHER, "comp-task").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("check_required");
  });

  it("generates a local-engine task once context + check exist, then reuses it", async () => {
    await upsertContext(TEACHER, {
      experience_years: 4, grades_taught: [3, 4], subjects: ["Science"], class_size: 42,
      multigrade: false, school_context: null, challenges: [], confidence: 3,
    });
    submitCompetencyCheck(TEACHER, "comp-task", { c1: 2, c2: 1 });

    const first = await generateTask(TEACHER, "comp-task");
    expect(first.reusedExisting).toBe(false);
    expect(first.aiSource).toBe("local_engine"); // deterministic engine — no LLM key in tests
    expect(first.task.attempt_number).toBe(1);
    expect(first.task.activity).toMatch(/comp-task/i); // includes the competency title
    expect(JSON.parse(first.task.scenario_choices)).toHaveLength(4);

    const second = await generateTask(TEACHER, "comp-task");
    expect(second.reusedExisting).toBe(true);
    expect(second.task.id).toBe(first.task.id);

    const forced = await generateTask(TEACHER, "comp-task", { forceNew: true });
    expect(forced.reusedExisting).toBe(false);
    expect(forced.task.attempt_number).toBe(2);
  });
});

/* ---------------- Centralized workflow engine ---------------- */

describe("workflow engine (centralized pipeline state)", () => {
  it("defines all 23 required pipeline states", () => {
    expect([...WORKFLOW_STATES]).toEqual([
      "NOT_STARTED", "TRAINING_COMPLETE", "CONTEXT_READY", "ACTION_ASSIGNED",
      "PRACTICE_PENDING", "PRACTICE_COMPLETE", "CLASSROOM_ATTEMPT_PENDING",
      "CLASSROOM_ATTEMPT_RECORDED", "EVIDENCE_PENDING", "EVIDENCE_SUBMITTED",
      "AI_ANALYSIS_PENDING", "AI_ANALYSIS_COMPLETE", "MENTOR_REVIEW_PENDING",
      "MENTOR_REVIEWED", "FEEDBACK_SENT", "RETRY_REQUIRED", "RETRY_IN_PROGRESS",
      "RETRY_COMPLETED", "REPEATED_IMPLEMENTATION", "SUSTAINED_ADOPTION",
      "SUPPORT_REQUIRED", "SYNC_PENDING", "SYNC_FAILED",
    ]);
  });

  it("stores what/when/who + current and previous state for every event", async () => {
    createUser("t-wf1", "teacher");
    createCompetency("comp-wf1", ["c1"]);

    await upsertContext("t-wf1", {
      experience_years: 2, grades_taught: [1], subjects: ["Math"], class_size: 30,
      multigrade: false, school_context: null, challenges: [], confidence: 3,
    });
    submitCompetencyCheck("t-wf1", "comp-wf1", { c1: 2 });
    await generateTask("t-wf1", "comp-wf1");

    const w = deriveWorkflowState("t-wf1", "comp-wf1");
    expect(w.currentState).toBe("ACTION_ASSIGNED");
    expect(w.events.map((e) => e.state)).toEqual([
      "CONTEXT_READY", "TRAINING_COMPLETE", "ACTION_ASSIGNED",
    ]);
    // Every event carries the four required dimensions.
    for (const e of w.events) {
      expect(e.occurredAt).toBeTruthy();
      expect(e.actor).toBeTruthy();
      expect(e.previousState).toBeDefined();
    }
    expect(w.events[1].previousState).toBe("CONTEXT_READY");
    expect(w.events[1].actor).toMatch(/^teacher:/); // who caused it
    expect(w.events[2].attemptNumber).toBe(1);
    expect(w.events[2].taskId).toBe(w.attempts[0].taskId); // attempt linkage
  });

  it("records branching: low check score raises SUPPORT_REQUIRED", () => {
    createUser("t-wf2", "teacher");
    createCompetency("comp-wf2", ["c1", "c2"]);
    submitCompetencyCheck("t-wf2", "comp-wf2", { c1: 0, c2: 0 }); // 0% -> needs_review

    expect(getLatestWorkflowState("t-wf2", "comp-wf2")).toBe("SUPPORT_REQUIRED");
  });

  it("records branching: analysis support signals raise SUPPORT_REQUIRED before mentor review", () => {
    createUser("m-wf3", "mentor");
    createUser("t-wf3", "teacher");
    createCompetency("comp-wf3", ["c1"]);
    const { taskId, evidenceId } = seedAttemptCycle("t-wf3", "comp-wf3", 1, "m-wf3");
    // The support branch derives from the analysis row, so the flagged analysis
    // must exist before the engine can record the branch.
    getDb()
      .prepare(
        `INSERT INTO ai_analyses (id, evidence_id, observed, interpretation, recommendation, criterion_hits, support_flags, support_recommended, generated_by, generated_at)
         VALUES (?, ?, '[]', '[]', '[]', '[]', '[{"signal":"s","detail":"d","severity":"watch"}]', 1, 'local_engine', ?)`
      )
      .run(randomUUID(), evidenceId, new Date().toISOString());
    recordWorkflowEvent({
      userId: "t-wf3",
      competencyId: "comp-wf3",
      state: "SUPPORT_REQUIRED",
      attemptNumber: 1,
      taskId,
      actor: "system:analysis pipeline",
      detail: "AI detected support signals in the evidence",
    });
    const w = deriveWorkflowState("t-wf3", "comp-wf3");
    expect(w.events.some((e) => e.state === "SUPPORT_REQUIRED")).toBe(true);
    expect(w.support?.required).toBe(true); // derived from the flagged analysis row
  });

  it("survives interrupted requests: recording the same transition twice is idempotent", () => {
    createUser("t-wf4", "teacher");
    createCompetency("comp-wf4", ["c1"]);
    const input = {
      userId: "t-wf4",
      competencyId: "comp-wf4",
      state: "EVIDENCE_SUBMITTED" as const,
      attemptNumber: 1,
      taskId: "task-1",
    };
    recordWorkflowEvent(input);
    recordWorkflowEvent(input); // replayed offline sync / retried request
    recordWorkflowEvent({ ...input, occurredAt: "2020-01-01T00:00:00.000Z" }); // different timestamp
    const w = deriveWorkflowState("t-wf4", "comp-wf4");
    expect(w.events).toHaveLength(1); // unique index dedupes
    expect(w.currentState).toBe("EVIDENCE_SUBMITTED");
  });

  it("supports retry loops without deleting previous attempts", async () => {
    createUser("m-wf5", "mentor");
    createUser("t-wf5", "teacher", "m-wf5");
    createCompetency("comp-wf5", ["c1"]);
    await upsertContext("t-wf5", {
      experience_years: 5, grades_taught: [5], subjects: ["Art"], class_size: 25,
      multigrade: true, school_context: null, challenges: [], confidence: 2,
    });
    submitCompetencyCheck("t-wf5", "comp-wf5", { c1: 2 });

    // Attempt 1: real task -> practice -> evidence -> local AI analysis.
    const first = await generateTask("t-wf5", "comp-wf5");
    savePracticeSession("t-wf5", first.task.id, first.task.recommended_choice ?? 0);
    const ev1 = await submitEvidence({
      userId: "t-wf5",
      taskId: first.task.id,
      reflection: "I tried asking open questions and gave students thinking time.",
      voiceNote: null,
      checklist: {},
      photoPath: null,
      clientToken: null,
    });
    expect(ev1.duplicate).toBe(false);
    expect(ev1.analysis).not.toBeNull();

    // Mentor decision recorded as sent (human step of attempt 1).
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO mentor_feedback (id, evidence_id, mentor_id, draft, sent_message, status, drafted_by, edited_by_mentor, created_at, sent_at)
         VALUES (?, ?, 'm-wf5', 'd', 'sent', 'sent', 'local_engine', 0, ?, ?)`
      )
      .run(randomUUID(), ev1.evidenceId, now, now);

    // Attempt 2 (retry): previous attempt must remain intact.
    const retry = await startRetry("t-wf5", "comp-wf5");
    expect(retry.task.attempt_number).toBe(2);
    const ev2 = await submitEvidence({
      userId: "t-wf5",
      taskId: retry.task.id,
      reflection: "Second attempt: I paired students before whole-class discussion.",
      voiceNote: null,
      checklist: {},
      photoPath: null,
      clientToken: null,
    });
    expect(ev2.duplicate).toBe(false);

    const w = deriveWorkflowState("t-wf5", "comp-wf5");
    expect(w.attempts).toHaveLength(2); // history preserved, never overwritten
    expect(w.attempts[0].evidence).toHaveLength(1);
    expect(w.attempts[0].evidence[0].feedback?.status).toBe("sent");
    expect(w.attempts[1].evidence).toHaveLength(1);

    const states = w.events.map((e) => e.state);
    for (const s of [
      "CONTEXT_READY", "TRAINING_COMPLETE", "ACTION_ASSIGNED", "PRACTICE_COMPLETE",
      "EVIDENCE_SUBMITTED", "AI_ANALYSIS_COMPLETE", "MENTOR_REVIEW_PENDING", "RETRY_IN_PROGRESS",
    ]) {
      expect(states).toContain(s);
    }
    // The retry event belongs to attempt 2; attempt-1 events keep their linkage.
    const retryEvent = w.events.find((e) => e.state === "RETRY_IN_PROGRESS");
    expect(retryEvent?.attemptNumber).toBe(2);
    expect(w.events.filter((e) => e.state === "EVIDENCE_SUBMITTED")).toHaveLength(2);
    // Attempt 2's evidence was analyzed last, so the pipeline is awaiting review.
    expect(w.currentState).toBe("MENTOR_REVIEW_PENDING");
  });

  it("derives AI jobs, mentor decisions and adoption alongside the event log", async () => {
    createUser("m-wf6", "mentor");
    createUser("t-wf6", "teacher", "m-wf6");
    createCompetency("comp-wf6", ["c1"]);
    const { evidenceId } = seedAttemptCycle("t-wf6", "comp-wf6", 1, "m-wf6");
    // Mirror the mentor-send adoption step the real approveAndSendFeedback performs.
    recordAdoptionEvent("t-wf6", "comp-wf6", "feedback_received", 1);
    getDb()
      .prepare(
        `INSERT INTO ai_analyses (id, evidence_id, observed, interpretation, recommendation, criterion_hits, support_flags, support_recommended, generated_by, generated_at)
         VALUES (?, ?, '[]', '[]', '[]', '[]', '[{"signal":"s","detail":"d","severity":"watch"}]', 0, 'local_engine', ?)`
      )
      .run(randomUUID(), evidenceId, new Date().toISOString());

    const w = deriveWorkflowState("t-wf6", "comp-wf6");
    expect(w.attempts[0].evidence[0].analysis?.source).toBe("local_engine"); // AI job connected
    expect(w.attempts[0].evidence[0].feedback?.status).toBe("sent"); // mentor decision connected
    expect(w.adoptionStage).toBe("feedback_received"); // adoption connected
  });

  it("raises SUPPORT_REQUIRED when a teacher asks for help, and records mentor acknowledgement", () => {
    createUser("m-s1", "mentor");
    createUser("t-s1", "teacher", "m-s1");
    createCompetency("comp-s1", ["c1"]);

    const created = createSupportRequest({
      userId: "t-s1",
      competencyId: "comp-s1",
      reason: "tried_need_help",
      message: "Students stayed quiet — what am I doing wrong?",
    });
    expect(created.id).toBeTruthy();

    // Workflow branch recorded with the teacher as the actor.
    const w = deriveWorkflowState("t-s1", "comp-s1");
    const supportEvents = w.events.filter((e) => e.state === "SUPPORT_REQUIRED");
    expect(supportEvents).toHaveLength(1);
    expect(supportEvents[0].actor).toMatch(/^teacher:/);
    expect(supportEvents[0].detail).toMatch(/tried it in class/i);

    // Mentor sees the request and the acknowledgement is logged under their name.
    const queue = listMentorSupportRequests("m-s1");
    expect(queue).toHaveLength(1);
    expect(queue[0].teacher.id).toBe("t-s1");
    expect(queue[0].reasonLabel).toMatch(/need help/i);

    acknowledgeSupportRequest("m-s1", created.id);
    expect(listMentorSupportRequests("m-s1")).toHaveLength(0); // no longer open
    const w2 = deriveWorkflowState("t-s1", "comp-s1");
    const ack = w2.events.at(-1);
    expect(ack?.actor).toBe("mentor:User m-s1");
    expect(ack?.detail).toMatch(/acknowledged/i);
  });

  it("a mentor cannot acknowledge a support request for a teacher not assigned to them", () => {
    createUser("m-s2", "mentor");
    createUser("m-s3", "mentor");
    createUser("t-s2", "teacher", "m-s2");
    const created = createSupportRequest({ userId: "t-s2", reason: "need_mentor" });
    expect(() => acknowledgeSupportRequest("m-s3", created.id)).toThrow(ApiError);
    expect(() => acknowledgeSupportRequest("m-s3", created.id)).toThrow(/not assigned/);
  });
});
