# GradeINT — Data Flow Document

## Flow 1: Cloud → Local School Exam Server (Pre-Exam)

```
Teacher Web App          Cloud API               Local Exam Server
──────────────           ─────────               ─────────────────
 1. Create exam
 2. Publish exam  ──►  Exam marked immutable
 3. Create session ──► Session linked to exam
 4. Request package    Generate ExamPackage
                        + compute checksum  ──────────────────────────►
                                                5. Store package in SQLite
                                                6. Verify checksum
                                                7. Mark state: 'downloaded'
```

**Trigger**: Operator opens Local Server app before exam day, logs in, and
clicks "Download Exam Package". Requires internet.

**Output**: A verified `ExamPackage` document stored in local SQLite.

---

## Flow 2: Local Server → Student Client (Exam Start)

```
Student Client                         Local Exam Server
──────────────                         ─────────────────
1. Enter server IP + session code
2. POST /local/join  ──────────────►
                                       3. Validate candidateId + sessionCode
                                       4. Issue sessionToken + submissionId
                     ◄──────────────  5. Return JoinResponse
6. GET /local/session-info ─────────►
                     ◄──────────────  7. Return session state + server time
8. GET /local/exam-package ─────────►
                     ◄──────────────  9. Return ExamPackage JSON
10. Cache package in local SQLite
11. Sync timer to server time
12. Begin exam
```

**Connectivity**: LAN only — no internet required for this flow.

**Output**: Student has a local copy of the exam and a valid session token.

---

## Flow 3: Student Client → Local Server (During Exam)

### Autosave (periodic, every N seconds defined in ActivationConfig)

```
Student Client                         Local Exam Server
──────────────                         ─────────────────
Every N seconds:
1. Serialize current answers
2. Compute checksum
3. POST /local/autosave ────────────►
                                       4. Validate token
                                       5. Upsert autosave in SQLite
                     ◄──────────────  6. Return AutosaveResponse (acknowledged)
7. Update lastAutosavedAt locally
```

### Final Submission

```
Student Client                         Local Exam Server
──────────────                         ─────────────────
1. Student clicks Submit
2. Build SubmissionEnvelope
3. Compute checksum
4. POST /local/submit ──────────────►
                                       5. Validate token + checksum
                                       6. Verify student not already sealed
                                       7. Store sealed submission in SQLite
                                       8. Mark submission state: 'sealed'
                     ◄──────────────  9. Return SubmissionReceipt
10. Display receipt to student
11. Lock exam UI (no further edits)
```

---

## Flow 4: Local Server → Cloud (Post-Exam Sync)

```
Local Exam Server                      Cloud API              PostgreSQL
─────────────────                      ─────────              ──────────
After exam ends (manual or auto-seal):
1. Seal all remaining submissions
2. Mark session state: 'pending_sync'
3. Await internet connection
4. POST /api/local-server/sync/submissions ──────────────────────────────►
                                             5. Validate local server token
                                             6. Store submissions ─────────►
                                             7. Trigger MCQ auto-grading
                           ◄──────────────  8. Return acknowledgementId
9. POST /api/local-server/sync/acknowledge ─────────────────────────────►
10. Mark session state: 'synced'

If step 4 fails:
- Mark state: 'sync_failed'
- Retry with exponential backoff
- Never discard local submissions
```

**Connectivity**: Internet required for this flow only.
**Timing**: Can happen minutes or hours after the exam ends.

---

## Error Handling Summary

| Flow | Failure Scenario | Recovery |
|---|---|---|
| Flow 1 (download) | No internet at download time | Retry; cannot activate without verified package |
| Flow 2 (join) | Student enters wrong IP | Manual re-entry; no data loss |
| Flow 3 (autosave) | LAN drop during exam | Student client retries silently; answers safe in local SQLite |
| Flow 3 (submit) | LAN drop at submit time | Retry submit; idempotent via submissionId |
| Flow 4 (sync) | No internet post-exam | Retry worker runs on interval; data never lost |
