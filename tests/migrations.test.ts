import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { getDb, resetDbForTests } from "@/db/instance";
import { MIGRATIONS } from "@/db/migrations";
import { getLlmUsageSummary, recordLlmUsage } from "@/lib/llm-usage";

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "classroom-loop-migrations-"));
  process.env.DATA_DIR = dataDir;
  resetDbForTests();
});
afterAll(() => {
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Windows may keep handles open; OS temp dir reclaims.
  }
});

describe("versioned migrations", () => {
  it("records every migration exactly once on a fresh database", () => {
    getDb();
    const rows = getDb().prepare(`SELECT id, name FROM schema_migrations ORDER BY id`).all() as Array<{
      id: number;
      name: string;
    }>;
    expect(rows.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(rows[0].name).toBe("baseline_schema");
  });

  it("is idempotent — reopening the db applies nothing new", () => {
    getDb();
    const before = (getDb().prepare(`SELECT COUNT(*) AS n FROM schema_migrations`).get() as { n: number }).n;
    resetDbForTests();
    getDb();
    const after = (getDb().prepare(`SELECT COUNT(*) AS n FROM schema_migrations`).get() as { n: number }).n;
    expect(before).toBe(after);
    expect(after).toBe(MIGRATIONS.length);
  });

  it("creates the llm_usage table via migration 003", () => {
    getDb();
    const tables = getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'llm_usage'`)
      .all() as Array<{ name: string }>;
    expect(tables).toHaveLength(1);
  });

  it("legacy sync_log stays dropped after migrations run", () => {
    getDb();
    const tables = getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_log'`)
      .all() as Array<{ name: string }>;
    expect(tables).toHaveLength(0);
  });

  it("rejects a duplicate artifact_kind insert (check constraint intact)", () => {
    getDb();
    expect(() =>
      getDb()
        .prepare(
          `INSERT INTO llm_usage (id, artifact_kind, artifact_id, prompt_tokens, completion_tokens, total_tokens, recorded_at)
           VALUES ('x', 'bogus_kind', 'a', 1, 1, 2, '2026-01-01')`
        )
        .run()
    ).toThrow();
  });
});

describe("llm usage metering", () => {
  it("records usage with computed totals and summarizes by artifact", () => {
    recordLlmUsage({
      artifactKind: "evidence_analysis",
      artifactId: "ev-1",
      usage: { promptTokens: 100, completionTokens: 50, model: "test-model" },
    });
    recordLlmUsage({
      artifactKind: "feedback_draft",
      artifactId: "fb-1",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const s = getLlmUsageSummary();
    expect(s.totalCalls).toBe(2);
    expect(s.promptTokens).toBe(110);
    expect(s.completionTokens).toBe(70);
    expect(s.totalTokens).toBe(180);
    expect(s.byArtifact[0]).toMatchObject({ artifactKind: "evidence_analysis", calls: 1, totalTokens: 150 });
  });

  it("ignores null/empty usage — local-engine calls leave no rows", () => {
    recordLlmUsage({ artifactKind: "task_generation", artifactId: "t-1", usage: null });
    recordLlmUsage({ artifactKind: "task_generation", artifactId: "t-2", usage: { promptTokens: 0, completionTokens: 0 } });
    expect(getLlmUsageSummary().totalCalls).toBe(0);
  });
});
