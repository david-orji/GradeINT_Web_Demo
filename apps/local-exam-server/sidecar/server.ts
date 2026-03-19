import express from "express";
import cors from "cors";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    callback(null, true);
  },
  credentials: true
}));

// Initialize SQLite Database
// In production (bundled by Tauri), this should point to the app data dir.
// For now, in dev, we create a local file in the sidecar folder.
const sqlite = createClient({ url: "file:local-exam.sqlite" });
export const db = drizzle(sqlite, { schema });

// Apply schema (Basic SQLite migration for MVP)
(async () => {
  await sqlite.executeMultiple(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_exam_id TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      package_data TEXT NOT NULL,
      checksum TEXT NOT NULL,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id),
      status TEXT NOT NULL DEFAULT 'active',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sealed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      client_ip TEXT NOT NULL,
      answers_data TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'connected',
      last_autosave_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sealed_at DATETIME
    );
  `);
  console.log("Local SQLite Schema Applied (LibSQL)");
})().catch(console.error);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", role: "local-exam-server" });
});

// START: Internal React UI API (Protected via localhost bridging)

app.post("/api/internal/activate", async (req, res) => {
  const { exam } = req.body;
  if (!exam || (!exam.id && !exam.examId)) return res.status(400).json({ error: "Invalid exam payload" });

  try {
    const cloudId = exam.id || exam.examId;
    
    // 1. Insert or update the exam template
    const existingExam = await db.select().from(schema.exams).where(eq(schema.exams.cloudExamId, cloudId)).get();
    
    let localExamId;
    if (existingExam) {
      localExamId = existingExam.id;
      await db.update(schema.exams).set({
        title: exam.title,
        packageData: JSON.stringify(exam),
        checksum: exam.checksum || "no-checksum",
      }).where(eq(schema.exams.id, existingExam.id)).execute();
    } else {
      const inserted = await db.insert(schema.exams).values({
        cloudExamId: cloudId,
        accessCode: exam.accessCode || Math.random().toString(36).substring(2, 10).toUpperCase(),
        title: exam.title,
        packageData: JSON.stringify(exam),
        checksum: exam.checksum || "no-checksum",
      }).returning().get();
      localExamId = inserted.id;
    }

    // 2. Mark any existing active sessions as 'closed'
    await db.update(schema.sessions)
      .set({ status: 'closed' })
      .where(eq(schema.sessions.status, 'active'))
      .execute();

    // 3. Create a new active session
    const newSession = await db.insert(schema.sessions).values({
      examId: localExamId,
      status: 'active'
    }).returning().get();

    res.json({ success: true, sessionId: newSession.id });
  } catch (err: any) {
    console.error("Failed to activate exam session:", err);
    res.status(500).json({ error: "Failed to persist active session" });
  }
});

// START: Student Devices LAN API

// 1. Join Exam Session
app.post("/api/student/join", async (req, res) => {
  const { sessionCode, studentId, studentName } = req.body;
  
  if (!sessionCode || !studentId) return res.status(400).json({ error: "Missing identity" });

  const activeSession = await db.select().from(schema.sessions)
    .where(eq(schema.sessions.status, "active"))
    .get();

  if (!activeSession) return res.status(404).json({ error: "No active exam session" });

  // Create or reconnect submission record
  let sub = await db.select().from(schema.submissions)
    .where(eq(schema.submissions.studentId, studentId))
    .get();

  if (!sub) {
    const inserted = await db.insert(schema.submissions).values({
      sessionId: activeSession.id,
      studentId,
      studentName: studentName || "Unknown Candidate",
      clientIp: req.ip || "unknown",
      status: "connected"
    }).returning().get();
    sub = inserted;
  }

  res.json({ success: true, submissionId: sub.id.toString() });
});

// 2. Fetch Exam Package
app.get("/api/student/exam", async (req, res) => {
  const activeSession = await db.select().from(schema.sessions)
    .where(eq(schema.sessions.status, "active"))
    .get();

  if (!activeSession) return res.status(404).json({ error: "No active exam session" });

  const exam = await db.select().from(schema.exams)
    .where(eq(schema.exams.id, activeSession.examId))
    .get();

  if (!exam) return res.status(404).json({ error: "Exam data missing locally" });

  // Return the raw cached ExamPackage JSON
  res.type('json').send(exam.packageData);
});

// 3. Autosave Submission
app.post("/api/student/submissions", async (req, res) => {
  const { studentId, answers } = req.body;
  if (!studentId || !answers) return res.status(400).json({ error: "Bad payload" });

  // Update submission locally
  await db.update(schema.submissions)
    .set({ 
      answersData: JSON.stringify(answers), 
      lastAutosaveAt: new Date(),
      status: "in_progress" 
    })
    .where(eq(schema.submissions.studentId, studentId))
    .execute();

  res.json({ success: true });
});

// 4. Final Seal
app.post("/api/student/submissions/seal", async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: "Bad payload" });

  await db.update(schema.submissions)
    .set({ 
      status: "sealed", 
      sealedAt: new Date() 
    })
    .where(eq(schema.submissions.studentId, studentId))
    .execute();

  res.json({ success: true, message: "Receipt generated locally" });
});

// END: Student Devices LAN API

// Internal: Graceful Shutdown
app.post("/api/internal/shutdown", (_req, res) => {
  res.json({ success: true, message: "Shutting down sidecar..." });
  // Give the response time to flush before exiting
  setTimeout(() => {
    console.log("[Sidecar] Received shutdown signal. Exiting.");
    process.exit(0);
  }, 300);
});

import { startCloudSyncWorker } from "./sync.js";

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Local Exam Sidecar running on http://0.0.0.0:${PORT}`);
  startCloudSyncWorker();
});
