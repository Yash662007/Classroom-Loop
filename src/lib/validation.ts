import { z } from "zod";

/* ---------------- Auth ---------------- */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

/* ---------------- Teacher context ---------------- */

export const contextSchema = z.object({
  experience_years: z.number().int().min(0).max(45),
  grades_taught: z.array(z.number().int().min(1).max(12)).max(15),
  subjects: z.array(z.string().trim().min(1).max(60)).max(12),
  class_size: z.number().int().min(1).max(200).nullable(),
  multigrade: z.boolean(),
  school_context: z.string().trim().max(300).nullable(),
  challenges: z.array(z.string().trim().min(1).max(120)).max(8),
  confidence: z.number().int().min(1).max(5),
});

/* ---------------- Competency check ---------------- */

export const competencyCheckSchema = z.object({
  competency_id: z.string().min(1),
  answers: z.record(z.string(), z.number().int().min(0).max(2)),
});

/* ---------------- Implementation ---------------- */

export const generateTaskSchema = z.object({
  competency_id: z.string().min(1),
  force_new: z.boolean().optional(),
});

export const practiceSessionSchema = z.object({
  task_id: z.string().min(1),
  chosen_option: z.number().int().min(0).max(9),
  reflection: z.string().trim().max(2000).optional(),
});

export const evidenceSchema = z.object({
  task_id: z.string().min(1),
  reflection: z.string().trim().min(1, "Reflection is required").max(5000),
  voice_note: z.string().max(20000).nullable().optional(),
  checklist: z.record(z.string(), z.boolean()),
  photo_path: z.string().max(500).nullable().optional(),
});

export const retrySchema = z.object({
  competency_id: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

/* ---------------- Mentor ---------------- */

export const feedbackSchema = z.object({
  evidence_id: z.string().min(1),
  message: z.string().trim().min(1, "Feedback message is required").max(8000),
  action: z.enum(["save_draft", "approve_send"]),
  edited_by_mentor: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ContextInput = z.infer<typeof contextSchema>;
export type EvidenceInput = z.infer<typeof evidenceSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
