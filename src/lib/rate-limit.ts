/**
 * Minimal in-memory sliding-window rate limiter (per process).
 * Sized for a single-node MVP; a multi-node deployment should swap this
 * for a shared store. Records only IPs/hit counts — never credentials.
 */
const WINDOWS = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = (WINDOWS.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    WINDOWS.set(key, hits);
    return { ok: false, retryAfterSeconds: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  WINDOWS.set(key, hits);
  // Opportunistic cleanup so idle keys cannot grow the map unboundedly.
  if (WINDOWS.size > 500) {
    for (const [k, v] of WINDOWS) {
      if (v.every((t) => now - t >= windowMs)) WINDOWS.delete(k);
    }
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP for rate-limit keying (proxy-aware, never logged raw). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "local";
}
