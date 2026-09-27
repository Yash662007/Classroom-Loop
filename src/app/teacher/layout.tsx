import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/jwt";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { SyncProvider } from "@/components/SyncProvider";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySessionToken((await cookies()).get("cl_session")?.value ?? "");
  if (!session || session.role !== "teacher") redirect("/login");

  return (
    <SyncProvider>
      <div className="min-h-[calc(100vh-2rem)]">
        <TeacherNav name={session.name} />
        <main className="max-w-5xl mx-auto px-4 py-6 pb-24">{children}</main>
      </div>
    </SyncProvider>
  );
}
