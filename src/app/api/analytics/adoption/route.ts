import { NextResponse } from "next/server";
import { handleRoute, requireRole } from "@/lib/api";
import { getAdoptionDistribution } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(async () => {
    await requireRole(req, "admin");
    return NextResponse.json(getAdoptionDistribution());
  });
}
