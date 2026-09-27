/**
 * AI service facade — the single entry point the rest of the app uses.
 *
 * LLM-first with automatic fallback to the deterministic local engine, so
 * every capability works with zero configuration and upgrades transparently
 * when OPENAI_API_KEY (+ optional OPENAI_BASE_URL / OPENAI_MODEL) is set.
 *
 * Human-in-the-loop principle: this module never decides anything final;
 * its outputs are always drafts/insights for humans to review.
 */
import { chatJson, isLlmConfigured, LlmUnavailableError } from "./client";
import {
  localAnalyzeEvidence,
  localDraftFeedback,
  localPersonalize,
  localPracticeScenario,
} from "./local-engine";
import type {
  AiSource,
  AnalysisResult,
  AnalyzeEvidenceInput,
  FeedbackDraftInput,
  PersonalizationInput,
  PersonalizationOutput,
  PracticeScenarioInput,
  PracticeScenarioOutput,
} from "./types";

export interface WithSource<T> {
  result: T;
  source: AiSource;
  /** Present (with the error) when the LLM was configured but fell back. */
  fallbackReason?: string;
}

/** Runs an LLM attempt; on any failure returns null so callers can fall back. */
async function tryLlm<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!isLlmConfigured()) return null;
  try {
    return await fn();
  } catch (err) {
    if (err instanceof LlmUnavailableError) {
      console.warn(`[ai] LLM unavailable, falling back to local engine: ${err.message}`);
    } else {
      console.warn("[ai] Unexpected LLM error, falling back to local engine", err);
    }
    return null;
  }
}

/* ---------------- A1 — Personalization ---------------- */

export async function generatePersonalization(
  input: PersonalizationInput
): Promise<WithSource<PersonalizationOutput>> {
  const llm = await tryLlm(() => llmPersonalize(input));
  if (llm) return { result: llm, source: "llm" };
  return { result: localPersonalize(input), source: "local_engine" };
}

async function llmPersonalize(input: PersonalizationInput): Promise<PersonalizationOutput> {
  const data = await chatJson<Partial<PersonalizationOutput>>([
    {
      role: "system",
      content:
        "You design classroom implementation tasks for schoolteachers. " +
        "Personalize using experience + context + competency + need. Never assume new teachers are weak or experienced teachers are advanced. " +
        'Respond as JSON: {"title": string, "activity": string (numbered steps, one lesson, concrete), "difficulty": "starter"|"core"|"stretch", "microLearning": string[], "support": string|null, "reasoning": string, "personalizationFactors": string[]}',
    },
    { role: "user", content: JSON.stringify(input) },
  ]);
  const base = localPersonalize(input); // shape/length backstop
  return {
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 120) : base.title,
    activity: typeof data.activity === "string" && data.activity.trim() ? data.activity.trim().slice(0, 2000) : base.activity,
    difficulty: data.difficulty === "starter" || data.difficulty === "stretch" ? data.difficulty : "core",
    microLearning: Array.isArray(data.microLearning) ? data.microLearning.filter((m): m is string => typeof m === "string").slice(0, 5) : base.microLearning,
    support: typeof data.support === "string" ? data.support.slice(0, 300) : null,
    reasoning: typeof data.reasoning === "string" ? data.reasoning.slice(0, 500) : base.reasoning,
    personalizationFactors: Array.isArray(data.personalizationFactors) ? data.personalizationFactors.filter((f): f is string => typeof f === "string").slice(0, 8) : base.personalizationFactors,
  };
}

/* ---------------- A2 — Practice scenario ---------------- */

export async function generatePracticeScenario(
  input: PracticeScenarioInput
): Promise<WithSource<PracticeScenarioOutput>> {
  const llm = await tryLlm(() => llmScenario(input));
  if (llm) return { result: llm, source: "llm" };
  return { result: localPracticeScenario(input), source: "local_engine" };
}

async function llmScenario(input: PracticeScenarioInput): Promise<PracticeScenarioOutput> {
  const data = await chatJson<Partial<PracticeScenarioOutput>>([
    {
      role: "system",
      content:
        "You write short realistic classroom practice scenarios for teacher technique rehearsal. " +
        "The scenario must require a decision (not just reading). 4 answer options, exactly one clearly best. " +
        'Respond as JSON: {"scenario": string, "choices": [string, string, string, string], "recommendedChoice": number (0-3)}',
    },
    { role: "user", content: JSON.stringify(input) },
  ]);
  if (!Array.isArray(data.choices) || data.choices.length < 2) {
    throw new LlmUnavailableError("Scenario choices missing");
  }
  const choices = data.choices.map((c) => String(c)).slice(0, 4);
  const rec = Number(data.recommendedChoice);
  return {
    scenario: String(data.scenario ?? "").slice(0, 1200),
    choices,
    recommendedChoice: Number.isInteger(rec) && rec >= 0 && rec < choices.length ? rec : 0,
  };
}

