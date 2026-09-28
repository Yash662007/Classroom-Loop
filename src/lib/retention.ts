/**
 * Evidence retention policy (production-debt item #13).
 *
 * Local-disk uploads (photos, voice notes, classroom video) are personal data
 * captured in real classrooms; the spec asks for an explicit retention window
 * instead of persisting evidence indefinitely. This sweeper deletes upload
 * files older than EVIDENCE_RETENTION_DAYS and nulls the corresponding
 * database references, keeping the same failure posture as submissions: the
 * evidence row always survives even when its media cannot.
 *
 * Object storage/CDN with lifecycle rules is the production target — this is
 * the local-disk half of that policy (documented in README).
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/db/instance";

export interface RetentionResult {
  /** Whether the sweep ran at all (false when disabled or env unset). */
  enabled: boolean;
  deletedFiles: number;
  nulledRefs: number;
  /** Readable explanation when the sweep did not run. */
  skippedReason?: string;
}

/** Media columns on evidence_submissions that reference files under data/uploads. */
const MEDIA_COLUMNS = ["photo_path", "voice_file", "video_file"] as const;

/** Parse and validate the retention window; null disables sweeping. */
function retentionDays(): number | null {
  const raw = process.env.EVIDENCE_RETENTION_DAYS;
  if (raw === undefined || raw === "") return null; // default: retain indefinitely
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null; // garbage or negative: treat as disabled
  return Math.floor(n);
}

/**
 * Deletes every upload file whose mtime is older than the retention window and
 * nulls the evidence references pointing at deleted files. Idempotent and
 * safe to run on every boot; scoped to the same DATA_DIR the app uses.
 */
export function sweepExpiredUploads(now: Date = new Date()): RetentionResult {
  const days = retentionDays();
  if (days === null) {
    return { enabled: false, deletedFiles: 0, nulledRefs: 0, skippedReason: "EVIDENCE_RETENTION_DAYS is unset or invalid — retention disabled" };
  }
  if (days === 0) {
    return { enabled: false, deletedFiles: 0, nulledRefs: 0, skippedReason: "EVIDENCE_RETENTION_DAYS=0 — retention explicitly disabled" };
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const uploadsDir = path.join(dataDir, "uploads");
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;

  const relPaths: string[] = [];
  if (fs.existsSync(uploadsDir)) {
    for (const user of fs.readdirSync(uploadsDir)) {
      const userDir = path.join(uploadsDir, user);
      let stats: fs.Stats;
      try {
        stats = fs.statSync(userDir);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;
      for (const file of fs.readdirSync(userDir)) {
        const filePath = path.join(userDir, file);
        try {
          if (fs.statSync(filePath).mtimeMs < cutoffMs) relPaths.push(path.join(user, file));
        } catch {
          // File vanished mid-sweep (concurrent delete) — nothing to do.
        }
      }
    }
  }

  if (relPaths.length === 0) return { enabled: true, deletedFiles: 0, nulledRefs: 0 };

  const db = getDb();
  const pathMatches = (col: string, rels: string[]) =>
    `(${rels.map(() => `${col} LIKE ? ESCAPE '!'`).join(" OR ")})`;
  const update = db.prepare(
    `UPDATE evidence_submissions SET ${MEDIA_COLUMNS.map((c) => `${c} = NULL`).join(", ")}
     WHERE ${pathMatches("photo_path", relPaths)}
        OR ${pathMatches("voice_file", relPaths)}
        OR ${pathMatches("video_file", relPaths)}`
  );

  let deletedFiles = 0;
  let nulledRefs = 0;
  const tx = db.transaction(() => {
    for (const rel of relPaths) {
      const stored = rel.split(/[\\/]/).join(path.sep);
      const abs = path.join(uploadsDir, stored);
      try {
        fs.unlinkSync(abs);
        deletedFiles += 1;
      } catch {
        continue; // already gone or locked (Windows) — refs below still handled
      }
      // Match on the UUID basename: it is globally unique and free of path
      // separators, so the ref-nulling works identically on Windows and POSIX
      // even though stored rel paths use native separators.
      const like = `%${path.basename(rel).replace(/[%_!]/g, (m) => `!${m}`)}%`;
      const info = update.run(like, like, like);
      nulledRefs += info.changes;
    }
  });
  tx();

  return { enabled: true, deletedFiles, nulledRefs };
}

/**
 * Boot-time sweep with a conservative failure posture: retention problems are
 * logged but never prevent the server from starting or serving evidence.
 */
export function runRetentionSweepAtBoot(): void {
  try {
    const result = sweepExpiredUploads();
    if (result.enabled && (result.deletedFiles > 0 || result.nulledRefs > 0)) {
      console.log(
        `[retention] deleted ${result.deletedFiles} expired upload file(s), cleared ${result.nulledRefs} evidence reference(s)`
      );
    } else if (!result.enabled && process.env.EVIDENCE_RETENTION_DAYS) {
      // Someone set the env var to something unusable — surface it once, quietly.
      console.warn(`[retention] not sweeping: ${result.skippedReason}`);
    }
  } catch (err) {
    console.error("[retention] sweep failed (server continues):", err instanceof Error ? err.message : err);
  }
}
