/**
 * Mentor loop domain layer — the human-in-the-loop step.
 *
 * AI produces drafts and insights; the mentor reviews, edits, approves and
 * sends. The AI is never the final authority (spec §13).
 */
import { randomUUID } from "node:crypto";
import { ApiError } from "./api";
import { getDb } from "@/db/instance";
import { draftFeedback } from "./ai/service";
import { getAnalysisByEvidenceId, getEvidence, getImplementationHistory, getContext } from "./teacher-loop";
import type { EvidenceRow } from "./teacher-loop";
import { recordAdoptionEvent, getAdoptionStatus } from "./adoption";
import { recordWorkflowEvent } from "./workflow";
import { SUPPORT_REASON_LABELS } from "./support";

export interface AssignedTeacher {
  id: string;
  name: string;
  email: string;
  context: ReturnType<typeof getContext>;
  adoptionStage: string;
  attempts: number;
  evidencePending: number;
  feedbackSent: number;
  supportFlags: Array<{ signal: string; detail: string; severity: string }>;
  supportRecommended: boolean;
}

/** Teachers assigned to this mentor, ordered by support need (spec: AI 4). */
export function listAssignedTeachers(mentorId: string): AssignedTeacher[] {
  const db = getDb();
  const teachers = db
    .prepare(`SELECT id, name, email FROM users WHERE role = 'teacher' AND mentor_id = ? ORDER BY name`)
    .all(mentorId) as Array<{ id: string; name: string; email: string }>;

  return teachers
    .map((t) => {
      const ctx = getContext(t.id);
      const adoption = db
        .prepare(
          `SELECT stage FROM adoption_events WHERE user_id = ? ORDER BY occurred_at DESC, rowid DESC LIMIT 1`
        )
        .get(t.id) as { stage: string } | undefined;

      const comps = db
        .prepare(
          `SELECT DISTINCT t.competency_id AS id FROM implementation_tasks t WHERE t.user_id = ?`
        )
        .all(t.id) as Array<{ id: string }>;

      let attempts = 0;
      let evidencePending = 0;
      let feedbackSent = 0;
      const supportFlags: AssignedTeacher["supportFlags"] = [];

      for (const c of comps) {
        const a = db
          .prepare(`SELECT COUNT(*) AS n FROM implementation_tasks WHERE user_id = ? AND competency_id = ?`)
          .get(t.id, c.id) as { n: number };
        attempts += a.n;
        // Awaiting review = evidence with no sent feedback for it.
        const p = db
          .prepare(
            `SELECT COUNT(*) AS n FROM evidence_submissions e JOIN implementation_tasks t2 ON t2.id = e.task_id
             WHERE e.user_id = ? AND t2.competency_id = ?
               AND NOT EXISTS (SELECT 1 FROM mentor_feedback f WHERE f.evidence_id = e.id AND f.status = 'sent')`
          )
          .get(t.id, c.id) as { n: number };
        evidencePending += p.n;
        const f = db
          .prepare(
            `SELECT COUNT(*) AS n FROM mentor_feedback fb
             JOIN evidence_submissions e ON e.id = fb.evidence_id
             JOIN implementation_tasks t2 ON t2.id = e.task_id
             WHERE t2.user_id = ? AND t2.competency_id = ? AND fb.status = 'sent'`
          )
          .get(t.id, c.id) as { n: number };
        feedbackSent += f.n;

        // Latest analysis per competency carries the support signals.
        const latest = db
          .prepare(
            `SELECT ai.support_flags, ai.support_recommended FROM ai_analyses ai
             JOIN evidence_submissions e ON e.id = ai.evidence_id
             JOIN implementation_tasks t2 ON t2.id = e.task_id
             WHERE t2.user_id = ? AND t2.competency_id = ?
             ORDER BY ai.generated_at DESC LIMIT 1`
          )
          .get(t.id, c.id) as { support_flags: string; support_recommended: number } | undefined;
        if (latest) {
          const flags = JSON.parse(latest.support_flags) as AssignedTeacher["supportFlags"];
          supportFlags.push(...flags);
        }
      }

      // Mentor-visible watchlist signals from context — deduped against AI flags.
      const seen = new Set(supportFlags.map((f) => f.signal.toLowerCase()));
      if (ctx && ctx.confidence <= 2 && !seen.has("low self-reported confidence")) {
        supportFlags.push({ signal: "Low self-reported confidence", detail: `${ctx.confidence}/5 on their context profile.`, severity: "watch" });
        seen.add("low self-reported confidence");
      }
      if (attempts > 0 && feedbackSent === 0 && !seen.has("no feedback sent yet")) {
        supportFlags.push({ signal: "No feedback sent yet", detail: `${attempts} attempt(s) recorded without any sent feedback.`, severity: "watch" });
        seen.add("no feedback sent yet");
      }

      const supportRecommended =
        evidencePending > 0 ||
        supportFlags.some((f) => f.severity === "alert") ||
        (attempts >= 2 && feedbackSent === 0);

      return {
        id: t.id,
        name: t.name,
        email: t.email,
        context: ctx,
        adoptionStage: adoption?.stage ?? "not_started",
        attempts,
        evidencePending,
        feedbackSent,
        supportFlags,
        supportRecommended,
      };
    })
    .sort((a, b) => {
      // Support-first ordering: alerts, then pending reviews, then watch flags, then name.
      const rank = (t: AssignedTeacher) =>
        (t.supportFlags.some((f) => f.severity === "alert") ? 2 : 0) +
        (t.evidencePending > 0 ? 1 : 0) +
        (t.supportFlags.length > 0 ? 0.5 : 0);
      const diff = rank(b) - rank(a);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
}

export interface QueueItem {
  evidenceId: string;
  taskId: string;
  attemptNumber: number;
  teacher: { id: string; name: string };
  competencyTitle: string;
  submittedAt: string;
  hasFeedbackDraft: boolean;
  supportRecommended: boolean;
  topSupportSignal: string | null;
  preview: string;
}

export interface MentorSupportRequest {
  id: string;
  teacher: { id: string; name: string };
  reasonLabel: string;
  message: string | null;
  competencyTitle: string | null;
  createdAt: string;
}

/** Open "Need help?" requests from this mentor's assigned teachers (GOAL 31/33). */
export function listMentorSupportRequests(mentorId: string): MentorSupportRequest[] {
  const rows = getDb()
    .prepare(
      `SELECT r.id, r.reason, r.message, r.created_at,
              u.id AS teacher_id, u.name AS teacher_name, c.title AS competency_title
       FROM support_requests r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN competencies c ON c.id = r.competency_id
       WHERE u.mentor_id = ? AND r.status = 'open'
       ORDER BY r.created_at DESC LIMIT 25`
    )
    .all(mentorId) as Array<{
    id: string; reason: string; message: string | null; created_at: string;
    teacher_id: string; teacher_name: string; competency_title: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    teacher: { id: r.teacher_id, name: r.teacher_name },
    reasonLabel: SUPPORT_REASON_LABELS[r.reason as keyof typeof SUPPORT_REASON_LABELS] ?? r.reason,
    message: r.message,
    competencyTitle: r.competency_title,
    createdAt: r.created_at,
  }));
}

