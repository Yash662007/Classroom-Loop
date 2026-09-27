"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { STAGE_LABEL } from "@/lib/labels";

interface Adoption {
  byStage: Array<{ stage: string; teachers: number }>;
  byCompetency: Array<{ competencyId: string; title: string; topStage: string; teachersAtTopStage: number; totalAttempts: number }>;
  sustainedTeachers: number;
}

const STAGE_ORDER = Object.keys(STAGE_LABEL);

export default function AdoptionPage() {
  const [data, setData] = useState<Adoption | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Adoption>("/api/analytics/adoption").then(setData).catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!data) return <div className="card animate-pulse text-sm text-navy-900/50">Loading adoption data…</div>;

  const max = Math.max(...data.byStage.map((s) => s.teachers), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Competency adoption</h1>
          <p className="text-sm text-navy-900/60">
            Highest adoption stage reached per teacher. Adoption = repeated classroom implementation, not task completion.
          </p>
        </div>
        <span className="badge-amber">Demo data — simulated records</span>
      </div>

      <div className="card">
        <h2 className="label">Teachers by highest stage reached</h2>
        <ol className="space-y-2">
          {data.byStage.map((s) => (
            <li key={s.stage} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs text-navy-900/70">{STAGE_LABEL[s.stage]}</span>
              <div className="flex-1 h-5 bg-softblue-100 rounded-md overflow-hidden">
                <div className={`h-full rounded-md ${s.stage === "sustained" ? "bg-teal-600" : "bg-navy-800"}`}
                  style={{ width: `${Math.max((s.teachers / max) * 100, s.teachers > 0 ? 4 : 0)}%` }} />
              </div>
              <span className="w-10 text-right text-xs font-semibold text-navy-900">{s.teachers}</span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-navy-900/40 mt-3">
          Stage definitions are configurable (sample definition shown) — this is not a universal scientific standard.
        </p>
      </div>

      <div className="card">
        <h2 className="label">By competency</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy-900/50">
                <th className="py-2 pr-4">Competency</th>
                <th className="py-2 pr-4">Highest stage reached</th>
                <th className="py-2 pr-4">Teachers at that stage</th>
                <th className="py-2">Total attempts</th>
              </tr>
            </thead>
            <tbody>
              {data.byCompetency.map((c) => (
                <tr key={c.competencyId} className="border-t border-navy-900/10">
                  <td className="py-2.5 pr-4 font-medium">{c.title}</td>
                  <td className="py-2.5 pr-4">{STAGE_LABEL[c.topStage] ?? c.topStage}</td>
                  <td className="py-2.5 pr-4">{c.teachersAtTopStage}</td>
                  <td className="py-2.5">{c.totalAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-navy-900/60 mt-3">
          Teachers at sustained adoption: <strong>{data.sustainedTeachers}</strong>
        </p>
      </div>
    </div>
  );
}
