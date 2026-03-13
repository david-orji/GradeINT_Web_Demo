// =============================================================================
// GradeINT — Exam Package Types
// Downloaded from cloud → Local School Exam Server
// =============================================================================

export interface ExamPackage {
  // Identity
  examId: string;           // UUID
  packageVersion: string;   // semver e.g. "1.0.0"
  checksum: string;         // SHA-256 of canonical JSON (excluding this field)
  generatedAt: string;      // ISO 8601

  // Content
  title: string;
  instructions: string;
  duration: number;         // seconds

  questions: Question[];

  // Session metadata
  sessionMetadata: SessionMetadata;

  // Activation config
  activationConfig: ActivationConfig;
}

export interface Question {
  questionId: string;       // UUID
  order: number;
  type: QuestionType;
  text: string;
  richText?: string;        // HTML/Markdown (optional, for future rich content)
  options?: Option[];       // mcq / multi-select only
  points: number;
  required: boolean;
}

export type QuestionType = 'mcq' | 'multi-select' | 'short-answer' | 'essay';

export interface Option {
  optionId: string;         // UUID
  order: number;
  text: string;
}

export interface SessionMetadata {
  sessionId: string;
  scheduledStartAt: string;         // ISO 8601
  scheduledEndAt: string;           // ISO 8601
  allowedCandidateIds: string[];    // empty array = open session
  maxAttempts: number;              // always 1 for MVP
}

export interface ActivationConfig {
  requireLocalAuth: boolean;
  autoSealOnTimerExpiry: boolean;
  autosaveIntervalSeconds: number;
}
