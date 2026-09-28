/**
 * Teacher support requests (Master Task GOAL 31) — a structured "Need help?"
 * signal. Stored, surfaced to the mentor priority views, and recorded in the
 * workflow engine as the SUPPORT_REQUIRED branch. Mentor acknowledgement is a
 * human action the engine logs under the mentor's name.
 */
import { randomUUID } from "node:crypto";
import { ApiError } from "./api";
import { getDb } from "@/db/instance";
import { recordWorkflowEvent } from "./workflow";
import { SUPPORT_REASONS, SUPPORT_REASON_LABELS, type SupportReason } from "./support-constants";

export { SUPPORT_REASONS, SUPPORT_REASON_LABELS };
export type { SupportReason };

export interface SupportRequestView {
  id: string;
  teacher: { id: string; name: string };
  competencyTitle: string | null;
  reason: SupportReason;
  reasonLabel: string;
  message: string | null;
  status: "open" | "acknowledged";
  createdAt: string;
}

export function createSupportRequest(input: {
  userId: string;
  competencyId?: string | null;
  taskId?: string | null;
  reason: SupportReason;
  message?: string | null;
}): { id: string; createdAt: string } {
  const db = getDb();
  if (!SUPPORT_REASONS.includes(input.reason)) {
    throw new ApiError(400, "Unknown support reason", "bad_reason");
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO support_requests (id, user_id, competency_id, task_id, reason, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(id, input.userId, input.competencyId ?? null, input.taskId ?? null, input.reason, input.message ?? null, createdAt);

  let competencyId = input.competencyId ?? "";
  let attemptNumber = 0;
  let taskId = input.taskId ?? null;
  if (taskId) {
    const task = db
      .prepare(`SELECT competency_id, attempt_number FROM implementation_tasks WHERE id = ? AND user_id = ?`)
      .get(taskId, input.userId) as { competency_id: string; attempt_number: number } | undefined;
    if (task) {
      competencyId = task.competency_id;
      attemptNumber = task.attempt_number;
    } else {
      taskId = null; // never attribute a request to a task the teacher doesn't own
    }
  }
  recordWorkflowEvent({
    userId: input.userId,
    competencyId,
    state: "SUPPORT_REQUIRED",
    attemptNumber,
    taskId,
    detail: `Teacher asked for help: ${SUPPORT_REASON_LABELS[input.reason]}`,
  });
  return { id, createdAt };
}

export function listOpenSupportRequests(): SupportRequestView[] {
  const rows = getDb()
    .prepare(
      `SELECT r.id, r.user_id, r.reason, r.message, r.status, r.created_at,
              u.name AS teacher_name, c.title AS competency_title
       FROM support_requests r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN competencies c ON c.id = r.competency_id
       ORDER BY r.created_at DESC LIMIT 50`
    )
    .all() as Array<{
    id: string; user_id: string; reason: SupportReason; message: string | null;
    status: "open" | "acknowledged"; created_at: string; teacher_name: string; competency_title: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    teacher: { id: r.user_id, name: r.teacher_name },
    competencyTitle: r.competency_title,
    reason: r.reason,
    reasonLabel: SUPPORT_REASON_LABELS[r.reason] ?? r.reason,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** A human mentor acknowledges the request (logged under the mentor's name). */
export function acknowledgeSupportRequest(mentorId: string, requestId: string): void {
  const db = getDb();
  const req = db
    .prepare(
      `SELECT r.user_id, r.reason, u.name AS teacher_name, u.mentor_id, u.role AS teacher_role
       FROM support_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?`
    )
    .get(requestId) as { user_id: string; reason: SupportReason; teacher_name: string; mentor_id: string | null; teacher_role: string } | undefined;
  if (!req) throw new ApiError(404, "Support request not found", "not_found");
  // Ownership: mentors may only act on their own assigned teachers.
  const mentorRole = (db.prepare(`SELECT role FROM users WHERE id = ?`).get(mentorId) as { role: string } | undefined)?.role;
  if (mentorRole === "mentor" && req.teacher_role === "teacher" && req.mentor_id !== mentorId) {
    throw new ApiError(403, "This teacher is not assigned to you", "forbidden");
  }
  const updated = db.prepare(`UPDATE support_requests SET status = 'acknowledged' WHERE id = ? AND status = 'open'`).run(requestId);
  if (updated.changes > 0) {
    const mentorName = (db.prepare(`SELECT name FROM users WHERE id = ?`).get(mentorId) as { name: string } | undefined)?.name ?? "mentor";
    recordWorkflowEvent({
      userId: req.user_id,
      competencyId: "",
      state: "SUPPORT_REQUIRED",
      actor: `mentor:${mentorName}`,
      detail: `Support request acknowledged for ${req.teacher_name}`,
    });
  }
}
