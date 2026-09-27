/**
 * Local deterministic AI engine — the zero-setup fallback implementation.
 *
 * Same contracts as the LLM path. Deliberately transparent: rule/rubric based,
 * no hidden inference presented as fact. Observed ≠ interpreted ≠ recommended.
 */
import type {
  AnalysisResult,
  AnalyzeEvidenceInput,
  FeedbackDraftInput,
  HistorySummary,
  PersonalizationInput,
  PersonalizationOutput,
  PracticeScenarioInput,
  PracticeScenarioOutput,
  SupportFlag,
} from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ------------------------------------------------------------------ */
/* A1 — Context-aware personalization                                  */
/* ------------------------------------------------------------------ */

export function localPersonalize(input: PersonalizationInput): PersonalizationOutput {
  const { context, history, checkScore, checkScale = 10 } = input;
  const c = context;

  const factors: string[] = [];
  const factorsFor = (f: string) => factors.push(f);

  factorsFor(
    `${c.experience_years} yr experience · ${c.multigrade ? "multi-grade" : "single-grade"} · class of ${c.class_size ?? "?"}`
  );
  if (checkScore != null) factorsFor(`competency check ${checkScore}/${checkScale}`);
  if (c.confidence <= 2) factorsFor(`self-reported confidence low (${c.confidence}/5)`);
  if (history.priorAttempts > 0) factorsFor(`${history.priorAttempts} prior attempt(s)`);

  // Difficulty = Experience + Context + Competency + Need (spec §7).
  let score = 0;
  score += c.experience_years >= 8 ? 1 : c.experience_years >= 3 ? 0 : -1; // experience
  score += c.confidence <= 2 ? -1 : c.confidence >= 4 ? 1 : 0; // self-reported confidence
  if (checkScore != null) score += checkScore / checkScale >= 0.8 ? 1 : checkScore / checkScale <= 0.6 ? -1 : 0;
  if (c.multigrade || (c.class_size ?? 0) > 50) score -= 1; // structural load
  if (history.priorRetries >= 2) score -= 1; // repeated difficulty

  const difficulty: PersonalizationOutput["difficulty"] = score <= -2 ? "starter" : score >= 2 ? "stretch" : "core";

  const multiGradeAngle = c.multigrade
    ? `Organise the class into grade-wise pairs/trios so one group works on a written task while you question the other group.`
    : (c.class_size ?? 0) > 45
      ? `Use pair-share first so every learner rehearses an answer before anyone answers aloud — essential at a class size of ${c.class_size}.`
      : `Work with the whole class, using pair-share to include quieter learners.`;

  const activity = `This week, in ONE lesson, apply ${input.competencyTitle} with a planned sequence:
1. Prepare 3 open questions in advance (write them where you can see them).
2. ${multiGradeAngle}
3. After each question, count silently to three (wait time) before taking answers.
4. Pick at least 2 learners you would not usually call on, and 1 learner to ask "how did you work that out?".
5. Note afterwards: which question got the most students thinking, and which learners answered.`;

  const microLearning: string[] = [`Refresher: ${input.competencyTitle} — 3-minute technique card`];
  if (c.multigrade) microLearning.push("Multi-grade management: running two groups with one technique");
  if ((c.class_size ?? 0) > 45) microLearning.push("Large-class questioning: pair-share and group response boards");
  if (c.confidence <= 2) microLearning.push("Building confidence: try the technique with your most responsive class first");
  if (history.priorAttempts === 0) microLearning.push("What good evidence looks like (2-minute read before your first attempt)");

  const support =
    history.priorRetries >= 2 || c.confidence <= 1
      ? "Mentor check-in suggested before next attempt (repeated difficulty / low confidence)."
      : null;

  const reasoning = `Personalized from: ${factors.join("; ")}. Difficulty "${difficulty}" balances experience, context load, competency check and history.`;

  return { title: `${input.competencyTitle}: ${difficulty === "starter" ? "First Steps" : difficulty === "stretch" ? "Extension" : "Core Practice"} Plan`, activity, difficulty, microLearning, support, reasoning, personalizationFactors: factors };
}

/* ------------------------------------------------------------------ */
/* A2 — Practice scenario generation                                   */
/* ------------------------------------------------------------------ */

