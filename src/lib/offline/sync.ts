/**
 * Outbox flush engine — replays queued evidence submissions against the API.
 * Duplicate-safe by construction: the idempotency key captured at queue time
 * is replayed, so the server returns the original submission instead of
 * creating a second row.
 */
import type { OutboxItem } from "./db";
import { listOutbox, updateOutboxItem, removeOutboxItem } from "./db";

export interface FlushOutcome {
  attempted: number;
  synced: number;
  duplicates: number;
  failed: number;
  /** True when a network-level failure occurred (still offline). */
  offline: boolean;
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && /network|offline|fetch/i.test(err.message));
}

/**
 * Attempts to flush all pending outbox items. Safe to call concurrently —
 * items being flushed are marked to avoid double-send within a session.
 */
export async function flushOutbox(): Promise<FlushOutcome> {
  const outcome: FlushOutcome = { attempted: 0, synced: 0, duplicates: 0, failed: 0, offline: false };
  const items = (await listOutbox()).filter((i) => i.status === "queued" || i.status === "failed");

  for (const item of items) {
    outcome.attempted += 1;
    const flushing: OutboxItem = { ...item, status: "flushing", lastError: null };
    await updateOutboxItem(flushing);

    try {
      const form = new FormData();
      form.set("task_id", item.taskId);
      form.set("reflection", item.payload.reflection);
      if (item.payload.voiceNote) form.set("voice_note", item.payload.voiceNote);
      form.set("checklist", JSON.stringify(item.payload.checklist));
      form.set("client_token", item.idempotencyKey);
      if (item.photoBlob && item.photoType) {
        form.set("photo", item.photoBlob, `evidence.${item.photoType.split("/")[1] ?? "jpg"}`);
      }
      if (item.voiceBlob && item.voiceType) {
        form.set("voice_file", item.voiceBlob, `voice.${item.voiceType.split("/")[1] ?? "webm"}`);
      }
      if (item.videoBlob && item.videoType) {
        form.set("video_file", item.videoBlob, `video.${item.videoType.split("/")[1] ?? "webm"}`);
      }

      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "x-idempotency-key": item.idempotencyKey },
        body: form,
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { duplicate?: boolean };
        if (data.duplicate) outcome.duplicates += 1;
        else outcome.synced += 1;
        await updateOutboxItem({ ...flushing, status: "synced", flushedAt: new Date().toISOString() });
        // Keep synced items briefly for UI, prune after 10.
        const all = await listOutbox();
        const synced = all.filter((i) => i.status === "synced");
        for (const old of synced.slice(0, Math.max(0, synced.length - 10))) {
          await removeOutboxItem(old.idempotencyKey);
        }
      } else if (res.status === 401 || res.status === 403) {
        // Session expired — stop flushing; keep items queued for next login.
        outcome.failed += 1;
        outcome.offline = false;
        await updateOutboxItem({ ...flushing, status: "queued", lastError: "Sign in required — will retry after login" });
        break;
      } else {
        // Server rejected (validation etc.) — surface the error, mark failed.
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        outcome.failed += 1;
        await updateOutboxItem({
          ...flushing,
          status: "failed",
          attempts: item.attempts + 1,
          lastError: err.error ?? `Server error ${res.status}`,
        });
      }
    } catch (err) {
      // Network failure — stay queued; flip the offline flag for the UI.
      outcome.failed += 1;
      outcome.offline = isNetworkError(err) || !navigator.onLine;
      await updateOutboxItem({
        ...flushing,
        status: "queued",
        attempts: item.attempts + 1,
        lastError: isNetworkError(err) ? "Still offline — will retry automatically" : String((err as Error).message),
      });
      if (outcome.offline) break; // no point hammering while offline
    }
  }
  return outcome;
}
