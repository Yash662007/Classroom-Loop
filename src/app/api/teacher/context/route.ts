import { NextResponse } from "next/server";
import { handleRoute, requireRole, parseJsonBody } from "@/lib/api";
import { getContext, upsertContext } from "@/lib/teacher-loop";
import { contextSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    return NextResponse.json({ context: getContext(auth.id) });
  });
}

export async function PUT(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const data = contextSchema.parse(await parseJsonBody(req));
    await upsertContext(auth.id, data);
    return NextResponse.json({ ok: true, context: getContext(auth.id) });
  });
}
