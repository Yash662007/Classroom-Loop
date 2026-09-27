import Link from "next/link";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/jwt";
import { getTeacherDashboard } from "@/lib/teacher-loop";
import { LoopStepper } from "@/components/LoopStepper";
import type { LoopStep } from "@/components/LoopStepper";
import { ADOPTION_STAGES } from "@/db/schema";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  not_started: "Not started",
  practised: "Practised",
  attempted: "Attempted",
  evidence_submitted: "Evidence submitted",
  feedback_received: "Feedback received",
  retried: "Retried",
  repeated: "Repeated",
  sustained: "Sustained",
};

export default async function TeacherDashboardPage() {
  const session = await verifySessionToken((await cookies()).get("cl_session")?.value ?? "");
  const data = getTeacherDashboard(session!.id);

  const steps: LoopStep[] = data.steps.map((s) => ({
    ...s,
    href:
      s.key === "check" ? "/teacher/competencies"
      : s.key === "context" ? "/teacher/context"
      : s.key === "task" || s.key === "practice" || s.key === "evidence" ? "/teacher/task"
      : s.key === "feedback" || s.key === "retry" ? "/teacher/history"
      : undefined,
  }));

  const adoptionIndex = data.adoption ? ADOPTION_STAGES.indexOf(data.adoption.stage) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">My implementation loop</h1>
          <p className="text-sm text-navy-900/60">
            Focus competency: <span className="font-semibold">{data.focus?.title ?? "—"}</span>
            {data.context && <span className="ml-2 badge-teal">Context on file</span>}
          </p>
        </div>
        <Link href="/teacher/competencies" className="btn-secondary">Competencies &amp; training →</Link>
      </div>

      <div className="card">
        <LoopStepper steps={steps} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-900/60 mb-3">Current attempt</h2>
          {data.currentTask ? (
            <>
              <p className="font-semibold text-navy-900 mb-1">{data.currentTask.title}</p>
              <p className="text-sm text-navy-900/70 mb-3 line-clamp-3">{data.currentTask.activity.split("\n")[0]}</p>
              <div className="flex items-center gap-2 mb-4">
                <span className="badge-neutral">Attempt {data.currentTask.attempt_number}</span>
                <span className="badge-neutral">{data.currentTask.difficulty}</span>
                <span className="badge-teal">AI-personalized</span>
              </div>
              <Link href="/teacher/task" className="btn-primary">Continue →</Link>
            </>
          ) : data.focus ? (
            <>
              <p className="text-sm text-navy-900/70 mb-3">
                No active attempt right now. {data.focus.check ? "Start a new personalized task when you're ready." : "Complete the competency check to unlock your first task."}
              </p>
              {data.focus.check ? (
                <Link href="/teacher/competencies" className="btn-primary">Start a task →</Link>
              ) : (
                <Link href="/teacher/competencies" className="btn-primary">Take the check →</Link>
              )}
            </>
          ) : (
            <p className="text-sm text-navy-900/70">No competencies assigned yet.</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-900/60 mb-3">Adoption progress</h2>
          <p className="text-sm text-navy-900/70 mb-3">
            Stage: <span className="font-bold text-navy-900">{STAGE_LABEL[data.adoption?.stage ?? "not_started"]}</span>
            {data.sustained && <span className="badge-teal ml-2">Sustained</span>}
          </p>
          <ol className="space-y-1.5">
            {ADOPTION_STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${i <= adoptionIndex ? "bg-teal-500" : "bg-softblue-200"}`} aria-hidden />
                <span className={i <= adoptionIndex ? "text-navy-900" : "text-navy-900/50"}>{STAGE_LABEL[s]}</span>
                {i === adoptionIndex && <span className="text-[11px] font-semibold text-teal-600 uppercase">← current</span>}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-navy-900/40 mt-3">
            Configurable progression (sample definition — not a universal standard).
          </p>
        </div>
      </div>

      <div className="card bg-softblue-50/60">
        <p className="text-xs text-navy-900/60">
          <strong>Sample/demo environment:</strong> all persons and records in this workspace are simulated.
          Mentor feedback arrives in the mentor review step of the demo journey.
        </p>
      </div>
    </div>
  );
}
