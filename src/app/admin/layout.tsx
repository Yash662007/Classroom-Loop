import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/jwt";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySessionToken((await cookies()).get("cl_session")?.value ?? "");
  if (!session || session.role !== "admin") redirect("/login");

  return (
    <AppShell role={session.role} name={session.name}>
      {children}
    </AppShell>
  );
}
