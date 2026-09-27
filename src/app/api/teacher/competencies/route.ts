import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { listCompetenciesWithStatus } from "@/lib/teacher-loop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    return NextResponse.json({ competencies: listCompetenciesWithStatus(auth.id) });
  });
}
