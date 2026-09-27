import { NextResponse } from "next/server";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { completeModule } from "@/lib/teacher-loop";
import { completeModuleSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** POST /api/competencies/complete-module — mark one training module done. */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const body = completeModuleSchema.parse(await parseJsonBody(req));
    const result = completeModule(auth.id, body.module_id);
    return NextResponse.json({ ok: true, ...result });
  });
}
