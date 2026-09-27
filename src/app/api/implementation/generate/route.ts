import { NextResponse } from "next/server";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { generateTask } from "@/lib/teacher-loop";
import { generateTaskSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const body = generateTaskSchema.parse(await parseJsonBody(req));
    const { task, aiSource, reusedExisting } = await generateTask(auth.id, body.competency_id, { forceNew: body.force_new });
    return NextResponse.json({ task, aiSource, reusedExisting });
  });
}