/** Evidence awaiting mentor review, support-need first. */
export function getReviewQueue(mentorId: string): QueueItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.id AS evidence_id, e.task_id, e.attempt_number, e.reflection, e.submitted_at,
              u.id AS teacher_id, u.name AS teacher_name,
              c.title AS competency_title,
              (SELECT COUNT(*) FROM mentor_feedback f WHERE f.evidence_id = e.id) AS feedback_count,
              ai.support_recommended, ai.support_flags
       FROM evidence_submissions e
       JOIN implementation_tasks t ON t.id = e.task_id
       JOIN competencies c ON c.id = t.competency_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN ai_analyses ai ON ai.evidence_id = e.id
       WHERE u.mentor_id = ?
         AND NOT EXISTS (SELECT 1 FROM mentor_feedback f WHERE f.evidence_id = e.id AND f.status = 'sent')
       ORDER BY e.submitted_at ASC`
    )
    .all(mentorId) as Array<{
      evidence_id: string; task_id: string; attempt_number: number; reflection: string; submitted_at: string;
      teacher_id: string; teacher_name: string; competency_title: string;
      feedback_count: number; support_recommended: number | null; support_flags: string | null;
    }>;

  return rows
    .map((r) => {
      const flags = r.support_flags ? (JSON.parse(r.support_flags) as Array<{ signal: string; severity: string }>) : [];
      const alert = flags.find((f) => f.severity === "alert") ?? null;
      return {
        evidenceId: r.evidence_id,
        taskId: r.task_id,
        attemptNumber: r.attempt_number,
        teacher: { id: r.teacher_id, name: r.teacher_name },
        competencyTitle: r.competency_title,
        submittedAt: r.submitted_at,
        hasFeedbackDraft: r.feedback_count > 0,
        supportRecommended: Number(r.support_recommended ?? 0) === 1 || flags.length > 0,
        topSupportSignal: alert?.signal ?? flags[0]?.signal ?? null,
        preview: r.reflection.slice(0, 140),
      };
    })
    .sort((a, b) => {
      const rank = (q: QueueItem) => (q.topSupportSignal ? 1 : 0);
      return rank(b) - rank(a) || a.submittedAt.localeCompare(b.submittedAt);
    });
}

export interface MentorEvidenceView {
  evidence: {
    id: string;
    taskId: string;
    attemptNumber: number;
    reflection: string;
    voiceNote: string | null;
    checklist: Record<string, boolean>;
    photoPath: string | null;
    voiceFile: string | null;
    videoFile: string | null;
    submittedAt: string;
  };
  analysis: ReturnType<typeof getAnalysisByEvidenceId>;
  teacher: { id: string; name: string; email: string; context: ReturnType<typeof getContext> };
  task: { title: string; activity: string; difficulty: string; attemptNumber: number };
  competency: { id: string; title: string };
  practice: { chosenOption: number; wasCorrect: boolean; reflection: string | null; completedAt: string } | null;
  existingFeedback: { id: string; draft: string; status: string; draftedBy: string; editedByMentor: boolean } | null;
  adoption: ReturnType<typeof getAdoptionStatus>;
}

/** Full review payload: evidence + AI analysis + context + draft, side by side. */
export function getMentorEvidenceView(mentorId: string, evidenceId: string): MentorEvidenceView {
  const db = getDb();
  const owner = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.mentor_id FROM evidence_submissions e JOIN users u ON u.id = e.user_id WHERE e.id = ?`
    )
    .get(evidenceId) as { id: string; name: string; email: string; mentor_id: string } | undefined;
  if (!owner) throw new ApiError(404, "Evidence not found", "not_found");
  // Mentors see their assigned teachers; admins may review any.
  const role = db.prepare(`SELECT role FROM users WHERE id = ?`).get(mentorId) as { role: string };
  if (role.role === "mentor" && owner.mentor_id !== mentorId) {
    throw new ApiError(403, "This teacher is not assigned to you", "forbidden");
  }

  const { evidence } = getEvidence(owner.id, evidenceId) as { evidence: EvidenceRow };
  const task = db.prepare(`SELECT * FROM implementation_tasks WHERE id = ?`).get(evidence.task_id) as {
    id: string; title: string; activity: string; difficulty: string; attempt_number: number; competency_id: string;
  };
  const competency = db.prepare(`SELECT id, title FROM competencies WHERE id = ?`).get(task.competency_id) as {
    id: string; title: string;
  };
  const practice = db
    .prepare(`SELECT chosen_option, was_correct, reflection, completed_at FROM practice_sessions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1`)
    .get(evidence.task_id) as { chosen_option: number; was_correct: number; reflection: string | null; completed_at: string } | undefined;
  const fb = db
    .prepare(`SELECT id, draft, status, drafted_by, edited_by_mentor FROM mentor_feedback WHERE evidence_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(evidenceId) as { id: string; draft: string; status: string; drafted_by: string; edited_by_mentor: number } | undefined;

  return {
    evidence: {
      id: evidence.id,
      taskId: evidence.task_id,
      attemptNumber: evidence.attempt_number,
      reflection: evidence.reflection,
      voiceNote: evidence.voice_note,
      checklist: JSON.parse(evidence.checklist) as Record<string, boolean>,
      photoPath: evidence.photo_path,
      voiceFile: evidence.voice_file ?? null,
      videoFile: evidence.video_file ?? null,
      submittedAt: evidence.submitted_at,
    },
    analysis: getAnalysisByEvidenceId(evidenceId),
    teacher: { id: owner.id, name: owner.name, email: owner.email, context: getContext(owner.id) },
    task: { title: task.title, activity: task.activity, difficulty: task.difficulty, attemptNumber: task.attempt_number },
    competency,
    practice: practice
      ? { chosenOption: practice.chosen_option, wasCorrect: Number(practice.was_correct) === 1, reflection: practice.reflection, completedAt: practice.completed_at }
      : null,
    existingFeedback: fb
      ? { id: fb.id, draft: fb.draft, status: fb.status, draftedBy: fb.drafted_by, editedByMentor: Number(fb.edited_by_mentor) === 1 }
      : null,
    adoption: getAdoptionStatus(owner.id, competency.id),
  };
}

/* ------------------------------------------------------------------ */
/* Feedback lifecycle: AI draft -> mentor edit -> approve & send       */
/* ------------------------------------------------------------------ */

export function getOrCreateFeedbackDraft(mentorId: string, evidenceId: string): Promise<{ id: string; draft: string; draftedBy: string; created: boolean }> {
  const db = getDb();
  const existing = db
    .prepare(`SELECT id, draft, drafted_by FROM mentor_feedback WHERE evidence_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(evidenceId) as { id: string; draft: string; drafted_by: string } | undefined;
  if (existing) {
    return Promise.resolve({ id: existing.id, draft: existing.draft, draftedBy: existing.drafted_by, created: false });
  }
  return createFeedbackDraft(mentorId, evidenceId).then((r) => ({ ...r, created: true }));
}

