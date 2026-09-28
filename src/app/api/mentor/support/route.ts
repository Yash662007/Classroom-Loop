import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { listMentorSupportRequests } from "@/lib/mentor-loop";

export const dynamic = "force-dynamic";

/** GET /api/mentor/support — open "Need help?" requests from assigned teachers. */
export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "mentor");
    return NextResponse.json({ requests: listMentorSupportRequests(auth.id) });
  });
}
