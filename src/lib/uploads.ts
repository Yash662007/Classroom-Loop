import fs from "node:fs";
import path from "node:path";
import { ApiError } from "./api";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  // Voice reflections (GOAL 16): short teacher audio memos, same size limit.
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/jpeg": "jpg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
};

/** Stores an evidence file (photo or voice note) under data/uploads/<userId>/<uuid>.<ext>; returns the relative path. */
export async function saveUpload(userId: string, file: File): Promise<string> {
  if (!/^[A-Za-z0-9-]+$/.test(userId)) throw new ApiError(400, "Invalid upload owner", "bad_path");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Attachment 5 MB limit", "photo_too_large");
  if (!ALLOWED.has(file.type)) throw new ApiError(415, "Files must be JPEG/PNG/WebP/HEIC images or WebM/MP4/OGG/MP3 audio", "photo_type");
  fs.mkdirSync(path.join(UPLOAD_DIR, userId), { recursive: true });
  const ext = EXT_BY_TYPE[file.type] ?? "bin";
  const rel = path.join(userId, `${crypto.randomUUID()}.${ext}`);
  // Uploaded photos are media only, never executed; fixed UUID name, user-controlled
  // name is discarded, and reads go exclusively through resolveUpload below.
  fs.writeFileSync(path.join(UPLOAD_DIR, rel), Buffer.from(await file.arrayBuffer()));
  return rel;
}

/** Resolves a stored upload to an absolute path, rejecting traversal attempts. */
export function resolveUpload(rel: string): string {
  const abs = path.normalize(path.join(UPLOAD_DIR, rel));
  // Exact-boundary check: a bare startsWith would let "uploads-evil" (a sibling
  // directory) pass. The separator rules out prefix-sibling paths.
  if (abs !== UPLOAD_DIR && !abs.startsWith(UPLOAD_DIR + path.sep)) {
    throw new ApiError(400, "Invalid upload path", "bad_path");
  }
  if (!fs.existsSync(abs)) throw new ApiError(404, "File not found", "not_found");
  return abs;
}
