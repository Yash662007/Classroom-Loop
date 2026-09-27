import { NextResponse } from "next/server";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { submitCompetencyCheck } from "@/lib/teacher-loop";
import { competencyCheckSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const body = competencyCheckSchema.parse(await parseJsonBody(req));
    const result = submitCompetencyCheck(auth.id, body.competency_id, body.answers);
    return NextResponse.json(result);
  });
}
