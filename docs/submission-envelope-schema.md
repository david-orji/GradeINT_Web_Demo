# GradeINT — Submission Envelope Schema

## Purpose

The **Submission Envelope** is the unit of data that travels from the
Student Client to the Local Server (via `/local/submit`), and then from
the Local Server to the Cloud (via `/api/local-server/sync/submissions`).

It is the authoritative record of a student's exam attempt.

## Canonical TypeScript Type

Defined in `packages/shared-types/src/submission.ts`.

## Full Schema

```typescript
SubmissionEnvelope {
  // Identity
  submissionId:    string   // UUID — issued by local server on first autosave
  sessionId:       string   // UUID — links to the active exam session
  examId:          string   // UUID — links to the exam
  studentId:       string   // Candidate ID (e.g. student number)
  deviceId:        string   // Stable device fingerprint

  // Auth
  sessionToken:    string   // JWT issued by local server at /local/join

  // Answers
  answers:         Answer[]

  // State
  submissionState: SubmissionState
  attemptNumber:   number   // Always 1 for MVP

  // Timestamps (all ISO 8601)
  examStartedAt:   string
  lastAutosavedAt: string
  submittedAt?:    string   // Set only on final submission

  // Integrity
  checksum:        string   // SHA-256 of answers + timestamps (self excluded)
}

Answer {
  questionId:         string    // UUID — matches a question in the ExamPackage
  selectedOptionIds?: string[]  // mcq / multi-select only
  textAnswer?:        string    // short-answer / essay only
  lastModifiedAt:     string    // ISO 8601
}

SubmissionState =
  | 'in_progress'     // Student is actively writing
  | 'autosaved'       // Last periodic autosave confirmed by local server
  | 'submitted'       // Student clicked Submit
  | 'sealed'          // Local server sealed; edits no longer accepted
  | 'receipt_issued'  // Student received confirmation receipt

SubmissionReceipt {
  submissionId:   string   // UUID
  studentId:      string
  sessionId:      string
  sealedAt:       string   // ISO 8601
  receiptToken:   string   // Opaque confirmation token
}
```

## Autosave vs Final Submission

| Property | Autosave (`POST /local/autosave`) | Final Submit (`POST /local/submit`) |
|---|---|---|
| Payload | `AutosaveRequest` (partial) | Full `SubmissionEnvelope` |
| State written | `'autosaved'` | `'sealed'` |
| Reversible? | Yes — overwritten on next autosave | No — sealed permanently |
| Receipt issued? | No | Yes |

## Integrity Rules

1. `checksum` = `SHA-256(canonicalJson(envelope excluding checksum))`
2. Local Server verifies checksum on receipt of final submission
3. A submission cannot be un-sealed once state is `'sealed'`
4. `submissionId` is pre-assigned by the local server at `/local/join` to
   allow idempotent retry of final submission
5. Duplicate submissions with the same `submissionId` are deduplicated by
   the local server (second request returns same receipt)

## Cloud Sync Behaviour

When the Local Server syncs to cloud:
- The full `SubmissionEnvelope` (in `sealed` state) is sent
- Cloud stores it and triggers grading
- Cloud returns an `acknowledgementId`
- Local Server marks `sync_state = 'synced'`
- Local copies are retained (never deleted) for operational safety
