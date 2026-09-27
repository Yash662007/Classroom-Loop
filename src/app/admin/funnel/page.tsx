"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { FunnelBars } from "@/components/analytics/FunnelBars";

interface FunnelItem { stage: string; label: string; count: number; ofTeachers: number }

export default function FunnelPage() {
  const [funnel, setFunnel] = useState<FunnelItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ funnel: FunnelItem[] }>("/api/analytics/funnel")
      .then((d) => setFunnel(d.funnel))
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <div role="alert" className="card text-red-700 bg-red-50 border-red-200">{error}</div>;
  if (!funnel) return <div className="card animate-pulse text-sm text-navy-900/50">Loading funnel…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Training-to-practice funnel</h1>
          <p className="text-sm text-navy-900/60">
            Where teachers are on the journey from training completion to sustained classroom implementation.
          </p>
        </div>
        <span className="badge-amber">Demo data — simulated records</span>
      </div>

      <div className="card">
        <FunnelBars funnel={funnel} />
      </div>

      <div className="card">
        <h2 className="label">Stage-by-stage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-navy-900/50">
                <th className="py-2 pr-4">Stage</th>
                <th className="py-2 pr-4">Teachers reached</th>
                <th className="py-2">% of teachers</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((f) => (
                <tr key={f.stage} className="border-t border-navy-900/10">
                  <td className="py-2.5 pr-4 font-medium">{f.label}</td>
                  <td className="py-2.5 pr-4">{f.count}</td>
                  <td className="py-2.5">{f.ofTeachers}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-navy-900/40 mt-3">
          Demo environment with simulated records — these numbers are illustrative, not real-world statistics.
        </p>
      </div>
    </div>
  );
}
