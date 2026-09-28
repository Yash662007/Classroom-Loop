/**
 * Shared support-request constants (Master Task GOAL 31).
 * Kept free of any DB imports so both server and client modules can use them.
 */
export const SUPPORT_REASONS = [
  "dont_understand",
  "cant_practise",
  "tried_need_help",
  "need_mentor",
  "something_else",
] as const;

export type SupportReason = (typeof SUPPORT_REASONS)[number];

export const SUPPORT_REASON_LABELS: Record<SupportReason, string> = {
  dont_understand: "I don't understand the technique",
  cant_practise: "I can't practise it",
  tried_need_help: "I tried it in class and need help",
  need_mentor: "I need mentor support",
  something_else: "Something else",
};
