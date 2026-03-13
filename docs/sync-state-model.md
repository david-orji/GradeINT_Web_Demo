# GradeINT — Sync State Model

## Purpose

Defines the complete lifecycle state of an exam session on the
**Local School Exam Server**, from package download through to
confirmed cloud sync.

## Canonical TypeScript Type

Defined in `packages/shared-types/src/session.ts`.

## State Machine

```
                    ┌───────────────┐
                    │  downloaded   │  Package received from cloud, checksum verified
                    └──────┬────────┘
                           │ Operator activates session
                           ▼
                    ┌───────────────┐
                    │   activated   │  Session live; students can connect
                    └──────┬────────┘
                           │ First student joins
                           ▼
                    ┌───────────────┐
                    │  in_progress  │  Exam underway
                    └──────┬────────┘
                           │ Timer expires or operator ends session
                           ▼
                    ┌───────────────┐
                    │    sealed     │  No more submissions accepted
                    └──────┬────────┘
                           │ Internet available + operator initiates sync
                           ▼
                    ┌───────────────┐
                    │ pending_sync  │  Queued for upload
                    └──────┬────────┘
                           │ Upload begins
                           ▼
                    ┌───────────────┐
                    │    syncing    │  Upload in flight
                    └──────┬────────┘
               ┌───────────┴──────────┐
               │ success              │ failure
               ▼                      ▼
        ┌──────────┐          ┌──────────────┐
        │  synced  │          │  sync_failed │──► retry → pending_sync
        └──────────┘          └──────────────┘
```

## State Definitions

| State | Meaning | Next Actions |
|---|---|---|
| `downloaded` | Package received from cloud. Checksum verified. Not yet active. | Activate session |
| `activated` | Session is live on LAN. Students can connect and receive exam. | Wait for first student to start |
| `in_progress` | At least one student has begun the exam. Autosaves being received. | Wait for exam to end |
| `sealed` | Exam ended. No more autosaves or submissions accepted. Submissions locked. | Begin sync |
| `pending_sync` | Submissions ready to upload. Waiting for internet. | Start upload |
| `syncing` | Upload currently in flight to cloud API. | Wait for response |
| `synced` | Cloud acknowledged receipt. All submissions confirmed. | Done |
| `sync_failed` | Upload failed (network error, cloud error, timeout). | Retry with backoff |

## Sync Worker Retry Policy (MVP)

| Attempt | Wait Before Retry |
|---|---|
| 1st failure | 30 seconds |
| 2nd failure | 2 minutes |
| 3rd failure | 10 minutes |
| 4th+ failures | 30 minutes (cap) |

- Worker checks connectivity before each attempt
- Worker runs on app startup (resumes from `pending_sync` or `sync_failed`)
- Worker runs on a background interval (every 60 seconds when app is open)
- Operator can also trigger a manual sync from the dashboard

## Per-Submission Sync Fields

Tracked in the `submissions` table per individual student submission:

| Field | Type | Description |
|---|---|---|
| `sync_state` | `ExamSyncState` | Current sync status |
| `sync_attempts` | `number` | Total upload attempts |
| `last_sync_at` | `string (ISO 8601)` | Timestamp of last attempt |
| `cloud_ack_id` | `string \| null` | Acknowledgement ID from cloud |

## Operational Safety Rules

1. A submission is **never deleted** from local SQLite, even after successful sync
2. `sealed` state is **permanent** — a submission cannot be unsealed
3. `synced` state is reached **only** when cloud returns an `acknowledgementId`
4. If the app crashes during `syncing`, it restarts in `sync_failed` → retries
5. An operator can export all local submissions to a file at any time (failsafe)
