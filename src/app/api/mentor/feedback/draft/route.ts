import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { getOrCreateFeedbackDraft } from "@/lib/mentor-loop";

export const dynamic = "force-dynamic";

const draftSchema = z.object({ evidence_id: z.string().min(1) });

export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "mentor", "admin");
    const body = draftSchema.parse(await parseJsonBody(req));
    const result = await getOrCreateFeedbackDraft(auth.id, body.evidence_id);
    return NextResponse.json(result);
  });
}
