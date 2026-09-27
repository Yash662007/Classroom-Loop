import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { listAssignedTeachers } from "@/lib/mentor-loop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "mentor", "admin");
    return NextResponse.json({ teachers: listAssignedTeachers(auth.id) });
  });
}
