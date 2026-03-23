import express from "express";
import cors from "cors";
import { eq, and } from "drizzle-orm";
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

// ─── Logging & Path Resolution ─────────────────────────────────────────────
const isProd = typeof (process as any).pkg !== "undefined";
const dataDir = isProd 
  ? path.join(os.homedir(), "AppData", "Roaming", "GradeINT")
  : process.cwd();

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Simple logger for production troubleshooting
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  if (isProd) {
    fs.appendFileSync(path.join(dataDir, "sidecar.log"), line);
  }
}

log("Sidecar starting...");
log(`Platform: ${process.platform}, Arch: ${process.arch}, Node: ${process.version}`);

// Parse CLI args for native binding path
const args = process.argv.slice(2);
const bindingArg = args.find(a => a.startsWith("--binding-path="));
const bindingPath = bindingArg ? bindingArg.split("=")[1] : null;

function getDbPath(): string {
  return path.join(dataDir, "local-exam.sqlite");
}

let sqlite: Database.Database;
try {
  log(`Opening database at: ${getDbPath()}`);
  
  const options: Database.Options = {};
  if (bindingPath) {
    log(`Using explicit native binding at: ${bindingPath}`);
    options.nativeBinding = bindingPath;
  } else if (isProd) {
    log("WARNING: Running in production but no --binding-path provided.");
  }

  sqlite = new Database(getDbPath(), options);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  log("Database opened successfully.");
} catch (err: any) {
  log(`CRITICAL: Database failed to open: ${err.message}`);
  process.exit(1);
}

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
    session_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    activated_at INTEGER,
    closed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    answers TEXT NOT NULL,
    sealed_at INTEGER,
    synced_at INTEGER,
    sync_attempts INTEGER NOT NULL DEFAULT 0,
    checksum TEXT
  );
`);

// ─── API Routes ────────────────────────────────────────────────────────────

// Health check — used by the frontend to confirm the sidecar is fully ready
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: "1.0.0" });
});

app.post("/api/internal/activate", (req, res) => {
  const { exam } = req.body;
  if (!exam) return res.status(400).json({ error: "exam package required" });
  try {
    // ExamPackage uses `examId` not `id`, and `accessCode` lives in the
    // access_code field we pass from the teacher UI (user entered it).
    // We accept whatever access_code the teacher used to download the package.
    const accessCode: string = (req.body.accessCode || exam.sessionMetadata?.sessionId || exam.examId).trim().toUpperCase();
    
    const existing = db.select().from(schema.exams)
      .where(eq(schema.exams.cloud_exam_id, exam.examId)).get();
    if (!existing) {
      db.insert(schema.exams).values({
        cloud_exam_id: exam.examId,
        access_code: accessCode,
        title: exam.title,
        package_data: JSON.stringify(exam),
        checksum: exam.checksum,
      }).run();
    }
    const examRow = db.select().from(schema.exams)
      .where(eq(schema.exams.cloud_exam_id, exam.examId)).get();
    
    const existingSession = db.select().from(schema.sessions)
      .where(eq(schema.sessions.exam_id, examRow!.id)).get();
    if (!existingSession) {
      db.insert(schema.sessions).values({
        exam_id: examRow!.id,
        session_code: accessCode,
        status: "active",
        activated_at: Math.floor(Date.now() / 1000),
      }).run();
    } else {
      db.update(schema.sessions).set({
        session_code: accessCode,
        status: "active",
        activated_at: Math.floor(Date.now() / 1000)
      }).where(eq(schema.sessions.id, existingSession.id)).run();
    }
    const session = db.select().from(schema.sessions)
      .where(eq(schema.sessions.exam_id, examRow!.id)).get();
    log(`Session activated: ${session!.session_code} for exam "${exam.title}"`);
    res.json({ ok: true, sessionCode: session!.session_code });
  } catch (err) {
    log(`[activate] Error: ${(err as any).message}`);
    console.error("[activate]", err);
    res.status(500).json({ error: "Failed to activate session" });
  }
});

app.post("/api/internal/shutdown", (_req, res) => {
  res.json({ ok: true });
  sqlite.close();
  process.exit(0);
});

app.post("/api/student/join", (req, res) => {
  let { sessionCode, studentId, studentName } = req.body;
  if (!sessionCode || !studentId)
    return res.status(400).json({ error: "sessionCode and studentId required" });
  
  sessionCode = sessionCode.trim().toUpperCase();
  
  const session = db.select().from(schema.sessions)
    .where(eq(schema.sessions.session_code, sessionCode)).get();
    
  if (!session || session.status !== "active") {
    log(`[Join Failed] Invalid code "${sessionCode}" or inactive session. Student: ${studentId}`);
    return res.status(404).json({ error: "Session not found or not active" });
  }
    
  res.json({ ok: true, sessionId: session.id });
});

app.get("/api/student/exam/:sessionCode", (req, res) => {
  const sessionCode = req.params.sessionCode.trim().toUpperCase();
  const session = db.select().from(schema.sessions)
    .where(eq(schema.sessions.session_code, sessionCode)).get();
  if (!session) return res.status(404).json({ error: "Session not found" });
  
  const exam = db.select().from(schema.exams)
    .where(eq(schema.exams.id, session.exam_id)).get();
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  
  res.json(JSON.parse(exam.package_data));
});

app.post("/api/student/submissions", (req, res) => {
  let { sessionCode, studentId, studentName, answers } = req.body;
  if (!sessionCode || !studentId)
    return res.status(400).json({ error: "sessionCode and studentId required" });

  sessionCode = sessionCode.trim().toUpperCase();

  const session = db.select().from(schema.sessions)
    .where(eq(schema.sessions.session_code, sessionCode)).get();
  if (!session) return res.status(404).json({ error: "Session not found" });

  // Use studentId as name if missing
  const finalName = studentName || studentId;

  // UPSERT: Check if submission exists
  const existing = db.select().from(schema.submissions)
    .where(and(eq(schema.submissions.session_id, session.id), eq(schema.submissions.student_id, studentId))).get();

  if (existing) {
    db.update(schema.submissions)
      .set({ answers: JSON.stringify(answers) })
      .where(eq(schema.submissions.id, existing.id)).run();
  } else {
    db.insert(schema.submissions).values({
      session_id: session.id,
      student_id: studentId,
      student_name: finalName,
      answers: JSON.stringify(answers),
    }).run();
  }
  
  res.json({ ok: true });
});

app.post("/api/student/submissions/seal", (req, res) => {
  let { sessionCode, studentId } = req.body;
  if (!sessionCode || !studentId)
    return res.status(400).json({ error: "sessionCode and studentId required" });

  sessionCode = sessionCode.trim().toUpperCase();

  const session = db.select().from(schema.sessions)
    .where(eq(schema.sessions.session_code, sessionCode)).get();
  if (!session) return res.status(404).json({ error: "Session not found" });

  db.update(schema.submissions)
    .set({ sealed_at: Math.floor(Date.now() / 1000) })
    .where(and(eq(schema.submissions.session_id, session.id), eq(schema.submissions.student_id, studentId))).run();
    
  res.json({ ok: true, receipt: `RCPT-${Date.now().toString().slice(-6)}` });
});

const PORT = 4000;
app.listen(PORT, "0.0.0.0", () => {
  log(`[GradeINT Sidecar] Running on http://0.0.0.0:${PORT} (LAN reachable)`);
});
