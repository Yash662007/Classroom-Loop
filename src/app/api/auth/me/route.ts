import { NextResponse } from "next/server";
import { getAuth } from "@/lib/api";
import { handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const auth = await getAuth(req);
    return NextResponse.json({ user: auth });
  });
}
