import { NextResponse } from "next/server";
import { getDb } from "@/db/instance";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, sessionCookie } from "@/lib/jwt";
import { handleRoute, ApiError, parseJsonBody } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(async () => {
    // Brute-force guard: 10 attempts / 5 min per client, applied before any
    // credential check. Failures only increment the window (counter runs on
    // every attempt, successful or not — cheap and safe for an MVP).
    const limit = rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000);
    if (!limit.ok) {
      throw new ApiError(429, "Too many sign-in attempts. Please wait a few minutes and try again.", "rate_limited");
    }

    const body = loginSchema.parse(await parseJsonBody(req));
    const db = getDb();
    const user = db
      .prepare(`SELECT id, email, name, role, password_hash FROM users WHERE email = ?`)
      .get(body.email) as
      | { id: string; email: string; name: string; role: string; password_hash: string }
      | undefined;

    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      // Same message for unknown email and wrong password (no account enumeration).
      throw new ApiError(401, "Invalid email or password", "invalid_credentials");
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "teacher" | "mentor" | "admin",
    });
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    res.cookies.set(sessionCookie.name, token, sessionCookie.options);
    return res;
  });
}
