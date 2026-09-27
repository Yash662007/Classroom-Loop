import type { Role } from "./jwt";

/** Landing page per role after sign-in. */
export function roleHome(role: Role): string {
  if (role === "mentor") return "/mentor";
  if (role === "admin") return "/admin";
  return "/teacher";
}
