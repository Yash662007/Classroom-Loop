import { NextResponse } from "next/server";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { approveAndSendFeedback } from "@/lib/mentor-loop";
import { feedbackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Approve & send. The mentor's edited/approved message is what the teacher
 * receives — the AI draft is never sent automatically (human-in-the-loop).
 */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "mentor", "admin");
    const body = feedbackSchema.parse(await parseJsonBody(req));
    const result = approveAndSendFeedback({
      mentorId: auth.id,
      evidenceId: body.evidence_id,
      message: body.message,
      edited: body.edited_by_mentor ?? false,
    });
    return NextResponse.json(result, { status: 201 });
  });
}
