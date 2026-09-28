import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireRole } from "@/lib/api";
import { submitEvidence } from "@/lib/teacher-loop";
import { evidenceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/evidence — accepts multipart/form-data (with optional photo) or JSON.
 * Idempotency: send the same x-idempotency-key (or client_token field) after a
 * network failure; the original submission and analysis are returned untouched.
 */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const auth = await requireRole(req, "teacher");

    let taskId: string;
    let reflection: string;
    let voiceNote: string | null = null;
    let checklist: Record<string, boolean>;
    let photoPath: string | null = null;
    let voiceFilePath: string | null = null;
    let clientToken: string | null = req.headers.get("x-idempotency-key");

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      taskId = String(form.get("task_id") ?? "");
      reflection = String(form.get("reflection") ?? "");
      voiceNote = form.get("voice_note") ? String(form.get("voice_note")) : null;
      const checklistRaw = String(form.get("checklist") ?? "{}");
      try {
        checklist = JSON.parse(checklistRaw) as Record<string, boolean>;
      } catch {
        throw new ApiError(400, "Checklist must be valid JSON", "bad_checklist");
      }
      if (!clientToken) clientToken = form.get("client_token") ? String(form.get("client_token")) : null;

      const photo = form.get("photo");
      if (photo && photo instanceof File && photo.size > 0) {
        if (photo.size > 5 * 1024 * 1024) {
          throw new ApiError(413, "Photo must be 5 MB or smaller", "photo_too_large");
        }
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
        if (!allowed.includes(photo.type)) {
          throw new ApiError(415, "Photo must be JPEG, PNG, WebP or HEIC", "photo_type");
        }
        const { saveUpload } = await import("@/lib/uploads");
        photoPath = await saveUpload(auth.id, photo);
      }

      const voiceFile = form.get("voice_file");
      if (voiceFile && voiceFile instanceof File && voiceFile.size > 0) {
        if (voiceFile.size > 5 * 1024 * 1024) {
          throw new ApiError(413, "Voice note must be 5 MB or smaller", "voice_too_large");
        }
        const voiceAllowed = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"];
        if (!voiceAllowed.includes(voiceFile.type)) {
          throw new ApiError(415, "Voice note must be WebM, MP4, OGG or MP3 audio", "voice_type");
        }
        const { saveUpload } = await import("@/lib/uploads");
        voiceFilePath = await saveUpload(auth.id, voiceFile);
      }
    } else {
      const body = evidenceSchema.parse(await req.json().catch(() => {
        throw new ApiError(400, "Request body must be valid JSON or multipart form data", "bad_json");
      }));
      taskId = body.task_id;
      reflection = body.reflection;
      voiceNote = body.voice_note ?? null;
      checklist = body.checklist;
      photoPath = body.photo_path ?? null;
    }

    if (!taskId) throw new ApiError(400, "task_id is required", "validation_error");
    if (!reflection || !reflection.trim()) throw new ApiError(400, "Reflection is required", "validation_error");
    if (reflection.length > 5000) throw new ApiError(400, "Reflection must be 5000 characters or fewer", "validation_error");

    const result = await submitEvidence({
      userId: auth.id,
      taskId,
      reflection: reflection.trim(),
      voiceNote,
      checklist,
      photoPath,
      voiceFilePath,
      clientToken,
    });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  });
}
