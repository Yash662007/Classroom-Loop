import { Sparkles } from "lucide-react";

/**
 * Implementation timeline (spec §19): the journey as a chronological story —
 * what happened, when, and what came next.
 */
export interface TimelineEvent {
  at: string;
  label: string;
  detail?: string;
  kind: "practice" | "attempt" | "evidence" | "ai" | "mentor" | "retry" | "adoption";
  done: boolean;
}

const KIND_STYLE: Record<TimelineEvent["kind"], { dot: string; marker: string }> = {
  practice: { dot: "bg-teal-600", marker: "✓" },
  attempt: { dot: "bg-teal-600", marker: "✓" },
  evidence: { dot: "bg-teal-600", marker: "✓" },
  ai: { dot: "bg-primary-600", marker: "✦" },
  mentor: { dot: "bg-teal-600", marker: "✓" },
  retry: { dot: "bg-primary-600", marker: "→" },
  adoption: { dot: "bg-teal-600", marker: "✓" },
};

export function ImplementationTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No journey events yet — they appear here as you progress.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5" aria-label="Implementation history timeline">
      {events.map((e, i) => {
        const style = KIND_STYLE[e.kind];
        return (
          <li key={i} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${e.done ? style.dot : "bg-softblue-100 text-navy-900/50"}`}
            >
              {e.done ? style.marker : "○"}
            </span>
            <p className="text-xs text-slate-500">{new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
            <p className={`text-sm ${e.done ? "text-navy-900" : "text-navy-900/50"}`}>
              {e.kind === "ai" && <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary-600" aria-hidden />}
              {e.label}
            </p>
            {e.detail && <p className="text-xs text-slate-500">{e.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}
