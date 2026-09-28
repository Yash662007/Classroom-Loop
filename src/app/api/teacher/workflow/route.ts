import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { deriveWorkflowForUser } from "@/lib/teacher-loop";

export const dynamic = "force-dynamic";

/**
 * Centralized workflow view (GOAL 2): current state + full event history +
 * attempts + AI jobs + mentor decisions + adoption per competency.
 * Optional ?competency_id=<id> narrows to one pipeline.
 */
export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const competencyId = new URL(req.url).searchParams.get("competency_id") ?? undefined;
    return NextResponse.json({ workflows: deriveWorkflowForUser(auth.id, competencyId || undefined) });
  });
}
