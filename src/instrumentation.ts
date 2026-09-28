/**
 * Next.js instrumentation hook — runs once per server boot (and per test run
 * in dev). Used for the evidence retention sweeper; failures must never block
 * startup.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runRetentionSweepAtBoot } = await import("@/lib/retention");
    runRetentionSweepAtBoot();
  }
}
