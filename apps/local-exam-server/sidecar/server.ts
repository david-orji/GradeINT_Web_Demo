import express from "express";
import cors from "cors";
import { eq } from "drizzle-orm";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "path";
import os from "os";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    callback(null, true);
  },
  credentials: true
}));

// ─── SQLite Path Resolution ────────────────────────────────────────────────
// In production (PKG bundle), use %APPDATA%\GradeINT\ so data persists
// across updates and isn't locked inside Program Files.
// In dev (npx tsx), use the local sidecar folder for convenience.
function getDbPath(): string {
  const isProd = typeof (process as any).pkg !== "undefined";
  if (isProd) {
    const dataDir = path.join(os.homedir(), "AppData", "Roaming", "GradeINT");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, "local-exam.sqlite");
  }
  return path.join(process.cwd(), "local-exam.sqlite");
}

const sqlite = new Database(getDbPath());
// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// ─── Schema Migration (idempotent) ─────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cloud_exam_id TEXT NOT NULL,
    access_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    package_data TEXT NOT NULL,
    checksum TEXT NOT NULL,
    downloaded_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exams(id),
    status TEXT NOT NULL DEFAULT 'active',
    started_at INTEGER DEFAULT (unixepoch()),
    sealed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    client_ip TEXT NOT NULL,
    answers_data TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'connected',
    last_autosave_at INTEGER DEFAULT (unixepoch()),
    sealed_at INTEGER
  );
`);
console.log("Local SQLite Schema Applied (better-sqlite3)");

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", role: "local-exam-server" });
});

// ─── Internal React UI API ──────────────────────────────────────────────────

app.post("/api/internal/activate", (req, res) => {
  const { exam } = req.body;
  if (!exam || (!exam.id && !exam.examId)) return res.status(400).json({ error: "Invalid exam payload" });

  try {
    const cloudId = exam.id || exam.examId;

    // 1. Insert or update the exam template
    const existingExam = db.select().from(schema.exams).where(eq(schema.exams.cloudExamId, cloudId)).get();

    let localExamId: number;
    if (existingExam) {
      localExamId = existingExam.id;
      db.update(schema.exams).set({
        title: exam.title,
        packageData: JSON.stringify(exam),
        checksum: exam.checksum || "no-checksum",
      }).where(eq(schema.exams.id, existingExam.id)).run();
    } else {
      const inserted = db.insert(schema.exams).values({
        cloudExamId: cloudId,
        accessCode: exam.accessCode || Math.random().toString(36).substring(2, 10).toUpperCase(),
        title: exam.title,
        packageData: JSON.stringify(exam),
        checksum: exam.checksum || "no-checksum",
      }).returning().get();
      localExamId = inserted.id;
    }

    // 2. Close any existing active sessions
    db.update(schema.sessions)
      .set({ status: "closed" })
      .where(eq(schema.sessions.status, "active"))
      .run();

    // 3. Create a new active session
    const newSession = db.insert(schema.sessions).values({
      examId: localExamId,
      status: "active",
    }).returning().get();

    return res.json({ success: true, sessionId: newSession.id });
  } catch (err: any) {
    console.error("Failed to activate exam session:", err);
    return res.status(500).json({ error: "Failed to persist active session" });
  }
});

// ─── Student Devices LAN API ────────────────────────────────────────────────

// 1. Join Exam Session
app.post("/api/student/join", (req, res) => {
  const { sessionCode, studentId, studentName } = req.body;
  if (!sessionCode || !studentId) return res.status(400).json({ error: "Missing identity" });

  const activeSession = db.select().from(schema.sessions)
    .where(eq(schema.sessions.status, "active"))
    .get();

  if (!activeSession) return res.status(404).json({ error: "No active exam session" });

  // Create or reconnect submission record
  let sub = db.select().from(schema.submissions)
    .where(eq(schema.submissions.studentId, studentId))
    .get();

  if (!sub) {
    sub = db.insert(schema.submissions).values({
      sessionId: activeSession.id,
      studentId,
      studentName: studentName || "Unknown Candidate",
      clientIp: req.ip || "unknown",
      status: "connected",
    }).returning().get();
  }

  return res.json({ success: true, submissionId: sub.id.toString() });
});

// 2. Fetch Exam Package
app.get("/api/student/exam", (_req, res) => {
  const activeSession = db.select().from(schema.sessions)
    .where(eq(schema.sessions.status, "active"))
    .get();

  if (!activeSession) return res.status(404).json({ error: "No active exam session" });

  const exam = db.select().from(schema.exams)
    .where(eq(schema.exams.id, activeSession.examId))
    .get();

  if (!exam) return res.status(404).json({ error: "Exam data missing locally" });

  return res.type("json").send(exam.packageData);
});

// 3. Autosave Submission
app.post("/api/student/submissions", (req, res) => {
  const { studentId, answers } = req.body;
  if (!studentId || !answers) return res.status(400).json({ error: "Bad payload" });

  db.update(schema.submissions)
    .set({
      answersData: JSON.stringify(answers),
      lastAutosaveAt: new Date(),
      status: "in_progress",
    })
    .where(eq(schema.submissions.studentId, studentId))
    .run();

  return res.json({ success: true });
});

// 4. Final Seal
app.post("/api/student/submissions/seal", (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: "Bad payload" });

  db.update(schema.submissions)
    .set({
      status: "sealed",
      sealedAt: new Date(),
    })
    .where(eq(schema.submissions.studentId, studentId))
    .run();

  return res.json({ success: true, message: "Receipt generated locally" });
});

// ─── Internal: Graceful Shutdown ────────────────────────────────────────────
app.post("/api/internal/shutdown", (_req, res) => {
  res.json({ success: true, message: "Shutting down sidecar..." });
  setTimeout(() => {
    console.log("[Sidecar] Received shutdown signal. Exiting.");
    sqlite.close();
    process.exit(0);
  }, 300);
});

// ─── Boot ───────────────────────────────────────────────────────────────────
import { startCloudSyncWorker } from "./sync.js";

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Local Exam Sidecar running on http://0.0.0.0:${PORT}`);
  startCloudSyncWorker();
});
