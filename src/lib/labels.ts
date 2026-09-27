import { ADOPTION_STAGES } from "@/db/schema";

/** Single source of truth for adoption-stage display labels (all roles). */
export const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  ADOPTION_STAGES.map((s) => [
    s,
    {
      not_started: "Not started",
      practised: "Practised",
      attempted: "Attempted",
      evidence_submitted: "Evidence submitted",
      feedback_received: "Feedback received",
      retried: "Retried",
      repeated: "Repeated",
      sustained: "Sustained",
    }[s],
  ])
);
