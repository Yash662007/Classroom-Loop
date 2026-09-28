import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { parseJsonBody } from "@/lib/api";
import { supportRequestSchema } from "@/lib/validation";
import { createSupportRequest } from "@/lib/support";

export const dynamic = "force-dynamic";

/** POST /api/support — teacher raises a structured "Need help?" request (GOAL 31). */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const body = supportRequestSchema.parse(await parseJsonBody(req));
    const result = createSupportRequest({ userId: auth.id, ...body });
    return NextResponse.json({ ok: true, id: result.id, createdAt: result.createdAt }, { status: 201 });
  });
}
