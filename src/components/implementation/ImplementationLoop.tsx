import Link from "next/link";

export interface LoopStep {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "attention";
  detail?: string;
  href?: string;
}

const STATE_STYLES: Record<LoopStep["state"], { dot: string; text: string; ring: string }> = {
  done: { dot: "bg-teal-600 text-white", text: "text-navy-900", ring: "ring-teal-600/30" },
  current: { dot: "bg-primary-600 text-white", text: "text-navy-900 font-bold", ring: "ring-4 ring-softblue-200" },
  upcoming: { dot: "bg-softblue-100 text-navy-900/50", text: "text-navy-900/50", ring: "" },
  attention: { dot: "bg-warning text-white", text: "text-amber-700 font-semibold", ring: "ring-warning/30" },
};

/**
 * The implementation loop (spec §12): the single visual contract of the
 * product — Train → Practise → Apply → Evidence → AI Insight → Mentor →
 * Retry → Adopt. Reused across dashboard, task and history screens.
 */
export function ImplementationLoop({ steps, compact = false }: { steps: LoopStep[]; compact?: boolean }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-y-3" aria-label="Implementation loop progress">
      {steps.map((s, i) => {
        const st = STATE_STYLES[s.state];
        const content = (
          <span className={`flex items-center gap-2 rounded-lg px-2 py-1 ring-2 ring-transparent ${st.ring} ${s.href ? "hover:bg-softblue-50 transition-colors" : ""}`}>
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${st.dot}`}
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <span className="flex flex-col leading-tight">
              <span className={`text-xs uppercase tracking-wide ${st.text}`}>{s.label}</span>
              {s.detail && !compact && <span className="text-[11px] text-slate-500">{s.detail}</span>}
            </span>
          </span>
        );
        return (
          <li key={s.key} className="flex items-center">
            {s.href ? <Link href={s.href}>{content}</Link> : content}
            {i < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-4 bg-slate-300 sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
}
