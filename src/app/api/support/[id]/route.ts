import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireRole } from "@/lib/api";
import { acknowledgeSupportRequest } from "@/lib/support";

export const dynamic = "force-dynamic";

/** PATCH /api/support/[id] — mentor acknowledges a teacher's help request. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "mentor");
    const { id } = await ctx.params;
    if (!id) throw new ApiError(400, "Support request id is required", "bad_request");
    acknowledgeSupportRequest(auth.id, id);
    return NextResponse.json({ ok: true });
  });
}
