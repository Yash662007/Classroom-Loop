import { SignJWT, jwtVerify } from "jose";

export type Role = "teacher" | "mentor" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const encoder = new TextEncoder();

/** Dev convenience only — a fixed dev secret keeps restarts deterministic. */
function getSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "classroom-loop-dev-secret-do-not-use-in-production";
  return encoder.encode(secret);
}

const COOKIE_NAME = "cl_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.role !== "string") return null;
    const role = payload.role as Role;
    if (!["teacher", "mentor", "admin"].includes(role)) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role,
    };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  },
};
