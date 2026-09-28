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
    const taskMeta = getDb()
      .prepare(`SELECT competency_id FROM implementation_tasks WHERE id = ?`)
      .get(evidence.task_id) as { competency_id: string } | undefined;

    // "What changed?" comparison (GOAL 29): previous attempt of the same
    // competency vs this one — reflections + rubric hits, teacher-reported.
    let whatChanged: {
      before: { attemptNumber: number; reflection: string; rubricHits: string[] };
      after: { attemptNumber: number; reflection: string; rubricHits: string[] };
      mentorNote: string | null;
    } | null = null;
    if (taskMeta && evidence.attempt_number > 1) {
      const prev = getDb()
        .prepare(
          `SELECT e.id, e.reflection, e.attempt_number FROM evidence_submissions e
           JOIN implementation_tasks t ON t.id = e.task_id
           WHERE t.user_id = ? AND t.competency_id = ? AND e.attempt_number < ?
           ORDER BY e.attempt_number DESC, e.submitted_at DESC LIMIT 1`
        )
        .get(auth.id, taskMeta.competency_id, evidence.attempt_number) as
        | { id: string; reflection: string; attempt_number: number }
        | undefined;
      if (prev) {
        const hits = (rows: Array<{ label: string; hit: number | boolean }>) => rows.filter((r) => Number(r.hit) === 1).map((r) => r.label);
        const prevHits = getDb()
          .prepare(`SELECT criterion_hits FROM ai_analyses WHERE evidence_id = ? ORDER BY generated_at DESC LIMIT 1`)
          .get(prev.id) as { criterion_hits: string } | undefined;
        const currHits = getDb()
          .prepare(`SELECT criterion_hits FROM ai_analyses WHERE evidence_id = ? ORDER BY generated_at DESC LIMIT 1`)
          .get(id) as { criterion_hits: string } | undefined;
        const prevFeedback = getDb()
          .prepare(`SELECT sent_message FROM mentor_feedback WHERE evidence_id = ? AND status = 'sent' ORDER BY created_at DESC LIMIT 1`)
          .get(prev.id) as { sent_message: string | null } | undefined;
        whatChanged = {
          before: { attemptNumber: prev.attempt_number, reflection: prev.reflection, rubricHits: prevHits ? hits(JSON.parse(prevHits.criterion_hits)) : [] },
          after: { attemptNumber: evidence.attempt_number, reflection: evidence.reflection, rubricHits: currHits ? hits(JSON.parse(currHits.criterion_hits)) : [] },
          mentorNote: prevFeedback?.sent_message ?? null,
        };
      }
    }
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
        voiceFile: evidence.voice_file ?? null,
        status: evidence.status,
        submittedAt: evidence.submitted_at,
      },
      competencyId: taskMeta?.competency_id ?? null,
      whatChanged,
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
