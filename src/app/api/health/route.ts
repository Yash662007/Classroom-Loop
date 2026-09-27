import { NextResponse } from "next/server";
import { getDb } from "@/db/instance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const users = db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number };
    return NextResponse.json({
      ok: true,
      service: "classroom-loop",
      db: "sqlite",
      users: users.n,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
