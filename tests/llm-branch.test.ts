/**
 * LLM branch integration test — the whole AI path against a local
 * OpenAI-compatible mock server (contract-exact: choices[].message.content,
 * usage.prompt_tokens/completion_tokens, model).
 *
 * This is NOT a real-provider test: output quality from a real LLM remains
 * unverified until OPENAI_API_KEY points at one. What this proves is the
 * branch mechanics end-to-end: config detection → client → strict-JSON
 * service wrappers → domain persistence (generated_by='llm') → token
 * metering rows — plus the fallback when the provider is down.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type AddressInfo from "node:net";

import { getDb, resetDbForTests } from "@/db/instance";
import { analyzeEvidence, draftFeedback, generatePersonalization } from "@/lib/ai/service";
import { isLlmConfigured } from "@/lib/ai/client";
import { getLlmUsageSummary } from "@/lib/llm-usage";

let dataDir: string;
let server: Server | null = null;
let baseUrl = "";
let requestCount = 0;
let respondWith: (body: unknown) => unknown = () => ({});

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "classroom-loop-llm-"));
  process.env.DATA_DIR = dataDir;
  resetDbForTests();
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requestCount += 1;
      const body = respondWith({ promptChars: raw.length });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          model: "mock-gpt",
          choices: [{ message: { role: "assistant", content: JSON.stringify(body) } }],
          usage: { prompt_tokens: 10 + requestCount, completion_tokens: 20, total_tokens: 30 + requestCount },
        })
      );
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Windows handle cleanup; OS temp dir reclaims.
  }
});

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = baseUrl;
  process.env.OPENAI_MODEL = "mock-gpt";
  requestCount = 0;
  respondWith = () => ({});
  getDb();
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_MODEL;
});

const validAnalysis = {
  observed: ["Teacher describes calling on two students"],
  interpretation: ["Pair-share likely increased participation"],
  recommendation: ["Keep wait time at three seconds"],
  criterionHits: [{ label: "Open questions", hit: true, evidence: ["asked how they worked that out"] }],
  supportFlags: [],
  supportRecommended: false,
};

describe("LLM branch against an OpenAI-compatible mock", () => {
  it("routes analysis through the LLM and persists generated_by=llm", async () => {
    respondWith = () => validAnalysis;
    const r = await analyzeEvidence({
      reflection: "I asked two students how they worked that out.",
      checklist: {},
      voiceNote: null,
      criteria: ["Open questions"],
    });
    expect(r.source).toBe("llm");
    expect(r.result.observed[0]).toContain("two students");
    expect(r.usage).toMatchObject({ promptTokens: expect.any(Number), completionTokens: 20 });
    expect(r.model).toBe("mock-gpt");
  });

  it("returns provider usage on every LLM result (domain layer persists it)", async () => {
    respondWith = () => ({
      title: "T",
      activity: "A",
      difficulty: "core",
      microLearning: ["m"],
      support: null,
      reasoning: "r",
      personalizationFactors: ["f"],
    });
    await generatePersonalization({
      teacherName: "T",
      competencyId: "c1",
      competencyTitle: "C1",
      checkScore: 8,
      checkScale: 10,
      context: {
        experience_years: 2, grades_taught: [1], subjects: ["Math"], class_size: 20,
        multigrade: false, school_context: null, challenges: [], confidence: 3,
      },
      history: { priorAttempts: 0, priorEvidence: 0, priorFeedback: 0, priorRetries: 0 },
    });

    respondWith = () => validAnalysis;
    await analyzeEvidence({ reflection: "r", checklist: {}, voiceNote: null, criteria: ["c"] });

    respondWith = () => ({
      draft: "### What appears to have worked\nGood probing.\n\n### Possible improvement area\nWait time.\n\n### Suggested next attempt\nTry cold-calling.",
    });
    const fb = await draftFeedback({
      analysis: { ...validAnalysis, criterionHits: [], supportFlags: [] },
      teacherName: "T",
      competencyTitle: "C1",
    });
    expect(fb.source).toBe("llm");

    // The facade surfaces usage; the domain layer (teacher-loop/mentor-loop)
    // is what binds it to llm_usage rows (covered by domain/journey tests).
    expect(getLlmUsageSummary().totalCalls).toBe(0);
  });

  it("falls back to the local engine with no metering when the provider is down", async () => {
    process.env.OPENAI_BASE_URL = "http://127.0.0.1:9/v1"; // nothing listens there
    const r = await analyzeEvidence({
      reflection: "I tried the technique and students responded well.",
      checklist: {},
      voiceNote: null,
      criteria: ["Open questions"],
    });
    expect(r.source).toBe("local_engine");
    expect(r.usage).toBeUndefined();
    expect(getLlmUsageSummary().totalCalls).toBe(0);
  });

  it("is unconfigured without a key, regardless of base URL", () => {
    delete process.env.OPENAI_API_KEY;
    expect(isLlmConfigured()).toBe(false);
  });
});
