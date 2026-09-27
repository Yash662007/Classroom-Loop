import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { verifySessionToken } from "./jwt";
import type { Role } from "./jwt";

/** Typed API error with an HTTP status; caught centrally in `handleRoute`. */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Auth = { id: string; name: string; email: string; role: Role };

/** Resolves the session user from the httpOnly cookie. */
export async function getAuth(req: Request): Promise<Auth | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)cl_session=([^;]+)/);
  if (!match) return null;
  return verifySessionToken(decodeURIComponent(match[1]));
}

export async function requireAuth(req: Request): Promise<Auth> {
  const auth = await getAuth(req);
  if (!auth) throw new ApiError(401, "Sign in required", "unauthorized");
  return auth;
}

export async function requireRole(req: Request, ...roles: Role[]): Promise<Auth> {
  const auth = await requireAuth(req);
  if (!roles.includes(auth.role)) {
    throw new ApiError(403, "Not allowed for your role", "forbidden");
  }
  return auth;
}

/**
 * Central route wrapper: catches ApiError, ZodError and unknown errors and
 * maps them to consistent JSON — never a silent failure.
 */
export function handleRoute<T>(
  fn: () => Promise<NextResponse<T> | NextResponse>
): Promise<NextResponse> {
  return fn().catch((err: unknown) => {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid input: " + err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "),
          code: "validation_error",
        },
        { status: 400 }
      );
    }
    console.error("[api] unhandled error:", err);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please retry.", code: "internal" },
      { status: 500 }
    );
  });
}

export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON", "bad_json");
  }
}
