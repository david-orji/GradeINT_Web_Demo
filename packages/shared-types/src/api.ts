// =============================================================================
// GradeINT — API Contract Types
// =============================================================================

// --- Cloud API (Local Server ↔ Cloud) ---------------------------------------

export interface CloudAuthRequest {
  schoolId: string;
  apiKey: string;
}

export interface CloudAuthResponse {
  token: string;                // JWT scoped to this school
  expiresAt: string;            // ISO 8601
}

export interface PackageFetchRequest {
  sessionId: string;
}

export interface SyncSubmissionsRequest {
  sessionId: string;
  examId: string;
  submissions: import('./submission.js').SubmissionEnvelope[];
  sealedAt: string;             // ISO 8601
}

export interface SyncAcknowledgeRequest {
  sessionId: string;
  acknowledgementId: string;
}

export interface SyncAcknowledgeResponse {
  success: boolean;
  receivedCount: number;
}

// --- LAN API (Student Client ↔ Local Server) --------------------------------

export interface JoinRequest {
  candidateId: string;
  sessionCode: string;
}

export interface JoinResponse {
  sessionToken: string;
  submissionId: string;         // pre-assigned by local server
  serverTime: string;           // ISO 8601 — client syncs timer to this
}

export interface SessionInfoResponse {
  sessionId: string;
  examId: string;
  status: 'waiting' | 'active' | 'ended';
  serverTime: string;           // ISO 8601
  durationSeconds: number;
  startedAt?: string;           // ISO 8601
  endsAt?: string;              // ISO 8601
}

export interface AutosaveRequest {
  submissionId: string;
  answers: import('./submission.js').Answer[];
  lastModifiedAt: string;       // ISO 8601
  checksum: string;
}

export interface AutosaveResponse {
  acknowledged: boolean;
  serverTime: string;
}

export interface SubmitRequest {
  envelope: import('./submission.js').SubmissionEnvelope;
}

export interface SubmitResponse {
  receipt: import('./submission.js').SubmissionReceipt;
}
