GradeINT - AI-powered Computer-Based Testing platform with offline-first architecture and AI-assisted grading.

GradeINT enables institutions to run secure digital assessments while supporting essay and open-ended responses evaluated using large language models. It is designed for reliability in low-connectivity environments and structured for institutional scalability.

🚀 Core Features
📚 Exam Lifecycle
    Draft → Published state model
    Immutable exams after publish
    Question validation before publishing
    Multiple sessions per exam (different sittings/classes)

📝 Question Types
  Multiple Choice
  Short Answer
  Essay (Long answer)

🧠 AI Grading
  Essay and short-answer grading via LLM
  Structured grading response parsing
  Grade Manual override possible

👨‍🎓 Session-Based Submissions
  Students submit once per session
  unique(studentId, sessionId)
  Duplicate submissions prevented at DB level
  Clear submission state handling

🔐 Integrity Controls
  Cannot publish exam without questions
  Cannot create session for draft exam
  Immutable exam structure after publish
  Orphan prevention via cascade deletes / transactional cleanup

🏗 Architecture Overview
Tech Stack
  Frontend:
    React
    TypeScript
    React Query
    Wouter (routing)

  Backend:
    Express
    TypeScript
    Drizzle ORM
    PostgreSQL / SQLite (depending on environment)


```
GradeINT/
├── shared/               ← Types, DB schema, API route contracts (Zod)
│   ├── schema.ts         ← Drizzle tables + Zod insert schemas + TS types
│   ├── routes.ts         ← Typed API contract (method, path, input, responses)
│   └── models/chat.ts    ← (Referenced but unread — likely AI chat types)
├── server/
│   ├── index.ts          ← Express setup, logging middleware, Vite dev proxy
│   ├── routes.ts         ← All API route handlers + DB seed logic
│   ├── storage.ts        ← DatabaseStorage class (all DB queries)
│   └── db.ts             ← Drizzle client init
└── client/src/
    ├── App.tsx           ← Router + Protected routes
    ├── hooks/            ← use-auth, use-exams, use-sessions, use-toast
    └── pages/
        ├── Login.tsx
        ├── teacher/      ← Dashboard, ExamsList, Grading, ScoreSheet
        └── student/      ← Dashboard, ExamSession
```


AI:
Claude API is currently integrated for grading

High-Level Structure
```
/client
  /src
    /hooks
    /pages
    /components

/server
  routes.ts
  storage.ts

/shared
  schema.ts
  api-contract.ts
```

🔄 Domain Model
```
Exam
{
  id: number
  title: string
  description: string
  durationMinutes: number
  status: "draft" | "published"
}

Question
{
  id: number
  examId: number
  text: string
  type: "multiple_choice" | "short_answer" | "essay"
  options?: string[]
  points: number
}
```

Session
Multiple sessions allowed per exam.
```
{
  id: number
  examId: number
  accessCode: string
  isActive: boolean
}
```

Submission
One per student per session.
```
  unique(studentId, sessionId)
```

📌 Business Rules
  Exams must have at least one question before publishing.
  MCQs must have options and answer attached before creation.
  Published exams cannot be edited.
  Sessions can only be created for published exams.
  Students can submit only once per session.
  Publishing does NOT auto-create sessions (sessions are explicit).

🧠 AI Grading Flow
  Student submits responses.
  Submission stored with status "submitted".
  Grading endpoint calls Claude.
  AI returns structured evaluation.
  Submission updated with:
    score
    feedback
    grading status
  Future improvement: async job queue for grading to avoid blocking requests.

🔍 Data Integrity Guarantees
  Transactions wrap multi-step DB operations.
  Unique constraint on (studentId, sessionId).
  Publish blocked if question count = 0.
  No orphan records on exam deletion.
  React Query keys standardized.

🛠 Local Development
  Install
  npm install
  
  Run
  npm run dev
  
  Environment Variables
    Create .env:
    ```
      DATABASE_URL=...
      OPENAI_API_KEY=...
    ```

📡 API Summary
Exams
```
  POST /api/exams

  PUT /api/exams/:id

  POST /api/exams/:id/publish

  DELETE /api/exams/:id
```
Questions
```
  GET /api/exams/:examId/questions

  POST /api/exams/:examId/questions
```
Sessions
```
  POST /api/sessions

  GET /api/sessions/:id
```
Submissions
```
  POST /api/submissions

  POST /api/submissions/:id/grade
```

⚠ Known Limitations
  AI grading is synchronous (blocks request lifecycle).
  No full role-based access control yet.
  No background job queue.
  Seeding logic runs in development environment.

📈 Future Roadmap
  Async grading job queue
  Role-based access control (Teacher / Student / Admin)
  Audit logs for assessment compliance
  Offline local server deployment mode
  LLM grading rubric customization

🧭 Design Philosophy

GradeINT is built around one core principle:
  Remove illegal states at the domain level.

Instead of patching UI errors, business invariants are enforced server-side to guarantee correctness and institutional trust.
