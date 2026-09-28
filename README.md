help# Classroom Loop

AI teacher-coaching platform MVP. One loop, fully persisted:
training → competency check → personalized task → practice scenario →
classroom evidence → AI analysis → mentor feedback → retry → adoption analytics.

- **Human-in-the-loop**: the AI drafts and suggests; the mentor reviews, edits and sends; adoption is measured, never inferred.
- **Offline-tolerant**: evidence drafts autosave on-device and queue in an idempotent outbox that syncs automatically when connectivity returns.
- **Privacy-first**: aggregate-only admin analytics, no rankings or surveillance metrics; all demo persons and records are simulated sample data.

## Run

```bash
npm install
npm run db:seed
npm run dev
```

Open http://localhost:3000. The SQLite database (`data/classroom-loop.db`, WAL) is created on first run; the seed is idempotent.

Production: `npm run build && npm start`.

## Demo logins

Password for all demo accounts: `demo1234`

| Role    | Email                          | Demo state |
| ------- | ------------------------------ | ---------- |
| Teacher | teacher.a@classroomloop.demo   | Full journey: two complete attempts with feedback |
| Teacher | teacher.b@classroomloop.demo   | Needs support: attempt awaiting mentor review |
| Teacher | teacher.c@classroomloop.demo   | On track: one strong attempt, feedback sent |
| Mentor  | mentor@classroomloop.demo      | Has Teacher B's evidence in the review queue |
| Admin   | admin@classroomloop.demo       | Sees funnel/adoption/support aggregates |

## Architecture & API docs

- [`docs/architecture.md`](docs/architecture.md) — layers, invariants, offline design, auth model
- [`docs/api.md`](docs/api.md) — route-by-route API reference

Stack: Next.js 15 (App Router) · TypeScript strict · SQLite (better-sqlite3, WAL) · Tailwind CSS · zod · jose · IndexedDB offline layer.

## Development checks

```bash
npm test          # vitest unit suite (engine, domain logic, API contracts)
npm run lint      # ESLint (also enforced during `npm run build` and in CI)
npm run typecheck # tsc --noEmit
```

`scripts/acceptance-journey.mjs` is a 20-step end-to-end script that walks the full
loop (teacher → evidence → mentor → feedback → retry → analytics) against a
running server on a fresh seed: `node scripts/acceptance-journey.mjs`. CI runs
it automatically on every push (`.github/workflows/ci.yml`).

## Optional: LLM upgrade

Without configuration, a deterministic local rubric engine powers personalization,
practice scenarios, evidence analysis and feedback drafts. To upgrade to an LLM
(with automatic fallback to the local engine), set `OPENAI_API_KEY` — see
`.env.example`. Set `JWT_SECRET` in production.

## Evidence media & retention

Teachers can attach photos (client-compressed), voice reflections (recorded
in-app) and short classroom videos (recorded in-app or picked from a file) to
evidence submissions — all capped at 5 MB, all optional, all playable to
mentors in review. Every media type is stored under `data/uploads`.

Set `EVIDENCE_RETENTION_DAYS` to delete upload files older than the window on
server boot and clear their database references (unset or `0` = retain
indefinitely). See `.env.example`. Production deployments should move media to
object storage with lifecycle rules and a CDN — local-disk retention is the
single-node stopgap.

## Known limitations

- Training-module completion is seeded, not yet editable in the UI.
- Real speech-to-text on uploaded audio and LLM output verification need an
  `OPENAI_API_KEY`; the AI analyzes typed/dictated text, not raw audio.
- Single-node rate limiting and SQLite mean vertical scaling only; the AI layer
  falls back to the local engine when no LLM is configured or reachable.
- Evidence media is stored on local disk; move to object storage + CDN for
  multi-node production (retention window above is the local-disk stopgap).
