# Architecture

CLASSROOM LOOP is a single Next.js 15 (App Router) application: server-rendered
UI, thin API routes, a service/domain layer, and an embedded SQLite database.
One deployable unit, no external services required (AI upgrade optional).

```
Browser (React 19, Tailwind, IndexedDB offline layer)
   │  fetch — httpOnly JWT cookie (`cl_session`)
   ▼
src/app/api/**/route.ts     Thin HTTP adapters: auth via requireRole, zod validation, delegate
   ▼
src/lib/teacher-loop.ts     Teacher journey domain: context, checks, tasks, evidence, analysis, retry
src/lib/mentor-loop.ts      Mentor domain: queue, review, feedback lifecycle (human-in-the-loop)
src/lib/adoption.ts         Config-driven adoption ladder (never regresses, per competency)
src/lib/analytics.ts        Aggregate-only admin analytics (no rankings/scores by design)
src/lib/ai/service.ts       AI facade: LLM-first with automatic fallback to local rubric engine
src/lib/ai/local-engine.ts  Deterministic rubric engine (Observed / Interpreted / Recommended)
   ▼
src/db/instance.ts + schema.ts   better-sqlite3 (WAL, FKs on), schema auto-applied on boot
```

## Key invariants

- **AI assists, humans decide.** The AI never sends anything to a teacher and
  never scores teachers. Every AI output is a draft/insight behind mentor review.
- **Idempotent evidence.** Queue-time idempotency keys are replayed on retry;
  the server returns the original submission (`duplicate: true`) instead of
  creating a second row.
- **The ladder never regresses.** `recordAdoptionEvent` ignores stages at or
  below the teacher's current stage for that competency.
- **Evidence survives AI failure.** The evidence row is persisted before the
  analysis step; a failed analysis can be regenerated idempotently
  (`regenerateAnalysis`) and surfaced as `analysis: null` / 503, never data loss.
- **Aggregate-only analytics.** Admin endpoints expose counts, rates and
  turnaround times — no teacher rankings, no quality scores (spec constraint).

## Offline layer

`src/lib/offline/db.ts` (IndexedDB: drafts + outbox with queue-time keys) and
`src/lib/offline/sync.ts` (flush engine: replays multipart, stops on 401/403,
network-failure awareness). `src/components/SyncProvider.tsx` auto-flushes on
load, on reconnect, and every 60s while work is pending, and renders the
plain-language sync banner. Service worker (`public/sw.js`) is cache-first for
static assets and network-first for navigations; API traffic is never
intercepted.

## Auth

`src/lib/jwt.ts` — jose HS256 tokens in an httpOnly, SameSite=Lax cookie
(7-day expiry, secure in production). `src/middleware.ts` enforces role
prefixes (`/teacher/**`, `/mentor/**`, `/admin/**`, `/api/**`) at the edge;
every API route re-checks with `requireRole` (defense in depth). Login is
rate-limited (10 attempts / 5 min / client). Passwords: scrypt.

## Database

SQLite in WAL mode with foreign keys ON. Schema in `src/db/schema.ts`
(plus one idempotent in-code migration for a historical `drafted_by` change).
Seeded demo data (`npm run db:seed`) is idempotent and fully simulated —
every person is labeled as sample data.
