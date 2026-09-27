"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";

export function GenerateTaskButton({ competencyId, label = "Generate my personalized task" }: { competencyId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needs, setNeeds] = useState<null | "context" | "check">(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setNeeds(null);
    try {
      await apiFetch("/api/implementation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competency_id: competencyId, force_new: false }),
      });
      router.push("/teacher/task");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("context")) setNeeds("context");
      else if (msg.includes("check")) setNeeds("check");
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={generate} disabled={busy} className="btn-teal">
        {busy ? "Personalizing with AI…" : label}
      </button>
      {needs === "context" && (
        <p role="alert" className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Your teaching context is needed for personalization. <Link className="underline font-semibold" href="/teacher/context">Complete your context →</Link>
        </p>
      )}
      {needs === "check" && (
        <p role="alert" className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Complete the competency check first. <Link className="underline font-semibold" href="/teacher/competencies">Go to competencies →</Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
