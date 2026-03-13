// =============================================================================
// GradeINT — Session & Sync State Types
// Tracked on the Local School Exam Server
// =============================================================================

/**
 * Lifecycle of an exam package on the Local School Exam Server.
 *
 * State machine:
 *   downloaded → activated → in_progress → sealed
 *                                             ↓
 *                         pending_sync → syncing → synced
 *                                             ↓
 *                                        sync_failed (retries)
 */
export type ExamSyncState =
  | 'downloaded'    // Package received from cloud; not yet activated
  | 'activated'     // Session started locally; students can now connect
  | 'in_progress'   // At least one student has begun the exam
  | 'sealed'        // Exam time ended; no more submissions accepted
  | 'pending_sync'  // Waiting to upload submissions to cloud
  | 'syncing'       // Upload in flight
  | 'synced'        // Cloud confirmed receipt of all submissions
  | 'sync_failed';  // Upload failed; will retry with backoff

export interface LocalSession {
  sessionId: string;
  examId: string;
  syncState: ExamSyncState;
  activatedAt?: string;           // ISO 8601
  sealedAt?: string;              // ISO 8601
  lastSyncAttemptAt?: string;     // ISO 8601
  lastSyncSuccessAt?: string;     // ISO 8601
  syncAttemptCount: number;
  cloudAcknowledgementId?: string;
}

export interface LocalServerInfo {
  serverName: string;
  ipAddress: string;
  port: number;
  sessionCode: string;            // Short human-readable code, e.g. "EXAM-7842"
  activeSessionId?: string;
}

export interface CandidateSession {
  sessionToken: string;           // JWT issued to student on join
  sessionId: string;
  studentId: string;
  deviceId: string;
  joinedAt: string;               // ISO 8601
  lastSeenAt?: string;            // ISO 8601 — heartbeat timestamp
}
