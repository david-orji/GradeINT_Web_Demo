import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const app = express();
app.use(express.json());
app.use(cors());

// Initialize SQLite Database
// In production (bundled by Tauri), this should point to the app data dir.
// For now, in dev, we create a local file in the sidecar folder.
const sqlite = new Database("local-exam.sqlite");
export const db = drizzle(sqlite, { schema });

// Apply schema (Basic SQLite migration for MVP)
sqlite.exec(`
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", role: "local-exam-server" });
});

// START: Student Devices LAN API

// 1. Join Exam Session
app.post("/api/student/join", async (req, res) => {
  const { sessionCode, studentId, studentName } = req.body;
  
  if (!sessionCode || !studentId) return res.status(400).json({ error: "Missing identity" });

  const activeSession = await db.select().from(schema.sessions)
    .where((s) => s.status.equals("active"))
    .get();

  if (!activeSession) return res.status(404).json({ error: "No active exam session" });

  // Create or reconnect submission record
  let sub = await db.select().from(schema.submissions)
    .where((s) => s.studentId.equals(studentId))
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

  res.json({ success: true, submissionId: sub.id });
});

// 2. Fetch Exam Package
app.get("/api/student/exam", async (req, res) => {
  const activeSession = await db.select().from(schema.sessions)
    .where((s) => s.status.equals("active"))
    .get();

  if (!activeSession) return res.status(404).json({ error: "No active exam session" });

  const exam = await db.select().from(schema.exams)
    .where((e) => e.id.equals(activeSession.examId))
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
    .where((s) => s.studentId.equals(studentId))
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
    .where((s) => s.studentId.equals(studentId))
    .execute();

  res.json({ success: true, message: "Receipt generated locally" });
});

// END: Student Devices LAN API

import { startCloudSyncWorker } from "./sync.js";

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Local Exam Sidecar running on http://0.0.0.0:${PORT}`);
  startCloudSyncWorker();
});
