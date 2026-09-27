import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/jwt";
import { roleHome } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const token = (await cookies()).get("cl_session")?.value;
  const session = token ? await verifySessionToken(token) : null;
  redirect(session ? roleHome(session.role) : "/login");
}
