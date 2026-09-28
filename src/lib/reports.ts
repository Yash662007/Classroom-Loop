/**
 * Admin Reports — printable cohort summary + CSV export.
 * Pure domain module: analytics aggregates in, presentation rows out. Kept
 * DB-free so the API route, the page and the unit tests share one definition.
 */
import type {
  AdoptionDistribution,
  FunnelResponse,
  ImplementationMetrics,
  InterventionTeacher,
} from "@/lib/analytics";
import type { LlmUsageSummary, StageDropOff } from "@/lib/analytics";
import { STAGE_LABEL } from "@/lib/labels";

export type ReportCell = string | number | null | undefined;

export interface ReportSection {
  title: string;
  columns: string[];
  rows: ReportCell[][];
}

export interface CohortReport {
  generatedAt: string;
  sections: ReportSection[];
}

export function buildReportSections(
  funnel: FunnelResponse[],
  metrics: ImplementationMetrics & {
    funnelDropOff?: StageDropOff[];
    llmUsage?: LlmUsageSummary;
  },
  adoption: AdoptionDistribution,
  intervention: InterventionTeacher[]
): ReportSection[] {
  // Step drop-off: share of the previous stage that did not advance.
  // Null for the first stage (no previous step) and when the previous stage is 0.
  const funnelRows: ReportCell[][] = funnel.map((f, i) => {
    const prev = i > 0 ? funnel[i - 1].count : null;
    const dropOff = prev !== null && prev > 0 ? Math.round((1 - f.count / prev) * 100) : null;
    return [f.label, f.count, `${f.ofTeachers}%`, dropOff !== null ? `${dropOff}%` : null];
  });

  const metricRows: ReportCell[][] = [
    ["Tasks generated", metrics.tasksGenerated],
    ["Practice sessions (AI scenario)", metrics.practiceSessions],
    ["Evidence submissions", metrics.evidenceSubmitted],
    ["AI analyses", metrics.aiAnalyses],
    ["— via deterministic rubric engine", metrics.analysesBySource.local_engine],
    ["— via LLM", metrics.analysesBySource.llm],
    ["Feedback drafted", metrics.feedbackDrafted],
    ["Feedback sent", metrics.feedbackSent],
    ["Retries started", metrics.retriesStarted],
    ["Avg time to first attempt (hours)", metrics.avgTimeToFirstAttemptHours ?? "—"],
    ["Avg feedback turnaround (hours)", metrics.avgFeedbackTurnaroundHours ?? "—"],
    ["Support-flagged analyses", metrics.supportFlaggedAnalyses],
  ];

  return [
    {
      title: "Training → practice funnel",
      columns: ["Stage", "Teachers", "% of teachers", "Step drop-off"],
      rows: funnelRows,
    },
    {
      title: "Adoption distribution (highest stage reached)",
      columns: ["Stage", "Teachers"],
      rows: adoption.byStage.map((s) => [STAGE_LABEL[s.stage] ?? s.stage, s.teachers]),
    },
    {
      title: "Implementation & turnaround",
      columns: ["Metric", "Value"],
      rows: metricRows,
    },
    {
      title: "Support signals (triage — not a ranking)",
      columns: ["Teacher", "Signals", "Adoption stage", "Evidence awaiting review"],
      rows: intervention.map((t) => [
        t.name,
        t.signals.join("; "),
        STAGE_LABEL[t.adoptionStage] ?? t.adoptionStage,
        t.evidencePending,
      ]),
    },
    ...(metrics.llmUsage && metrics.llmUsage.totalCalls > 0
      ? [
          {
            title: "LLM usage (metered)",
            columns: ["Artifact", "Calls", "Total tokens"],
            rows: metrics.llmUsage.byArtifact.map((a: { artifactKind: string; calls: number; totalTokens: number }) => [
              a.artifactKind,
              a.calls,
              a.totalTokens,
            ]),
          },
        ]
      : []),
  ];
}

/** Escapes one CSV cell per RFC 4180 and neutralizes spreadsheet formula injection. */
export function csvCell(value: ReportCell): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : value;
  // Formulas opening with = + @ - would execute in Excel/Sheets; prefix them.
  if (/^[=+@-]/.test(s)) s = `'${s}`;
  if (/["\r\n,]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serializes the report to RFC 4180 CSV: CRLF rows, quoted cells, BOM for Excel. */
export function buildReportCsv(report: CohortReport): string {
  const lines: string[] = ["\uFEFFClassroom Loop — cohort report"];
  lines.push(`Generated,${csvCell(report.generatedAt)}`);
  for (const section of report.sections) {
    lines.push("");
    lines.push(csvCell(section.title));
    lines.push(section.columns.map(csvCell).join(","));
    for (const row of section.rows) lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
