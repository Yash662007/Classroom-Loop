import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { getImplementationHistory } from "@/lib/teacher-loop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    return NextResponse.json({ history: getImplementationHistory(auth.id) });
  });
}
