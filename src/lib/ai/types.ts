/** Shared contracts for AI capabilities. Implementations: local engine + LLM. */

export interface TeacherContextData {
  experience_years: number;
  grades_taught: number[];
  subjects: string[];
  class_size: number | null;
  multigrade: boolean;
  school_context: string | null;
  challenges: string[];
  /** Self-reported confidence, 1 (low) .. 5 (high). */
  confidence: number;
}

export interface HistorySummary {
  priorAttempts: number;
  priorEvidence: number;
  priorFeedback: number;
  priorRetries: number;
}

export interface PersonalizationInput {
  teacherName: string;
  competencyId: string;
  competencyTitle: string;
  competencyDescription?: string;
  /** Score from the competency check (0..scale), null if not checked. */
  checkScore: number | null;
  checkScale?: number;
  context: TeacherContextData;
  history: HistorySummary;
}

export type Difficulty = "starter" | "core" | "stretch";

export interface PersonalizationOutput {
  title: string;
  activity: string;
  difficulty: Difficulty;
  microLearning: string[];
  support: string | null;
  reasoning: string;
  personalizationFactors: string[];
}

export interface PracticeScenarioInput {
  competencyTitle: string;
  competencyDescription?: string;
  context: TeacherContextData;
}

export interface PracticeScenarioOutput {
  scenario: string;
  choices: string[];
  recommendedChoice: number;
}

export interface CriterionHit {
  label: string;
  hit: boolean;
  /** Phrases in the teacher's own words that support the judgment. */
  evidence: string[];
}

export type SupportSeverity = "info" | "watch" | "alert";

export interface SupportFlag {
  signal: string;
  detail: string;
  severity: SupportSeverity;
}

export interface AnalysisResult {
  /** What the evidence literally shows (teacher's own words / checklist). */
  observed: string[];
  /** AI interpretation — explicitly NOT established fact. */
  interpretation: string[];
  /** Suggested next action — for the mentor and teacher to decide on. */
  recommendation: string[];
  criterionHits: CriterionHit[];
  supportFlags: SupportFlag[];
  supportRecommended: boolean;
}

export interface AnalyzeEvidenceInput {
  reflection: string;
  checklist: Record<string, boolean>;
  voiceNote: string | null;
  /** Rubric criteria labels for the competency. */
  criteria: string[];
  /** Keywords per criterion used by the local engine (optional for LLM path). */
  keywordsByCriterion?: Record<string, string[]>;
  context?: TeacherContextData | null;
  history?: HistorySummary | null;
}

export interface FeedbackDraftInput {
  analysis: AnalysisResult;
  teacherName: string;
  competencyTitle: string;
}

export type AiSource = "local_engine" | "llm";