/* ---------------- A3/A4 — Evidence analysis + support detection ---------------- */

export async function analyzeEvidence(
  input: AnalyzeEvidenceInput
): Promise<WithSource<AnalysisResult>> {
  const llm = await tryLlm(() => llmAnalyze(input));
  if (llm) return { result: llm, source: "llm" };
  return { result: localAnalyzeEvidence(input), source: "local_engine" };
}

async function llmAnalyze(input: AnalyzeEvidenceInput): Promise<AnalysisResult> {
  const data = await chatJson<Partial<AnalysisResult>>([
    {
      role: "system",
      content:
        "You analyze teacher implementation evidence against a rubric. Strictly separate: observed (only what the evidence literally shows, quote the teacher's words), " +
        "interpretation (clearly labeled inference, never stated as fact), recommendation (next actions). " +
        "Also detect support signals: no classroom attempt, repeated difficulty/retries, incomplete evidence, low confidence, repeated competency problems. " +
        'Respond as JSON: {"observed": string[], "interpretation": string[], "recommendation": string[], ' +
        '"criterionHits": [{"label": string, "hit": boolean, "evidence": string[]}], "supportFlags": [{"signal": string, "detail": string, "severity": "info"|"watch"|"alert"}], "supportRecommended": boolean}',
    },
    { role: "user", content: JSON.stringify(input) },
  ]);

  const base = localAnalyzeEvidence(input); // backstop for missing fields
  const hits = Array.isArray(data.criterionHits)
    ? data.criterionHits
        .filter((c) => c && typeof c.label === "string")
        .map((c) => ({
          label: c.label,
          hit: Boolean(c.hit),
          evidence: Array.isArray(c.evidence) ? c.evidence.map(String).slice(0, 3) : [],
        }))
    : base.criterionHits;
  const flags = Array.isArray(data.supportFlags)
    ? data.supportFlags
        .filter((f) => f && typeof f.signal === "string")
        .map((f) => ({
          signal: String(f.signal).slice(0, 120),
          detail: String(f.detail ?? "").slice(0, 300),
          severity: f.severity === "alert" ? ("alert" as const) : f.severity === "watch" ? ("watch" as const) : ("info" as const),
        }))
    : base.supportFlags;

  return {
    observed: Array.isArray(data.observed) ? data.observed.map(String).slice(0, 12) : base.observed,
    interpretation: Array.isArray(data.interpretation) ? data.interpretation.map(String).slice(0, 8) : base.interpretation,
    recommendation: Array.isArray(data.recommendation) ? data.recommendation.map(String).slice(0, 6) : base.recommendation,
    criterionHits: hits,
    supportFlags: flags,
    supportRecommended: Boolean(data.supportRecommended) || flags.some((f) => f.severity === "alert"),
  };
}

/* ---------------- A5 — Feedback drafting ---------------- */

export async function draftFeedback(
  input: FeedbackDraftInput
): Promise<WithSource<string>> {
  const llm = await tryLlm(() => llmFeedback(input));
  if (llm) return { result: llm, source: "llm" };
  return { result: localDraftFeedback(input), source: "local_engine" };
}

async function llmFeedback(input: FeedbackDraftInput): Promise<string> {
  const data = await chatJson<{ draft?: string }>([
    {
      role: "system",
      content:
        "Draft mentor feedback for a teacher's classroom implementation attempt. Structure exactly: " +
        "a '### What appears to have worked' section, a '### Possible improvement area' section, a '### Suggested next attempt' section. " +
        "Warm, specific, respectful, under 250 words. This is a DRAFT for the mentor to edit and approve — never addressed as final. " +
        'Respond as JSON: {"draft": string}',
    },
    { role: "user", content: JSON.stringify(input) },
  ]);
  if (!data.draft || typeof data.draft !== "string" || data.draft.trim().length < 20) {
    throw new LlmUnavailableError("Feedback draft too short");
  }
  return data.draft.trim().slice(0, 6000);
}

export { isLlmConfigured };
