import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireRole } from "@/lib/api";
import { resolveUpload } from "@/lib/uploads";
import { getDb } from "@/db/instance";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "mentor", "admin");
    const { path: parts } = await ctx.params;
    const ownerId = parts[0];
    if (!ownerId) throw new ApiError(400, "Invalid upload path", "bad_path");

    if (auth.role === "mentor") {
      const teacher = getDb()
        .prepare(`SELECT mentor_id FROM users WHERE id = ? AND role = 'teacher'`)
        .get(ownerId) as { mentor_id: string } | undefined;
      if (!teacher || teacher.mentor_id !== auth.id) {
        throw new ApiError(403, "This teacher is not assigned to you", "forbidden");
      }
    }

    const rel = parts.join("/");
    const abs = resolveUpload(rel);
    const ext = rel.split(".").pop() ?? "jpg";
    const buf = await import("node:fs").then((fs) => fs.promises.readFile(abs));
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
    });
  });
}
