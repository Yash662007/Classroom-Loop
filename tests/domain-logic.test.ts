import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { getDb, resetDbForTests } from "@/db/instance";
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
  submitCompetencyCheck,
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
