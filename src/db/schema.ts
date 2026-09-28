/**
 * Classroom Loop — SQLite schema.
 *
 * One complete implementation journey, persisted:
 * training -> competency -> context -> task -> practice -> evidence
 *   -> ai analysis -> mentor feedback -> retry -> adoption.
 *
 * All timestamps are ISO-8601 strings (UTC) for simple portability.
 */
import type BetterSqlite3 from "better-sqlite3";

export type UserRole = "teacher" | "mentor" | "admin";

export type EvidenceKind = "text" | "voice" | "checklist" | "photo" | "video";

/** Config-driven adoption ladder (spec §19). Order is significant. */
export const ADOPTION_STAGES = [
  "not_started",
  "practised",
  "attempted",
  "evidence_submitted",
  "feedback_received",
  "retried",
  "repeated",
  "sustained",
] as const;

export type AdoptionStage = (typeof ADOPTION_STAGES)[number];

export const COMPETENCY_CHECK_STATUS = [
  "not_attempted",
  "passed",
  "needs_review",
] as const;

export type CompetencyCheckStatus = (typeof COMPETENCY_CHECK_STATUS)[number];

export const TASK_STATUS = [
  "assigned",
  "practised",
  "attempted",
  "completed",
] as const;

export type TaskStatus = (typeof TASK_STATUS)[number];

export const ANALYSIS_SOURCE = ["local_engine", "llm"] as const;
export type AnalysisSource = (typeof ANALYSIS_SOURCE)[number];

