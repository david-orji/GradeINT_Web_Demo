# GradeINT — Deployment Model

## Overview

GradeINT is a three-surface hybrid product. Each surface has a distinct
deployment target, responsibilities, and connectivity requirement.

---

## Surface 1: Teacher / Admin Web App

| Property | Value |
|---|---|
| **Type** | Web application |
| **Host** | Cloud (e.g. Railway, Fly.io, VPS) |
| **Access** | Browser — any device, any OS |
| **Connectivity** | Always-online required |
| **Auth** | Session-based (Passport.js / bcrypt) |
| **Database** | PostgreSQL (cloud-hosted) |

### Responsibilities
- Create and edit exam questions
- Publish exams (making them immutable)
- Set up exam sessions (link exam + schedule + candidate list)
- Generate exam packages for offline delivery
- View submission sync status (synced / pending / failed)
- View grading results and reports

### What it does NOT do
- Does not run during the live exam
- Does not communicate directly with student devices
- Does not grade locally

---

## Surface 2: Local School Exam Server Desktop App

| Property | Value |
|---|---|
| **Type** | Tauri desktop application |
| **Installed on** | One designated school PC per exam room |
| **OS** | Windows (MVP) |
| **Connectivity** | Online to download package; offline during exam |
| **Auth** | School API key (stored securely in app) |
| **Database** | SQLite (embedded in app) |
| **LAN role** | Server — exposes HTTP API to student clients |

### Responsibilities
- Authenticate with cloud and download exam package
- Verify package integrity (SHA-256 checksum)
- Activate the exam session locally
- Serve exam package to student clients over LAN
- Receive and store autosaves and final submissions
- Seal submissions at exam end
- Sync sealed submissions to cloud when internet is available
- Retry failed syncs with exponential backoff
- Display operator dashboard (active students, submissions, sync status)

### What it does NOT do
- Does not grade submissions
- Does not serve multiple simultaneous sessions (MVP: one session at a time)
- Does not auto-discover student devices (MVP: manual connect)

---

## Surface 3: Student Exam Client Desktop App

| Property | Value |
|---|---|
| **Type** | Tauri desktop application |
| **Installed on** | Every student PC in the exam room |
| **OS** | Windows (MVP) |
| **Connectivity** | LAN only during exam — no internet required |
| **Auth** | Candidate ID + session code (issued by local server) |
| **Database** | SQLite (embedded in app, local cache) |
| **LAN role** | Client — connects to Local School Exam Server |

### Responsibilities
- Connect to Local School Exam Server via IP + session code
- Authenticate as a candidate
- Download and cache exam package locally
- Render exam UI (questions, timer, navigation)
- Auto-save answers locally and to local server
- Submit final answers to local server
- Display confirmation receipt
- Recover answers after crash or restart

### What it does NOT do
- Does not communicate with the cloud at any point
- Does not grade or evaluate answers
- Does not rely on a browser
- Does not accept exam edits after final submission

---

## Communication Summary

```
[Teacher Web App] ──HTTPS──► [Cloud API + PostgreSQL]
                                      │
                              HTTPS (pre-exam)
                                      │
                                      ▼
                    [Local School Exam Server]
                          │ LAN HTTP
              ┌───────────┼───────────┐
              ▼           ▼           ▼
       [Student PC] [Student PC] [Student PC]
```

Post-exam:

```
[Local School Exam Server] ──HTTPS──► [Cloud API + PostgreSQL]
                                              │
                                       [Teacher Web App]
                                       (views results)
```
