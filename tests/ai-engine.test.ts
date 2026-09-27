import { describe, expect, it } from "vitest";
import { localAnalyzeEvidence, localDraftFeedback } from "@/lib/ai/local-engine";
import type { AnalysisResult, AnalyzeEvidenceInput } from "@/lib/ai/types";

const CRITERIA = [
  "Asks open-ended questions",
  "Gives learners response time (wait time)",
  "Encourages learners to explain reasoning",
  "Includes multiple learners",
  "Follows up on student answers",
];

const BASE: AnalyzeEvidenceInput = {
  reflection: "",
  checklist: {},
  voiceNote: null,
  criteria: CRITERIA,
  keywordsByCriterion: {
    "Asks open-ended questions": ["why", "how"],
    "Gives learners response time (wait time)": ["wait time", "pause"],
    "Encourages learners to explain reasoning": ["explain", "because"],
    "Includes multiple learners": ["pairs", "everyone"],
    "Follows up on student answers": ["probed", "followed up"],
  },
};

function analyze(overrides: Partial<AnalyzeEvidenceInput>): AnalysisResult {
  return localAnalyzeEvidence({ ...BASE, ...overrides });
}

const STRONG_REFLECTION =
  "I asked students why they thought the plant near the window grew taller, and I gave " +
  "them wait time by counting three seconds in my head before taking answers. Then I " +
  "put them in pairs so everyone could explain their reasoning to a partner. I probed " +
  "two students with a follow-up question about how they worked that out.";

describe("localAnalyzeEvidence — Observed / Interpreted / Recommended separation", () => {
  it("keeps observed anchored to the teacher's own words and checklist, not invention", () => {
    const result = analyze({ reflection: STRONG_REFLECTION });
    expect(result.observed.length).toBeGreaterThan(0);
    const quoted = result.observed.filter((o) => o.startsWith('"'));
    expect(quoted.length).toBeGreaterThan(0);
    for (const q of quoted) {
      const inner = q.slice(1, -1).toLowerCase();
      expect(STRONG_REFLECTION.toLowerCase()).toContain(inner.slice(0, 20));
    }
    expect(result.observed.some((o) => o.startsWith("✓ (checklist)"))).toBe(false); // no checklist entries supplied
  });

  it("produces interpretation lines that are framed as inference, not fact", () => {
    const result = analyze({ reflection: STRONG_REFLECTION });
    expect(result.interpretation.length).toBeGreaterThan(0);
    const joined = result.interpretation.join(" ");
    expect(joined).toMatch(/suggest|appear|possible|caution|not a verdict/i);
  });

  it("produces actionable recommendations distinct from interpretation", () => {
    const result = analyze({ reflection: STRONG_REFLECTION });
    expect(result.recommendation.length).toBeGreaterThan(0);
    for (const r of result.recommendation) {
      expect(r.toLowerCase()).toMatch(/next attempt|next:|practise|prepare|use|pick|repeat/);
    }
  });
});

describe("localAnalyzeEvidence — rubric criterion scoring", () => {
  it("hits all criteria when the reflection contains their keywords", () => {
    const result = analyze({ reflection: STRONG_REFLECTION });
    expect(result.criterionHits.map((c) => c.hit)).toEqual([true, true, true, true, true]);
  });

  it("cites a quote from the reflection for text-based hits", () => {
    const result = analyze({ reflection: STRONG_REFLECTION });
    const waitTime = result.criterionHits.find(
      (c) => c.label === "Gives learners response time (wait time)"
    );
    expect(waitTime?.hit).toBe(true);
    expect(waitTime?.evidence.some((e) => /wait time/i.test(e))).toBe(true);
  });

  it("reports misses with no fabricated evidence", () => {
    const result = analyze({
      reflection:
        "I asked why plants grow taller near the window and gave wait time with a pause.",
    });
    const missed = result.criterionHits.filter((c) => !c.hit);
    expect(missed.length).toBeGreaterThan(0);
    for (const m of missed) expect(m.evidence).toEqual([]);
    expect(result.interpretation.some((i) => i.includes("no visible evidence"))).toBe(true);
  });

  it("accepts a self-checked checklist entry as hit evidence, distinctly labelled", () => {
    const result = analyze({
      reflection: "Nothing relevant here at all.",
      checklist: { "Includes multiple learners": true },
    });
    const incl = result.criterionHits.find((c) => c.label === "Includes multiple learners");
    expect(incl?.hit).toBe(true);
    expect(incl?.evidence).toEqual(["(self-checked on submission checklist)"]);
  });

  it("recommends specific next steps for each missing core criterion", () => {
    const result = analyze({ reflection: "Students were silent the whole lesson." });
    const recs = result.recommendation.join(" ");
    expect(recs).toContain("open questions");
    expect(recs).toContain("pause");
    expect(recs).toContain("pair-share");
    expect(recs).toContain("how did you work that out");
  });

  it("falls back to a strength-preserving recommendation on a full-rubric attempt", () => {
    const result = analyze({ reflection: STRONG_REFLECTION });
    expect(result.recommendation).toEqual([
      expect.stringMatching(/Strong attempt against the rubric/),
    ]);
  });
});

