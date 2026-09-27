import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { getEvidence, getAnalysisByEvidenceId } from "@/lib/teacher-loop";
import { getDb } from "@/db/instance";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const { id } = await ctx.params;
    const { evidence } = getEvidence(auth.id, id);
    const analysis = getAnalysisByEvidenceId(id);
    const fb = getDb()
      .prepare(
        `SELECT status, sent_message, sent_at, edited_by_mentor, drafted_by FROM mentor_feedback WHERE evidence_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(id) as
      | { status: string; sent_message: string | null; sent_at: string | null; edited_by_mentor: number; drafted_by: string }
      | undefined;
    return NextResponse.json({
      evidence: {
        id: evidence.id,
        taskId: evidence.task_id,
        attemptNumber: evidence.attempt_number,
        reflection: evidence.reflection,
        voiceNote: evidence.voice_note,
        checklist: JSON.parse(evidence.checklist) as Record<string, boolean>,
        photoPath: evidence.photo_path,
        hasPhoto: Boolean(evidence.photo_path),
        status: evidence.status,
        submittedAt: evidence.submitted_at,
      },
      analysis,
      feedback: fb
        ? {
            status: fb.status,
            message: fb.sent_message,
            sentAt: fb.sent_at,
            editedByMentor: Number(fb.edited_by_mentor) === 1,
            draftedBy: fb.drafted_by,
          }
        : null,
    });
  });
}
