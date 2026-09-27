import { NextResponse } from "next/server";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { startRetry } from "@/lib/teacher-loop";
import { retrySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const body = retrySchema.parse(await parseJsonBody(req));
    const result = await startRetry(auth.id, body.competency_id, body.note);
    return NextResponse.json(result);
  });
}