export async function createFeedbackDraft(mentorId: string, evidenceId: string): Promise<{ id: string; draft: string; draftedBy: string }> {
  const db = getDb();
  const view = getMentorEvidenceView(mentorId, evidenceId);
  if (!view.analysis) throw new ApiError(400, "AI analysis is not ready yet", "analysis_missing");
  if (view.existingFeedback?.status === "sent") {
    throw new ApiError(409, "Feedback was already sent for this evidence", "already_sent");
  }

  const draftResult = await draftFeedback({
    analysis: {
      observed: view.analysis.observed,
      interpretation: view.analysis.interpretation,
      recommendation: view.analysis.recommendation,
      criterionHits: view.analysis.criterionHits,
      supportFlags: view.analysis.supportFlags,
      supportRecommended: view.analysis.supportRecommended,
    },
    teacherName: view.teacher.name,
    competencyTitle: view.competency.title,
  });
  const draft = draftResult.result;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO mentor_feedback (id, evidence_id, mentor_id, draft, status, drafted_by, edited_by_mentor, created_at)
     VALUES (?, ?, ?, ?, 'drafted', ?, 0, ?)`
  ).run(id, evidenceId, mentorId, draft, draftResult.source, new Date().toISOString());
  return { id, draft, draftedBy: draftResult.source };
}

export interface SendFeedbackInput {
  mentorId: string;
  evidenceId: string;
  message: string;
  /** True when the mentor edited the AI draft (recorded for transparency). */
  edited: boolean;
}

export interface SendFeedbackResult {
  feedbackId: string;
  sentAt: string;
  teacherName: string;
}

/**
 * Approve & send. The AI draft is only a starting point: the mentor's message
 * is what the teacher receives. Sending advances adoption to feedback_received.
 */
export function approveAndSendFeedback(input: SendFeedbackInput): SendFeedbackResult {
  const db = getDb();
  const message = input.message.trim();
  if (message.length < 10) throw new ApiError(400, "Feedback message is too short to send", "validation_error");

  // Ownership: mentors may only send feedback for their assigned teachers.
  const owner = db
    .prepare(
      `SELECT u.mentor_id, u.role AS teacher_role FROM evidence_submissions e JOIN users u ON u.id = e.user_id WHERE e.id = ?`
    )
    .get(input.evidenceId) as { mentor_id: string; teacher_role: string } | undefined;
  if (!owner || owner.teacher_role !== "teacher") {
    throw new ApiError(404, "Evidence not found", "not_found");
  }
  const senderRole = db.prepare(`SELECT role FROM users WHERE id = ?`).get(input.mentorId) as { role: string };
  if (senderRole.role === "mentor" && owner.mentor_id !== input.mentorId) {
    throw new ApiError(403, "This teacher is not assigned to you", "forbidden");
  }

  const fb = db
    .prepare(`SELECT id, status FROM mentor_feedback WHERE evidence_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(input.evidenceId) as { id: string; status: string } | undefined;

  const sentAt = new Date().toISOString();
  let feedbackId: string;
  if (fb) {
    if (fb.status === "sent") throw new ApiError(409, "Feedback was already sent for this evidence", "already_sent");
    db.prepare(
      `UPDATE mentor_feedback SET draft = ?, sent_message = ?, status = 'sent', edited_by_mentor = ?, sent_at = ? WHERE id = ?`
    ).run(message, message, input.edited ? 1 : 0, sentAt, fb.id);
    feedbackId = fb.id;
  } else {
    // Mentor wrote feedback without generating an AI draft first — allowed, humans decide.
    feedbackId = randomUUID();
    db.prepare(
      `INSERT INTO mentor_feedback (id, evidence_id, mentor_id, draft, sent_message, status, drafted_by, edited_by_mentor, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, 'sent', 'mentor_written', ?, ?, ?)`
    ).run(feedbackId, input.evidenceId, input.mentorId, message, message, input.edited ? 1 : 0, sentAt, sentAt);
  }

  // Advance adoption + keep evidence/teacher info for the response.
  const meta = db
    .prepare(
      `SELECT e.user_id, t.competency_id, t.attempt_number, t.id AS task_id, u.name AS teacher_name
       FROM evidence_submissions e
       JOIN implementation_tasks t ON t.id = e.task_id
       JOIN users u ON u.id = e.user_id
       WHERE e.id = ?`
    )
    .get(input.evidenceId) as { user_id: string; competency_id: string; attempt_number: number; task_id: string; teacher_name: string };

  const mentorName = (db.prepare(`SELECT name FROM users WHERE id = ?`).get(input.mentorId) as { name: string } | undefined)?.name ?? "mentor";
  recordWorkflowEvent({
    userId: meta.user_id,
    competencyId: meta.competency_id,
    state: "MENTOR_REVIEWED",
    attemptNumber: meta.attempt_number,
    taskId: meta.task_id,
    actor: `mentor:${mentorName}`,
    detail: "Mentor reviewed the evidence and AI insight",
  });
  recordWorkflowEvent({
    userId: meta.user_id,
    competencyId: meta.competency_id,
    state: "FEEDBACK_SENT",
    attemptNumber: meta.attempt_number,
    taskId: meta.task_id,
    actor: `mentor:${mentorName}`,
    detail: input.edited ? "Mentor edited the AI draft and sent feedback" : "Mentor approved and sent feedback",
  });
  recordAdoptionEvent(meta.user_id, meta.competency_id, "feedback_received", meta.attempt_number, "Mentor feedback sent");
  return { feedbackId, sentAt, teacherName: meta.teacher_name };
}

