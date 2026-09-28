import { describe, expect, it } from "vitest";
import { buildReportCsv, buildReportSections } from "@/lib/reports";
import type {
  AdoptionDistribution,
  FunnelResponse,
  ImplementationMetrics,
  InterventionTeacher,
} from "@/lib/analytics";

const funnel: FunnelResponse[] = [
  { stage: "trained", label: "Training completed", count: 10, ofTeachers: 100 },
  { stage: "evidence", label: "Evidence submitted", count: 7, ofTeachers: 70 },
  { stage: "sustained", label: "Sustained adoption", count: 0, ofTeachers: 0 },
];

const metrics: ImplementationMetrics = {
  tasksGenerated: 12,
  practiceSessions: 9,
  evidenceSubmitted: 7,
  aiAnalyses: 7,
  analysesBySource: { local_engine: 6, llm: 1 },
  feedbackDrafted: 7,
  feedbackSent: 5,
  retriesStarted: 3,
  avgTimeToFirstAttemptHours: 4.2,
  avgFeedbackTurnaroundHours: null,
  supportFlaggedAnalyses: 2,
};

const adoption: AdoptionDistribution = {
  byStage: [
    { stage: "not_started", teachers: 1 },
    { stage: "feedback_received", teachers: 2 },
    { stage: "sustained", teachers: 1 },
  ],
  byCompetency: [],
  sustainedTeachers: 1,
};

const intervention: InterventionTeacher[] = [
  {
    id: "t1",
    name: 'Priya, "Coach" S',
    signals: ['2 evidence submission(s) awaiting mentor review', "=HYPERLINK(\"http://evil\")"],
    adoptionStage: "feedback_received",
    attempts: 2,
    evidencePending: 2,
  },
];

describe("buildReportSections", () => {
  const sections = buildReportSections(funnel, metrics, adoption, intervention);

  it("builds the four report sections", () => {
    expect(sections.map((s) => s.title)).toEqual([
      "Training → practice funnel",
      "Adoption distribution (highest stage reached)",
      "Implementation & turnaround",
      "Support signals (triage — not a ranking)",
    ]);
  });

  it("computes step drop-off, with null for the first stage", () => {
    const rows = sections[0].rows;
    expect(rows[0][3]).toBeNull(); // no previous stage
    expect(rows[1][3]).toBe("30%"); // 10 -> 7
    expect(rows[2][3]).toBe("100%"); // 7 -> 0
  });

  it("renders adoption stages with human labels", () => {
    const rows = sections[1].rows;
    expect(rows).toContainEqual(["Not started", 1]);
    expect(rows).toContainEqual(["Sustained", 1]);
  });

  it("shows an em dash for missing turnaround metrics and splits the AI source", () => {
    const rows = sections[2].rows;
    expect(rows).toContainEqual(["Avg feedback turnaround (hours)", "—"]);
    expect(rows).toContainEqual(["— via LLM", 1]);
    expect(rows).toContainEqual(["— via deterministic rubric engine", 6]);
  });

  it("produces zero rows for the support section when there are no signals", () => {
    const empty = buildReportSections(funnel, metrics, adoption, []);
    expect(empty[3].rows).toHaveLength(0);
  });
});

describe("buildReportCsv", () => {
  const csv = buildReportCsv({
    generatedAt: "2026-09-29T10:00:00.000Z",
    sections: buildReportSections(funnel, metrics, adoption, intervention),
  });

  it("starts with a BOM and uses CRLF row endings", () => {
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.includes("Generated,2026-09-29T10:00:00.000Z\r\n")).toBe(true);
  });

  it("writes quoted headers and drop-off values", () => {
    expect(csv.includes("Stage,Teachers,% of teachers,Step drop-off\r\n")).toBe(true);
    expect(csv.includes("Evidence submitted,7,70%,30%\r\n")).toBe(true);
  });

  it("escapes quotes and commas per RFC 4180", () => {
    expect(csv.includes('"Priya, ""Coach"" S"')).toBe(true);
    // Signals are joined into one cell; embedded quotes force full quoting.
    expect(csv.includes('"2 evidence submission(s) awaiting mentor review; ')).toBe(true);
  });

  it("neutralizes spreadsheet formula injection at cell start", () => {
    const hostile = buildReportCsv({
      generatedAt: "2026-09-29T10:00:00.000Z",
      sections: buildReportSections(funnel, metrics, adoption, [
        { ...intervention[0], name: "=SUM(A1:A2)", signals: ["-2+3+calc"] },
      ]),
    });
    expect(hostile.includes("'=SUM(A1:A2)")).toBe(true);
    expect(hostile.includes("'-2+3+calc")).toBe(true);
  });

  it("keeps the support header even with no rows", () => {
    const emptyCsv = buildReportCsv({
      generatedAt: "2026-09-29T10:00:00.000Z",
      sections: buildReportSections(funnel, metrics, adoption, []),
    });
    expect(emptyCsv.includes("Teacher,Signals,Adoption stage,Evidence awaiting review\r\n")).toBe(true);
  });
});
