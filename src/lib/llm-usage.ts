/**
 * LLM usage metering (production-debt item #17).
 *
 * OpenAI-compatible chat completions responses carry a `usage` object
 * (prompt_tokens / completion_tokens). When a provider returns one, it is
 * recorded against the domain artifact the call produced (task generation,
 * evidence analysis, feedback draft) so the admin view can answer "what does
 * the LLM upgrade cost us and where is it used".
 *
 * Pure domain module — no network code. Metering failures must never break
 * the artifact they measure.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/instance";

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  model?: string;
}

export type LlmArtifactKind = "task_generation" | "evidence_analysis" | "feedback_draft";

export interface RecordLlmUsageInput {
  artifactKind: LlmArtifactKind;
  /** Domain row the call produced: implementation_tasks.id, evidence id, mentor_feedback.id. */
  artifactId: string;
  usage: LlmUsage | null;
  model?: string;
}

/** Non-throwing: metering is observability, never on the critical path. */
export function recordLlmUsage(input: RecordLlmUsageInput): void {
  try {
    if (!input.usage || (!input.usage.promptTokens && !input.usage.completionTokens)) return;
    const db = getDb();
    db.prepare(
      `INSERT INTO llm_usage (id, artifact_kind, artifact_id, prompt_tokens, completion_tokens, total_tokens, model, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      input.artifactKind,
      input.artifactId,
      input.usage.promptTokens ?? 0,
      input.usage.completionTokens ?? 0,
      input.usage.totalTokens ?? (input.usage.promptTokens ?? 0) + (input.usage.completionTokens ?? 0),
      input.usage.model ?? input.model ?? null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error("[llm-usage] recording failed (ignored):", err instanceof Error ? err.message : err);
  }
}

export interface LlmUsageSummary {
  totalCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  byArtifact: Array<{ artifactKind: LlmArtifactKind; calls: number; totalTokens: number }>;
}

export function getLlmUsageSummary(): LlmUsageSummary {
  const db = getDb();
  const one = (sql: string): number => (db.prepare(sql).get() as { n: number } | undefined)?.n ?? 0;
  const totalCalls = one(`SELECT COUNT(*) AS n FROM llm_usage`);
  const promptTokens = one(`SELECT COALESCE(SUM(prompt_tokens), 0) AS n FROM llm_usage`);
  const completionTokens = one(`SELECT COALESCE(SUM(completion_tokens), 0) AS n FROM llm_usage`);
  const byArtifact = (
    db
      .prepare(
        `SELECT artifact_kind, COUNT(*) AS calls, COALESCE(SUM(total_tokens), 0) AS tokens
         FROM llm_usage GROUP BY artifact_kind ORDER BY tokens DESC`
      )
      .all() as Array<{ artifact_kind: LlmArtifactKind; calls: number; tokens: number }>
  ).map((r) => ({ artifactKind: r.artifact_kind, calls: r.calls, totalTokens: r.tokens }));
  return { totalCalls, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, byArtifact };
}
