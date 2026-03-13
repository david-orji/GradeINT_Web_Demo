// =============================================================================
// GradeINT — Shared Domain Rules
// Business logic enforced across all apps
// =============================================================================

import type { ExamPackage } from '@gradeint/shared-types';

// --- Exam lifecycle rules ----------------------------------------------------

export type ExamStatus = 'draft' | 'published' | 'archived';

/**
 * An exam can only be published if it has at least one question.
 */
export function canPublishExam(exam: { questions: unknown[] }): boolean {
  return exam.questions.length >= 1;
}

/**
 * A published exam is immutable. No edits are allowed.
 */
export function isExamImmutable(status: ExamStatus): boolean {
  return status === 'published' || status === 'archived';
}

// --- Session activation rules ------------------------------------------------

/**
 * A session can only be activated if the exam is published and the package
 * has been verified (i.e. checksum has been confirmed by caller).
 */
export function canActivateSession(opts: {
  examStatus: ExamStatus;
  packageChecksumVerified: boolean;
  questionCount: number;
}): { allowed: boolean; reason?: string } {
  if (opts.examStatus !== 'published') {
    return { allowed: false, reason: 'Exam must be published before a session can be activated.' };
  }
  if (!opts.packageChecksumVerified) {
    return { allowed: false, reason: 'Exam package checksum could not be verified.' };
  }
  if (opts.questionCount < 1) {
    return { allowed: false, reason: 'Exam package contains no questions.' };
  }
  return { allowed: true };
}

// --- Submission rules --------------------------------------------------------

/**
 * A submission can only be accepted if the session is currently active
 * and the student has not already submitted a final (sealed) answer.
 */
export function canAcceptSubmission(opts: {
  sessionActive: boolean;
  alreadySealed: boolean;
}): { allowed: boolean; reason?: string } {
  if (!opts.sessionActive) {
    return { allowed: false, reason: 'Session is not active.' };
  }
  if (opts.alreadySealed) {
    return { allowed: false, reason: 'Submission already sealed. No further edits allowed.' };
  }
  return { allowed: true };
}

// --- Package duration helpers ------------------------------------------------

/**
 * Calculate how many seconds remain in an exam given the start time and duration.
 * Returns 0 if the exam has already ended.
 */
export function examSecondsRemaining(
  startedAtIso: string,
  durationSeconds: number,
): number {
  const startedAt = new Date(startedAtIso).getTime();
  const endsAt = startedAt + durationSeconds * 1000;
  const remaining = endsAt - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Returns the ISO 8601 end time for an exam.
 */
export function examEndsAt(startedAtIso: string, durationSeconds: number): string {
  const startedAt = new Date(startedAtIso).getTime();
  return new Date(startedAt + durationSeconds * 1000).toISOString();
}