describe("localAnalyzeEvidence — support-signal detection", () => {
  it("flags a brief reflection as a watch-level incomplete-evidence signal", () => {
    const result = analyze({ reflection: "Tried it. Went okay." });
    const brief = result.supportFlags.find((f) => f.signal === "Brief reflection");
    expect(brief?.severity).toBe("watch");
    expect(brief?.detail).toContain("under 80 characters");
  });

  it("raises an alert and supportRecommended when nothing is evidenced", () => {
    const result = analyze({ reflection: "It was a normal day." });
    expect(result.supportFlags.some((f) => f.signal === "No rubric criteria evidenced" && f.severity === "alert")).toBe(true);
    expect(result.supportRecommended).toBe(true);
  });

  it("recommends support after 2+ prior retries (repeated difficulty)", () => {
    const result = analyze({
      reflection: STRONG_REFLECTION,
      history: { priorAttempts: 3, priorEvidence: 3, priorFeedback: 2, priorRetries: 2 },
    });
    const retries = result.supportFlags.find((f) => f.signal === "Repeated retries");
    expect(retries?.severity).toBe("alert");
    expect(retries?.detail).toContain("2 retries");
    expect(result.supportRecommended).toBe(true);
  });

  it("flags prior attempts with no submitted evidence", () => {
    const result = analyze({
      reflection: STRONG_REFLECTION,
      history: { priorAttempts: 2, priorEvidence: 0, priorFeedback: 0, priorRetries: 1 },
    });
    expect(result.supportFlags.some((f) => f.signal === "No classroom attempt evidenced" && f.severity === "alert")).toBe(true);
  });

  it("watches low self-reported confidence without escalating to alert", () => {
    const result = analyze({
      reflection: STRONG_REFLECTION,
      context: {
        experience_years: 2, grades_taught: [4], subjects: ["Science"], class_size: 30,
        multigrade: false, school_context: null, challenges: [], confidence: 1,
      },
    });
    const low = result.supportFlags.find((f) => f.signal === "Low self-reported confidence");
    expect(low?.severity).toBe("watch");
    expect(result.supportRecommended).toBe(false);
  });

  it("raises no support flags for a healthy strong attempt", () => {
    const result = analyze({ reflection: STRONG_REFLECTION });
    expect(result.supportFlags).toEqual([]);
    expect(result.supportRecommended).toBe(false);
  });
});

describe("localDraftFeedback — AI drafts, mentor decides", () => {
  it("renders the three standard sections in order", () => {
    const draft = localDraftFeedback({
      analysis: analyze({ reflection: STRONG_REFLECTION }),
      teacherName: "Amara Okafor",
      competencyTitle: "Effective Questioning",
    });
    const headings = draft
      .split("\n")
      .filter((l) => l.startsWith("### "))
      .map((l) => l.replace("### ", ""));
    expect(headings).toEqual([
      "What appears to have worked",
      "Possible improvement area",
      "Suggested next attempt",
    ]);
  });

  it("lists hit criteria as strengths and missed criteria as improvement areas", () => {
    const analysis = analyze({
      reflection: "I asked why plants grow taller and gave wait time with a pause.",
    });
    const draft = localDraftFeedback({
      analysis,
      teacherName: "Amara Okafor",
      competencyTitle: "Effective Questioning",
    });
    expect(draft).toContain("- Asks open-ended questions");
    expect(draft).toContain("- Includes multiple learners: no clear evidence in this attempt.");
    expect(draft).not.toContain("- Asks open-ended questions: no clear evidence");
  });

  it("uses analysis recommendations as the next-attempt steps", () => {
    const analysis = analyze({ reflection: STRONG_REFLECTION });
    const draft = localDraftFeedback({ analysis, teacherName: "Amara Okafor", competencyTitle: "Effective Questioning" });
    for (const rec of analysis.recommendation.slice(0, 2)) {
      expect(draft).toContain(`- ${rec}`);
    }
  });

  it("keeps the human-in-the-loop footer naming the teacher and competency", () => {
    const draft = localDraftFeedback({
      analysis: analyze({ reflection: STRONG_REFLECTION }),
      teacherName: "Amara Okafor",
      competencyTitle: "Effective Questioning",
    });
    expect(draft).toContain("for Amara Okafor (Effective Questioning)");
    expect(draft).toMatch(/the mentor reviews, edits and decides/i);
  });

  it("encourages rather than emptily criticises when no strengths were detectable", () => {
    const analysis = analyze({ reflection: "Hmm." });
    const draft = localDraftFeedback({ analysis, teacherName: "Amara Okafor", competencyTitle: "Effective Questioning" });
    expect(draft).toContain("The attempt was submitted");
  });

  it("is deterministic — same input, same draft", () => {
    const input = {
      analysis: analyze({ reflection: STRONG_REFLECTION }),
      teacherName: "Amara Okafor",
      competencyTitle: "Effective Questioning",
    };
    expect(localDraftFeedback(input)).toBe(localDraftFeedback(input));
  });
});
