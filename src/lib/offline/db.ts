/**
 * IndexedDB persistence for offline-first evidence capture (teacher side).
 *
 * Stores:
 *  - drafts:    the in-progress evidence form, keyed by taskId (auto-saved).
 *  - outbox:    evidence submissions awaiting sync, keyed by a stable
 *               idempotency key captured AT QUEUE TIME so retries can never
 *               create duplicate submissions server-side.
 *
 * The API is promise-based and degrades gracefully when IndexedDB is
 * unavailable (private mode etc.) — callers get a no-op fallback so the app
 * never crashes offline.
 */

export type OutboxStatus = "queued" | "flushing" | "synced" | "failed";

export interface EvidenceDraft {
  taskId: string;
  taskTitle: string;
  reflection: string;
  voiceText: string;
  checklist: Record<string, boolean>;
  /** Serialized File-less photo marker: name/size only; real files are re-picked. */
  photoInfo: { name: string; size: number } | null;
  updatedAt: string;
}

export interface OutboxItem {
  idempotencyKey: string;
  taskId: string;
  taskTitle: string;
  attemptNumber: number;
  competencyTitle: string;
  /** Multipart fields except the photo; the photo must be re-picked after restart. */
  payload: {
    reflection: string;
    voiceNote: string | null;
    checklist: Record<string, boolean>;
    hasPhoto: boolean;
  };
  photoBlob: Blob | null;
  photoType: string | null;
  /** Voice-note audio recorded on device (GOAL 16); synced like the photo. */
  voiceBlob: Blob | null;
  voiceType: string | null;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  queuedAt: string;
  flushedAt: string | null;
}

const DB_NAME = "classroom-loop";
const DB_VERSION = 1;
const DRAFTS = "drafts";
const OUTBOX = "outbox";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DRAFTS)) {
          db.createObjectStore(DRAFTS, { keyPath: "taskId" });
        }
        if (!db.objectStoreNames.contains(OUTBOX)) {
          const store = db.createObjectStore(OUTBOX, { keyPath: "idempotencyKey" });
          store.createIndex("status", "status");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      let result: T | null = null;
      if (request) {
        request.onsuccess = () => {
          result = request.result;
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/* ---------------- Drafts ---------------- */

export async function saveDraft(draft: EvidenceDraft): Promise<void> {
  await withStore(DRAFTS, "readwrite", (s) => s.put(draft));
}

export async function getDraft(taskId: string): Promise<EvidenceDraft | null> {
  return (await withStore<EvidenceDraft>(DRAFTS, "readonly", (s) => s.get(taskId))) ?? null;
}

export async function getAllDrafts(): Promise<EvidenceDraft[]> {
  return (await withStore<EvidenceDraft[]>(DRAFTS, "readonly", (s) => s.getAll())) ?? [];
}

export async function clearDraft(taskId: string): Promise<void> {
  await withStore(DRAFTS, "readwrite", (s) => s.delete(taskId));
}

/* ---------------- Outbox ---------------- */

export async function enqueueEvidence(item: OutboxItem): Promise<void> {
  await withStore(OUTBOX, "readwrite", (s) => s.put(item));
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const items = (await withStore<OutboxItem[]>(OUTBOX, "readonly", (s) => s.getAll())) ?? [];
  return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function countPendingOutbox(): Promise<number> {
  const items = await listOutbox();
  return items.filter((i) => i.status === "queued" || i.status === "failed" || i.status === "flushing").length;
}

export async function updateOutboxItem(item: OutboxItem): Promise<void> {
  await withStore(OUTBOX, "readwrite", (s) => s.put(item));
}

export async function removeOutboxItem(idempotencyKey: string): Promise<void> {
  await withStore(OUTBOX, "readwrite", (s) => s.delete(idempotencyKey));
}

/** Marks stale "flushing" items (interrupted sync) back to queued on startup. */
export async function recoverInterruptedSync(): Promise<void> {
  const items = await listOutbox();
  for (const item of items) {
    if (item.status === "flushing") {
      await updateOutboxItem({ ...item, status: "queued" });
    }
  }
}