/** Cluster overview: aggregate activity for the mentor's assigned teachers. */
export function getMentorCluster(mentorId: string) {
  const teachers = listAssignedTeachers(mentorId);
  const now = Date.now();
  const byStage: Record<string, number> = {};
  for (const t of teachers) byStage[t.adoptionStage] = (byStage[t.adoptionStage] ?? 0) + 1;

  const needsSupport = teachers.filter((t) => t.supportRecommended).length;
  const pendingReviews = teachers.reduce((n, t) => n + t.evidencePending, 0);
  const totalAttempts = teachers.reduce((n, t) => n + t.attempts, 0);
  const totalFeedback = teachers.reduce((n, t) => n + t.feedbackSent, 0);

  // Feedback turnaround: average hours from evidence submission to sent feedback.
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.submitted_at, f.sent_at FROM mentor_feedback f
       JOIN evidence_submissions e ON e.id = f.evidence_id
       JOIN users u ON u.id = e.user_id
       WHERE u.mentor_id = ? AND f.status = 'sent' AND f.sent_at IS NOT NULL`
    )
    .all(mentorId) as Array<{ submitted_at: string; sent_at: string }>;
  const hours = rows
    .map((r) => (new Date(r.sent_at).getTime() - new Date(r.submitted_at).getTime()) / 3_600_000)
    .filter((h) => h >= 0);
  const avgTurnaroundHours = hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null;

  return {
    totals: {
      teachers: teachers.length,
      needsSupport,
      pendingReviews,
      totalAttempts,
      totalFeedback,
      avgTurnaroundHours,
      generatedAt: new Date(now).toISOString(),
    },
    byStage,
  };
}

/** Mentor view of one teacher's implementation history (read-only). */
export function getMentorTeacherHistory(mentorId: string, teacherId: string) {
  const db = getDb();
  const teacher = db.prepare(`SELECT id, name, email, mentor_id FROM users WHERE id = ? AND role = 'teacher'`).get(teacherId) as
    | { id: string; name: string; email: string; mentor_id: string }
    | undefined;
  if (!teacher) throw new ApiError(404, "Teacher not found", "not_found");
  const role = db.prepare(`SELECT role FROM users WHERE id = ?`).get(mentorId) as { role: string };
  if (role.role === "mentor" && teacher.mentor_id !== mentorId) {
    throw new ApiError(403, "This teacher is not assigned to you", "forbidden");
  }
  return { teacher: { id: teacher.id, name: teacher.name, email: teacher.email }, history: getImplementationHistory(teacherId) };
}