export function localPracticeScenario(input: PracticeScenarioInput): PracticeScenarioOutput {
  const { context } = input;
  const cs = context.class_size ?? 40;
  const multigrade = context.multigrade;

  const scenario = multigrade
    ? `PRACTICE SCENARIO (simulated classroom — sample data).
You teach grades 1–5 alone; today grades 3–5 (28 students) and grades 1–2 (12 students) are with you.
You ask: "Why do the plants near the window grow taller than the others?"
Three hands go up — all from grade 5. The grade 1–2 group is finishing written work.
What is the BEST next move?`
    : `PRACTICE SCENARIO (simulated classroom — sample data).
Your class of ${cs} students is mid-lesson. You ask an open question about the day's topic.
After 10 seconds, only 3 students (the usual ones, front row) raise their hands; several others look down.
What is the BEST next move?`;

  const choices = multigrade
    ? [
        "Repeat the question louder and wait for more volunteers",
        "Ask the three grade 5 students to answer first, then move on",
        "Pair grade 5 students with younger ones to discuss the question for one minute, then take answers from mixed pairs",
        "Move on to the next topic and come back to questioning later",
      ]
    : [
        "Repeat the question louder and wait for more volunteers",
        "Answer it yourself and continue the lesson to save time",
        "Ask everyone to discuss in pairs for one minute, then call on two pairs — including one from the back row",
        "Only call on the three volunteers and continue",
      ];

  return { scenario, choices, recommendedChoice: 2 };
}

/* ------------------------------------------------------------------ */
/* A3 + A4 — Evidence analysis & support detection                     */
/* ------------------------------------------------------------------ */

const DEFAULT_KEYWORDS: Record<string, string[]> = {
  "Asks open-ended questions": ["open", "why", "how", "what do you think", "imagine", "debate"],
  "Gives learners response time (wait time)": ["wait time", "pause", "counted", "think first", "silence", "no rush", "two minutes", "3 seconds", "three seconds"],
  "Encourages learners to explain reasoning": ["explain", "reason", "how did you", "because", "justify", "show me", "worked that out"],
  "Includes multiple learners": ["pairs", "pair-share", "groups", "everyone", "all students", "called on", "different", "back row", "reluctant", "walked around", "back"],
  "Follows up on student answers": ["followed up", "probed", "asked again", "built on", "next question", "extended", "follow-up"],
};

function findEvidence(text: string, keywords: string[]): string[] {
  const hits: string[] = [];
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    let idx = lower.indexOf(kw.toLowerCase());
    while (idx !== -1 && hits.length < 3) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + kw.length + 45);
      hits.push(text.slice(start, end).replace(/\s+/g, " ").trim());
      idx = lower.indexOf(kw.toLowerCase(), idx + kw.length);
    }
    if (hits.length >= 3) break;
  }
  return hits;
}

/** Extracts short "observed" quotes so the analysis stays anchored to the teacher's own words. */
function extractObservations(reflection: string, checklist: Record<string, boolean>): string[] {
  const observed: string[] = [];
  for (const [label, checked] of Object.entries(checklist)) {
    observed.push(`${checked ? "✓" : "✗"} (checklist) ${label}`);
    if (observed.length >= 20) break;
  }
  const sentences = reflection.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
  const signalWords = ["i tried", "i asked", "i gave", "i used", "i called", "i did not", "i planned", "students answered", "students said", "i followed", "i probed", "i walked", "i wrote"];
  for (const s of sentences) {
    const low = s.toLowerCase();
    if (signalWords.some((w) => low.includes(w))) observed.push(`"${s.trim()}"`);
    if (observed.length >= 26) break;
  }
  return observed;
}

