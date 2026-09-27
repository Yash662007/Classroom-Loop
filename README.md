# Classroom Loop

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

| Role    | Email                          |
| ------- | ------------------------------ |
| Teacher | teacher.a@classroomloop.demo   |
| Teacher | teacher.b@classroomloop.demo   |
| Teacher | teacher.c@classroomloop.demo   |
| Mentor  | mentor@classroomloop.demo      |
| Admin   | admin@classroomloop.demo       |

## Development checks

```bash
npm test          # vitest unit suite (engine, domain logic, API contracts)
npm run typecheck # tsc --noEmit
```

## Optional: LLM upgrade

Without configuration, a deterministic local rubric engine powers personalization,
practice scenarios, evidence analysis and feedback drafts. To upgrade to an LLM
(with automatic fallback to the local engine), set `OPENAI_API_KEY` — see
`.env.example`. Set `JWT_SECRET` in production.