export function createSchema(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('teacher', 'mentor', 'admin')),
      password_hash TEXT NOT NULL,
      mentor_id TEXT REFERENCES users(id),
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_contexts (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      experience_years INTEGER NOT NULL DEFAULT 0,
      grades_taught TEXT NOT NULL DEFAULT '[]',
      subjects TEXT NOT NULL DEFAULT '[]',
      class_size INTEGER,
      multigrade INTEGER NOT NULL DEFAULT 0,
      school_context TEXT,
      challenges TEXT NOT NULL DEFAULT '[]',
      confidence INTEGER NOT NULL DEFAULT 3,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS competencies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS competency_criteria (
      id TEXT PRIMARY KEY,
      competency_id TEXT NOT NULL REFERENCES competencies(id),
      label TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS training_modules (
      id TEXT PRIMARY KEY,
      competency_id TEXT REFERENCES competencies(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS module_completions (
      user_id TEXT NOT NULL REFERENCES users(id),
      module_id TEXT NOT NULL REFERENCES training_modules(id),
      completed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS competency_results (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      competency_id TEXT NOT NULL REFERENCES competencies(id),
      status TEXT NOT NULL CHECK (status IN ('not_attempted', 'passed', 'needs_review')),
      score INTEGER NOT NULL DEFAULT 0,
      answers TEXT NOT NULL DEFAULT '{}',
      checked_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS implementation_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      competency_id TEXT NOT NULL REFERENCES competencies(id),
      attempt_number INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK (status IN ('assigned', 'practised', 'attempted', 'completed')),
      title TEXT NOT NULL,
      activity TEXT NOT NULL,
      practice_scenario TEXT NOT NULL,
      scenario_choices TEXT NOT NULL DEFAULT '[]',
      recommended_choice INTEGER,
      difficulty TEXT NOT NULL DEFAULT 'core',
      micro_learning TEXT NOT NULL DEFAULT '[]',
      support TEXT,
      reasoning TEXT,
      generated_by TEXT NOT NULL DEFAULT 'local_engine' CHECK (generated_by IN ('local_engine', 'llm')),
      personalization_snapshot TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES implementation_tasks(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      chosen_option INTEGER,
      was_correct INTEGER,
      reflection TEXT,
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      task_id TEXT NOT NULL REFERENCES implementation_tasks(id),
      attempt_number INTEGER NOT NULL DEFAULT 1,
      reflection TEXT NOT NULL,
      voice_note TEXT,
      checklist TEXT NOT NULL DEFAULT '{}',
      photo_path TEXT,
      voice_file TEXT,
      video_file TEXT,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'analyzed')),
      client_token TEXT UNIQUE,
      submitted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL UNIQUE REFERENCES evidence_submissions(id),
      observed TEXT NOT NULL,
      interpretation TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      criterion_hits TEXT NOT NULL DEFAULT '[]',
      support_flags TEXT NOT NULL DEFAULT '[]',
      support_recommended INTEGER NOT NULL DEFAULT 0,
      generated_by TEXT NOT NULL DEFAULT 'local_engine' CHECK (generated_by IN ('local_engine', 'llm')),
      generated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mentor_feedback (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL REFERENCES evidence_submissions(id),
      mentor_id TEXT NOT NULL REFERENCES users(id),
      draft TEXT NOT NULL,
      sent_message TEXT,
      status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted', 'sent')),
      drafted_by TEXT NOT NULL DEFAULT 'local_engine' CHECK (drafted_by IN ('local_engine', 'llm', 'mentor_written')),
      edited_by_mentor INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS adoption_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      competency_id TEXT NOT NULL REFERENCES competencies(id),
      stage TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 0,
      detail TEXT,
      occurred_at TEXT NOT NULL
    );

    -- Teacher support requests (Master Task GOAL 31): a structured "Need help?"
    -- signal raised by the teacher; consumed by mentor priority views and the
    -- workflow engine (SUPPORT_REQUIRED branch).
    CREATE TABLE IF NOT EXISTS support_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      competency_id TEXT,
      task_id TEXT,
      reason TEXT NOT NULL CHECK (reason IN ('dont_understand', 'cant_practise', 'tried_need_help', 'need_mentor', 'something_else')),
      message TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_support_user ON support_requests(user_id, status);

    -- Centralized workflow event log (GOAL 2): append-only, idempotent.
    -- what happened (state) + when (occurred_at) + who/what caused it (actor)
    -- + resulting and previous state. See src/lib/workflow.ts.
    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      -- No FK on competency_id: the log is append-only audit data and some
      -- events (e.g. CONTEXT_READY) legitimately span all competencies.
      competency_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 0,
      task_id TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL,
      previous_state TEXT,
      actor TEXT NOT NULL,
      detail TEXT,
      occurred_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      client_token TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('applied', 'duplicate')),
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user ON implementation_tasks(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_competency ON implementation_tasks(competency_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_task ON evidence_submissions(task_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_user ON evidence_submissions(user_id, submitted_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_competency ON implementation_tasks(user_id, competency_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_evidence ON mentor_feedback(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_adoption_user ON adoption_events(user_id, competency_id);
    CREATE INDEX IF NOT EXISTS idx_results_user ON competency_results(user_id, competency_id);
    CREATE INDEX IF NOT EXISTS idx_practice_task ON practice_sessions(task_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_events_unique
      ON workflow_events(user_id, competency_id, attempt_number, state, task_id);

    -- Legacy cleanup: sync_log was designed for sync bookkeeping but never
    -- written or read by any code path (client idempotency lives in
    -- evidence_submissions.client_token). Dropped per-boot.
    DROP TABLE IF EXISTS sync_log;
  `);

  migrateMentorFeedbackDraftedBy(db);
  migrateEvidenceMediaColumns(db);
}

/**
 * Adds the voice_file / video_file columns to evidence_submissions for DBs
 * created before voice (GOAL 16) and video (GOAL 17) media evidence.
 */
function migrateEvidenceMediaColumns(db: BetterSqlite3.Database): void {
  const cols = db.prepare(`PRAGMA table_info(evidence_submissions)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "voice_file")) {
    db.exec(`ALTER TABLE evidence_submissions ADD COLUMN voice_file TEXT;`);
  }
  if (!cols.some((c) => c.name === "video_file")) {
    db.exec(`ALTER TABLE evidence_submissions ADD COLUMN video_file TEXT;`);
  }
}

/**
 * One-time table rebuild for databases created before 'mentor_written' was a
 * valid drafted_by value (mentors may write feedback without an AI draft).
 */
function migrateMentorFeedbackDraftedBy(db: BetterSqlite3.Database): void {
  const existing = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mentor_feedback'`)
    .get() as { sql: string } | undefined;
  if (!existing || existing.sql.includes("mentor_written")) return;

  db.exec(`
    ALTER TABLE mentor_feedback RENAME TO mentor_feedback_old;
    CREATE TABLE mentor_feedback (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL REFERENCES evidence_submissions(id),
      mentor_id TEXT NOT NULL REFERENCES users(id),
      draft TEXT NOT NULL,
      sent_message TEXT,
      status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted', 'sent')),
      drafted_by TEXT NOT NULL DEFAULT 'local_engine' CHECK (drafted_by IN ('local_engine', 'llm', 'mentor_written')),
      edited_by_mentor INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );
    INSERT INTO mentor_feedback (id, evidence_id, mentor_id, draft, sent_message, status, drafted_by, edited_by_mentor, created_at, sent_at)
      SELECT id, evidence_id, mentor_id, draft, sent_message, status, drafted_by, edited_by_mentor, created_at, sent_at FROM mentor_feedback_old;
    DROP TABLE mentor_feedback_old;
    CREATE INDEX IF NOT EXISTS idx_feedback_evidence ON mentor_feedback(evidence_id);
  `);
}

/** Adds the voice_file column to evidence_submissions for DBs created before voice evidence (GOAL 16). */
function migrateEvidenceVoiceFile(db: BetterSqlite3.Database): void {
  const cols = db.prepare(`PRAGMA table_info(evidence_submissions)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "voice_file")) {
    db.exec(`ALTER TABLE evidence_submissions ADD COLUMN voice_file TEXT;`);
  }
}