export function localAnalyzeEvidence(input: AnalyzeEvidenceInput): AnalysisResult {
  const reflection = (input.reflection ?? "").trim();
  const checklist = input.checklist ?? {};
  const keywordsByCriterion = input.keywordsByCriterion ?? DEFAULT_KEYWORDS;
  const criteria = input.criteria?.length
    ? input.criteria
    : Object.keys(keywordsByCriterion);

  const shortReflection = reflection.length < 80;
  const yesNoWords = ["yes or no", "yes/no", "understood", "did everyone understand"];
  const yesNoHeavy = yesNoWords.filter((w) => reflection.toLowerCase().includes(w)).length > 0 && !reflection.toLowerCase().includes("why") && !reflection.toLowerCase().includes("how did");

  const criterionHits = criteria.map((label) => {
    const keywords = keywordsByCriterion[label] ?? [];
    const textHits = findEvidence(reflection, keywords);
    const checklistHit = checklist[label] === true;
    return { label, hit: checklistHit || textHits.length > 0, evidence: checklistHit ? ["(self-checked on submission checklist)"] : textHits };
  });

  const observed = extractObservations(reflection, checklist);
  const hitCount = criterionHits.filter((c) => c.hit).length;

  const interpretation: string[] = [];
  if (shortReflection) interpretation.push("The reflection is brief; treat criterion judgments with extra caution.");
  if (criterionHits.length > 0) {
    interpretation.push(`Self-reported/checklist signals suggest ${hitCount} of ${criterionHits.length} rubric criteria were present in this attempt.`);
  }
  if (yesNoHeavy) interpretation.push("The reflection suggests mostly yes/no style questions were used — a possible implementation gap for open questioning.");
  if (!yesNoHeavy && hitCount >= 3) interpretation.push("Multiple rubric criteria appear present — the technique seems to be taking hold in this attempt.");
  if (hitCount > 0 && hitCount < criterionHits.length) {
    const missed = criterionHits.filter((c) => !c.hit).map((c) => c.label);
    if (missed.length) interpretation.push(`Criteria with no visible evidence in this attempt: ${missed.join("; ")}. This is an observation, not a verdict — the attempt may simply not have mentioned them.`);
  }

  const recommendation: string[] = [];
  if (!criterionHits.find((c) => c.label.toLowerCase().includes("open-ended"))?.hit) {
    recommendation.push("Next attempt: prepare 2–3 written open questions in advance (they are easy to forget mid-lesson).");
  }
  if (!criterionHits.find((c) => c.label.toLowerCase().includes("wait"))?.hit) {
    recommendation.push("Next attempt: practise a deliberate 3-second pause after each question — announce it to students so the silence feels planned.");
  }
  if (!criterionHits.find((c) => c.label.toLowerCase().includes("multiple"))?.hit) {
    recommendation.push("Next attempt: use pair-share so students who rarely answer can respond through their partner first.");
  }
  if (!criterionHits.find((c) => richerFollowUp(c.label))?.hit) {
    recommendation.push(`Next attempt: pick one student answer and ask "how did you work that out?" to surface reasoning.`);
  }
  if (recommendation.length === 0) {
    recommendation.push("Strong attempt against the rubric. Next: repeat the technique in a different lesson type to build toward sustained adoption.");
  }

  const supportFlags: SupportFlag[] = [];
  if (shortReflection) {
    supportFlags.push({ signal: "Brief reflection", detail: "Reflection under 80 characters may be an incomplete-evidence signal.", severity: "watch" });
  }
  if (hitCount === 0) {
    supportFlags.push({ signal: "No rubric criteria evidenced", detail: "No criterion had visible evidence — may indicate no real classroom attempt or an unclear reflection.", severity: "alert" });
  }
  if (input.history) {
    const h: HistorySummary = input.history;
    if (h.priorRetries >= 2) {
      supportFlags.push({ signal: "Repeated retries", detail: `${h.priorRetries} retries recorded for this competency.`, severity: "alert" });
    }
    if (h.priorAttempts >= 1 && h.priorEvidence === 0) {
      supportFlags.push({ signal: "No classroom attempt evidenced", detail: "Prior task(s) exist without any classroom evidence submitted.", severity: "alert" });
    }
  }
  if (input.context && input.context.confidence <= 2) {
    supportFlags.push({ signal: "Low self-reported confidence", detail: `Teacher reported confidence ${input.context.confidence}/5.`, severity: "watch" });
  }

  return {
    observed,
    interpretation,
    recommendation,
    criterionHits,
    supportFlags,
    supportRecommended: supportFlags.some((f) => f.severity === "alert"),
  };
}

const richerFollowUp = (label: string) => /follow|reasoning|explain/i.test(label);

/* ------------------------------------------------------------------ */
/* A5 — Feedback drafting (AI drafts; mentor decides)                  */
/* ------------------------------------------------------------------ */

export function localDraftFeedback(input: FeedbackDraftInput): string {
  const { analysis, teacherName, competencyTitle } = input;
  const strengths = analysis.criterionHits.filter((c) => c.hit).map((c) => c.label);
  const gaps = analysis.criterionHits.filter((c) => !c.hit).map((c) => c.label);
  const shortName = teacherName.split("—")[0].trim() || teacherName;

  return [
    `### What appears to have worked`,
    strengths.length
      ? strengths.map((s) => `- ${s}`).join("\n")
      : `- The attempt was submitted — that itself is the first implementation step. The reflection was too thin to identify specific strengths yet.`,
    ``,
    `### Possible improvement area`,
    gaps.length
      ? gaps.map((g) => `- ${g}: no clear evidence in this attempt.`).join("\n")
      : `- Keep varying the lesson contexts where you use ${competencyTitle}, so it becomes routine rather than a one-off.`,
    ``,
    `### Suggested next attempt`,
    analysis.recommendation.slice(0, 2).map((r) => `- ${r}`).join("\n") || "- Repeat the technique and note which learners answered.",
    ``,
    `_Draft prepared with AI assistance for ${shortName} (${competencyTitle}). AI assists — the mentor reviews, edits and decides._`,
  ].join("\n");
}
