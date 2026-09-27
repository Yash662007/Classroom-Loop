import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireRole } from "@/lib/api";
import { resolveUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");
    const { path: parts } = await ctx.params;
    if (!parts[0] || parts[0] !== auth.id) {
      throw new ApiError(403, "You can only view your own uploads", "forbidden");
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
