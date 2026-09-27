import { NextResponse } from "next/server";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { savePracticeSession, getPracticeSession } from "@/lib/teacher-loop";
import { practiceSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const body = practiceSessionSchema.parse(await parseJsonBody(req));
    const result = savePracticeSession(auth.id, body.task_id, body.chosen_option, body.reflection);
    return NextResponse.json(result);
  });
}

export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const taskId = new URL(req.url).searchParams.get("task_id");
    if (!taskId) return NextResponse.json({ session: null });
    return NextResponse.json({ session: getPracticeSession(auth.id, taskId) ?? null });
  });
}
