"use client";

/** Thrown when the request never reached the server (offline / network drop). */
export class NetworkError extends Error {
  constructor(message = "Network problem — you may be offline.") {
    super(message);
    this.name = "NetworkError";
  }
}

const STALE_PREFIX = "cl_stale_";
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // keep last-good GET payloads for a day

function cacheStale(path: string, data: unknown): void {
  try {
    sessionStorage.setItem(
      STALE_PREFIX + path,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    /* quota/private mode — caching is best-effort */
  }
}

function readStale(path: string): unknown | null {
  try {
    const raw = sessionStorage.getItem(STALE_PREFIX + path);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: unknown };
    if (Date.now() - parsed.at > STALE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Fetch wrapper: throws NetworkError on connectivity failure; serves last-good GET responses when offline. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    const path = new URL(input, window.location.origin).pathname + (new URL(input, window.location.origin).search || "");
    if ((!init || init.method === undefined || init.method === "GET") && !input.includes("/api/evidence")) {
      const stale = readStale(path);
      if (stale !== null) return stale as T;
    }
    throw new NetworkError();
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  if (!init || init.method === undefined || init.method === "GET") {
    cacheStale(new URL(input, window.location.origin).pathname + (new URL(input, window.location.origin).search || ""), data);
  }
  return data as T;
}

/** Stable per-form idempotency key (kept across retries until cleared). */
export function idempotencyKey(formKey: string): string {
  const KEY = `cl_idem_${formKey}`;
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(KEY, v);
  }
  return v;
}

export function clearIdempotencyKey(formKey: string): void {
  localStorage.removeItem(`cl_idem_${formKey}`);
}
