// =============================================================================
// GradeINT — Submission Envelope Types
// Sent: Student Client → Local Server → Cloud
// =============================================================================

export type SubmissionState =
  | 'in_progress'     // student is actively writing
  | 'autosaved'       // last periodic autosave confirmed
  | 'submitted'       // student pressed submit
  | 'sealed'          // local server sealed the submission
  | 'receipt_issued'; // student received confirmation receipt

export interface Answer {
  questionId: string;
  selectedOptionIds?: string[];   // mcq / multi-select
  textAnswer?: string;            // short-answer / essay
  lastModifiedAt: string;         // ISO 8601
}

export interface SubmissionEnvelope {
  // Identity
  submissionId: string;         // UUID, issued by local server on first autosave
  sessionId: string;
  examId: string;
  studentId: string;
  deviceId: string;             // stable device fingerprint

  // Auth
  sessionToken: string;         // JWT issued by local server on candidate auth

  // Answers
  answers: Answer[];

  // State
  submissionState: SubmissionState;
  attemptNumber: number;        // always 1 for MVP

  // Timestamps (all ISO 8601)
  examStartedAt: string;
  lastAutosavedAt: string;
  submittedAt?: string;         // set only on final submission

  // Integrity
  checksum: string;             // SHA-256 of answers + timestamps (excluding this field)
}

export interface SubmissionReceipt {
  submissionId: string;
  studentId: string;
  sessionId: string;
  sealedAt: string;             // ISO 8601
  receiptToken: string;         // opaque confirmation token
}
