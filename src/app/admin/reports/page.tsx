"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { CohortReport } from "@/lib/reports";

export default function ReportsPage() {
  const [report, setReport] = useState<CohortReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CohortReport>("/api/admin/reports")
      .then(setReport)
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!report) return <div className="card animate-pulse text-sm text-navy-900/50">Loading report…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Cohort report</h1>
          <p className="text-sm text-navy-900/60">
            Printable summary of the full adoption pipeline. Generated {new Date(report.generatedAt).toLocaleString()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-amber">Demo data — simulated records</span>
          <a href="/api/admin/reports?format=csv" download className="btn-secondary">Download CSV</a>
          <button type="button" onClick={() => window.print()} className="btn-primary">Print</button>
        </div>
      </div>

      {report.sections.map((section) => (
        <section key={section.title} className="card">
          <h2 className="label">{section.title}</h2>
          {section.rows.length === 0 ? (
            <p className="text-sm text-navy-900/55">No records for this section yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    {section.columns.map((c) => (
                      <th key={c} scope="col" className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-medium text-navy-900" : "text-navy-900/75"}`}>
                          {cell ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section.title.startsWith("Support signals") && (
            <p className="text-[11px] text-navy-900/40 mt-3">Signals for triage only — this is not a teacher ranking and never will be.</p>
          )}
        </section>
      ))}
    </div>
  );
}
