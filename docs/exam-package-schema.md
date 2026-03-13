# GradeINT — Exam Package Schema

## Purpose

The **Exam Package** is the self-contained unit of exam content downloaded
from the cloud to the Local School Exam Server before the exam. It contains
everything the Local Server and Student Client need to run the exam without
any further cloud communication.

## Canonical TypeScript Type

Defined in `packages/shared-types/src/exam.ts`.

## Full Schema

```typescript
ExamPackage {
  examId:          string   // UUID — unique identifier for this exam
  packageVersion:  string   // semver e.g. "1.0.0"
  checksum:        string   // SHA-256 hex of canonical JSON (self excluded)
  generatedAt:     string   // ISO 8601 — when the package was generated

  title:           string   // Exam title shown to students
  instructions:    string   // Pre-exam instructions shown on start screen
  duration:        number   // Exam length in seconds

  questions: Question[]     // Ordered list of questions

  sessionMetadata: {
    sessionId:              string    // UUID
    scheduledStartAt:       string    // ISO 8601
    scheduledEndAt:         string    // ISO 8601
    allowedCandidateIds:    string[]  // empty = open session
    maxAttempts:            number    // always 1 for MVP
  }

  activationConfig: {
    requireLocalAuth:           boolean  // must student auth on local server
    autoSealOnTimerExpiry:      boolean  // auto-seal when timer hits 0
    autosaveIntervalSeconds:    number   // how often student client autosaves
  }
}

Question {
  questionId:  string         // UUID
  order:       number         // 1-indexed display order
  type:        QuestionType   // 'mcq' | 'multi-select' | 'short-answer' | 'essay'
  text:        string         // Plain text question
  richText?:   string         // Optional HTML/Markdown (future use)
  options?:    Option[]       // Present for mcq / multi-select
  points:      number         // Maximum marks for this question
  required:    boolean        // Must student answer before submitting
}

Option {
  optionId:  string   // UUID
  order:     number   // 1-indexed display order
  text:      string   // Option label shown to student
}
```

## Integrity Rules

1. `checksum` is computed as `SHA-256(canonicalJson(package excluding checksum field))`
2. Local Server **must** verify checksum immediately after download
3. Local Server **must** refuse to activate a session with a failed checksum
4. Package is **immutable** after generation — any change invalidates the checksum
5. Cloud **must** regenerate package (new version + new checksum) if exam is re-published

## What is Excluded from the Package

The following cloud-side data is **NOT** included in the exam package:

- Correct answers / answer keys (grading happens in cloud only)
- Other students' data
- Teacher/admin account information
- Grading weights beyond `question.points`
- Anything not needed to render the exam UI
