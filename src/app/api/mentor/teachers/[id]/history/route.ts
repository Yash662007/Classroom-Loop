import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { getMentorTeacherHistory } from "@/lib/mentor-loop";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "mentor", "admin");
    const { id } = await ctx.params;
    return NextResponse.json(getMentorTeacherHistory(auth.id, id));
  });
}
