# API Reference (v1)

All routes are under `/api`, JSON in/out unless noted, and authenticated by the
`cl_session` httpOnly cookie. Errors are uniform:
`{ "error": string, "code": string }` with an appropriate HTTP status
(401 unauthorized · 403 forbidden · 400 validation/bad input · 404 not found ·
409 conflict · 429 rate limited · 500 internal).

## Auth

| Method | Path | Role | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/auth/login` | — | `{ email, password }` → sets session cookie. Rate limited (10 / 5 min). |
| POST | `/auth/logout` | any | Clears the session cookie. |
| GET | `/auth/me` | any | `{ user }` or `{ user: null }`. |
| GET | `/health` | — | Liveness + DB check. |

## Teacher

| Method | Path | Role | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/teacher/dashboard` | teacher | Focus competency, loop steps, counts, adoption. |
| GET | `/teacher/competencies` | teacher | Competencies + modules + latest check result. |
| GET/PUT | `/teacher/context` | teacher | Teaching context upsert (zod-validated). |
| POST | `/competencies/check` | teacher | `{ competency_id, answers }` → `passed` ≥ 80% / `needs_review`. |
| POST | `/implementation/generate` | teacher | `{ competency_id, force_new? }` → personalized task (AI). |
| GET/POST | `/practice/sessions` | teacher | Scenario response; one session per task (409 on repeat). |
| POST | `/evidence` | teacher | Multipart (photo) or JSON. Idempotent via `x-idempotency-key` / `client_token`. `analysis` may be `null` while pending. |
| GET | `/teacher/evidence/[id]` | teacher | Evidence + analysis + received feedback. |
| GET | `/teacher/history` | teacher | Full attempt history per competency. |

## Mentor

| Method | Path | Role | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/mentor/queue` | mentor, admin | Evidence awaiting review (support-first). |
| GET | `/mentor/evidence/[id]` | mentor, admin | Full review payload (own assigned teachers only). |
| POST | `/mentor/feedback/draft` | mentor, admin | `{ evidence_id }` → AI draft (created once; never auto-sent). |
| POST | `/mentor/feedback` | mentor, admin | `{ evidence_id, message, action: "approve_send", edited_by_mentor? }` → sends the mentor's words; advances adoption. |
| GET | `/mentor/teachers` · `/mentor/teachers/[id]/history` | mentor, admin | Cluster + per-teacher history (read-only). |
| GET | `/mentor/cluster` | mentor, admin | Aggregate totals + stage distribution. |
| GET | `/uploads/[...path]` | role-scoped | Teachers: own photos. Mentors: assigned teachers' photos. Path-traversal safe. |

## Admin (aggregate-only)

| Method | Path | Role | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/analytics/funnel` | admin | Training → adoption funnel counts. |
| GET | `/analytics/implementation` | admin | Activity metrics, turnaround times, AI source split. |
| GET | `/analytics/adoption` | admin | Stage distribution overall and per competency. |
| GET | `/analytics/support` | admin | Rule-based intervention signals (no scores, no ranking). |

## AI behavior

All AI capabilities go through `src/lib/ai/service.ts`: if `OPENAI_API_KEY` is
set, an LLM attempt runs first (structured JSON prompts, timeout, one retry,
strict output validation); any failure falls back to the deterministic local
rubric engine, so every workflow completes without external dependencies.
