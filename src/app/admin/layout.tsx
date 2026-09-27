import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/jwt";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySessionToken((await cookies()).get("cl_session")?.value ?? "");
  if (!session || session.role !== "admin") redirect("/login");

  return (
    <div className="min-h-[calc(100vh-2rem)]">
      <AdminNav name={session.name} />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
