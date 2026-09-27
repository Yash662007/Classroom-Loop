import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/jwt";
import { roleHome } from "@/lib/roles";
import type { Role } from "@/lib/jwt";

const COOKIE_NAME = "cl_session";

const PREFIX_ROLES: Array<[string, Role[]]> = [
  ["/teacher", ["teacher"]],
  ["/mentor", ["mentor", "admin"]],
  ["/admin", ["admin"]],
  ["/api/teacher", ["teacher"]],
  ["/api/mentor", ["mentor", "admin"]],
  ["/api/analytics", ["admin"]],
];

function requiredRoles(pathname: string): Role[] | null {
  for (const [prefix, roles] of PREFIX_ROLES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return roles;
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const roles = requiredRoles(pathname);
  if (!roles) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Sign in required", code: "unauthorized" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!roles.includes(session.role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Not allowed for your role", code: "forbidden" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL(roleHome(session.role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/teacher/:path*",
    "/mentor/:path*",
    "/admin/:path*",
    "/api/teacher/:path*",
    "/api/mentor/:path*",
    "/api/analytics/:path*",
  ],
};
