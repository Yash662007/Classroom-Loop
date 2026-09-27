import fs from "node:fs";
import path from "node:path";
import { ApiError } from "./api";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

/** Stores an evidence photo under data/uploads/<userId>/<uuid>.<ext>; returns the relative path. */
export async function saveUpload(userId: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new ApiError(413, "Photo 5 MB limit", "photo_too_large");
  if (!ALLOWED.has(file.type)) throw new ApiError(415, "Photo must be JPEG, PNG, WebP or HEIC", "photo_type");
  fs.mkdirSync(path.join(UPLOAD_DIR, userId), { recursive: true });
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/heic" ? "heic" : "jpg";
  const rel = path.join(userId, `${crypto.randomUUID()}.${ext}`);
  fs.writeFileSync(path.join(UPLOAD_DIR, rel), Buffer.from(await file.arrayBuffer()));
  return rel;
}

/** Resolves a stored upload to an absolute path, rejecting traversal attempts. */
export function resolveUpload(rel: string): string {
  const abs = path.join(UPLOAD_DIR, rel);
  const normalized = path.normalize(abs);
  if (!normalized.startsWith(UPLOAD_DIR)) throw new ApiError(400, "Invalid upload path", "bad_path");
  if (!fs.existsSync(normalized)) throw new ApiError(404, "File not found", "not_found");
  return normalized;
}
