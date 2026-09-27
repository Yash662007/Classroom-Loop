import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, HeartHandshake } from "lucide-react";
import { verifySessionToken } from "@/lib/jwt";
import { getTeacherDashboard, getImplementationHistory, listSentFeedback } from "@/lib/teacher-loop";
import { ImplementationLoop } from "@/components/implementation/ImplementationLoop";
import type { LoopStep } from "@/components/implementation/ImplementationLoop";
import { ImplementationActionCard } from "@/components/implementation/ImplementationActionCard";
import { ImplementationTimeline } from "@/components/implementation/ImplementationTimeline";
import type { TimelineEvent } from "@/components/implementation/ImplementationTimeline";
import { PageHeader } from "@/components/layout/PageHeader";
import { ADOPTION_STAGES } from "@/db/schema";
import { STAGE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

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
  const recentFeedback = data.focus ? listSentFeedback(session!.id, data.focus.id) : [];

  // Journey timeline from the persisted implementation history.
  const timeline: TimelineEvent[] = [];
  if (data.focus) {
    const history = getImplementationHistory(session!.id);
    const entry = history.find((h) => h.competency.id === data.focus!.id);
    if (entry) {
      for (const a of entry.attempts) {
        if (a.attemptNumber > 1) {
          timeline.push({ at: a.createdAt, label: `Retry — attempt ${a.attemptNumber}`, kind: "retry", done: true });
        }
        if (a.practice) {
          timeline.push({ at: a.practice.completed_at, label: `Practice completed (attempt ${a.attemptNumber})`, kind: "practice", done: true });
        }
        for (const e of a.evidence) {
          timeline.push({ at: e.submittedAt, label: `Evidence submitted (attempt ${a.attemptNumber})`, kind: "evidence", done: true });
          if (e.analysis) {
            timeline.push({
              at: e.analysis.generatedAt,
              label: "AI insight generated",
              detail: `${e.analysis.criterionHits.filter((c) => c.hit).length}/${e.analysis.criterionHits.length} rubric criteria evidenced`,
              kind: "ai",
              done: true,
            });
          }
          if (e.feedback?.sentAt) {
            timeline.push({ at: e.feedback.sentAt, label: "Mentor feedback received", kind: "mentor", done: true });
          }
        }
      }
    }
    timeline.sort((a, b) => a.at.localeCompare(b.at));
  }

  const contextLine = data.context
    ? `Grade ${data.context.grades_taught[0] ?? "?"}${data.context.grades_taught.length > 1 ? "–" + data.context.grades_taught[data.context.grades_taught.length - 1] : ""} · ${data.context.multigrade ? "Multi-grade" : "Single-grade"}${data.context.class_size ? ` · ${data.context.class_size} learners` : ""}`
    : null;

  const currentObjective = data.currentTask
    ? data.currentTask.activity.split("\n").slice(0, 2).join("\n")
    : data.focus
      ? `Complete the competency check for ${data.focus.title}, then generate your personalized classroom action.`
      : "No competencies assigned yet.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your next classroom step"
        subtitle={data.focus ? <>Focus competency: <span className="font-semibold text-navy-900">{data.focus.title}</span></> : "No focus competency yet"}
        actions={<Link href="/teacher/competencies" className="btn-secondary">Training &amp; competencies</Link>}
      />

      {/* §11: the primary object is the next action, not an LMS homepage. */}
      <ImplementationActionCard
        competency={data.focus?.title ?? "Classroom Loop"}
        contextLine={contextLine}
        objective={currentObjective}
        why={data.currentTask?.reasoning ?? null}
        estimatedMinutes={10}
        ctaLabel={data.currentTask ? "Continue this attempt" : data.focus?.check ? "Start a new attempt" : "Take the check"}
        ctaHref={data.currentTask || data.focus?.check ? "/teacher/task" : "/teacher/competencies"}
        statusBadge={data.currentTask ? `Attempt ${data.currentTask.attempt_number} · ${data.currentTask.status}` : undefined}
      />

      <div className="card">
        <h2 className="label">Implementation journey</h2>
        <ImplementationLoop steps={steps} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="label">Adoption progress</h2>
          <p className="text-sm text-navy-900/70 mb-3">
            Stage: <span className="font-bold text-navy-900">{STAGE_LABEL[data.adoption?.stage ?? "not_started"]}</span>
            {data.sustained && <span className="badge-teal ml-2">Sustained</span>}
          </p>
          <ol className="space-y-1.5">
            {ADOPTION_STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${i <= adoptionIndex ? "bg-teal-600" : "bg-softblue-200"}`} aria-hidden />
                <span className={i <= adoptionIndex ? "text-navy-900" : "text-navy-900/50"}>{STAGE_LABEL[s]}</span>
                {i === adoptionIndex && <span className="text-[11px] font-semibold text-teal-600 uppercase">← current</span>}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-slate-400 mt-3">
            Configurable progression (sample definition — not a universal standard).
          </p>
        </div>

        <div className="card">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            <HeartHandshake className="h-3.5 w-3.5" aria-hidden /> Recent mentor feedback
          </h2>
          {recentFeedback.length === 0 ? (
            <p className="text-sm text-slate-500">
              No mentor feedback yet. It appears here after your mentor reviews your evidence.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentFeedback.slice(0, 2).map((f) => (
                <li key={f.evidenceId} className="border-l-2 border-teal-600 pl-3">
                  <p className="text-xs text-slate-500 mb-0.5">
                    Attempt {f.attemptNumber} · {new Date(f.sentAt).toLocaleDateString()}
                    {f.editedByMentor ? " · reviewed & edited by your mentor" : ""}
                  </p>
                  <p className="text-sm text-navy-900/85 line-clamp-3 whitespace-pre-line">{f.message}</p>
                  <Link href={`/teacher/evidence/${f.evidenceId}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                    View full insight <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/teacher/history" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
            All feedback &amp; history <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="card">
          <h2 className="label">Recent journey</h2>
          <ImplementationTimeline events={timeline.slice(-8)} />
        </div>
      )}

      <div className="card bg-softblue-50/60">
        <p className="text-xs text-navy-900/60">
          <strong>Sample/demo environment:</strong> all persons and records in this workspace are simulated.
          Mentor feedback arrives in the mentor review step of the demo journey.
        </p>
      </div>
    </div>
  );
}
