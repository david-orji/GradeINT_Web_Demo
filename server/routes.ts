import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import {
  insertExamSchema,
  insertQuestionSchema,
  insertSessionSchema,
  insertSubmissionSchema,
  registerSchema,
  loginSchema,
  type Question,
} from "@shared/schema";
import { hashPassword, sanitizeUser } from "./auth";

import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import passport from "passport";

// Lazy init — avoids crash on startup when API key is absent
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("No Anthropic API key found. Set ANTHROPIC_API_KEY in your .env file.");
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// ── Middleware helpers ────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

// Teachers that are still pending cannot create exams
function requireActiveTeacher(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (user?.status !== "active") {
    return res.status(403).json({ message: "Your account is pending admin validation. You cannot perform this action yet." });
  }
  next();
}


export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  /** POST /api/auth/register */
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Validation error" });
      }
      const { username, email, password, name, role, institution } = parsed.data;

      // Check for existing username / email
      const existingByUsername = await storage.getUserByUsername(username);
      if (existingByUsername) return res.status(409).json({ message: "Username already taken" });
      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) return res.status(409).json({ message: "Email already registered" });

      const passwordHash = await hashPassword(password);

      // Teachers start pending; students are immediately active
      const status = role === "teacher" ? "pending" : "active";

      const user = await storage.createUser({
        username, email, passwordHash, name, role, institution, status,
      });

      const safe = sanitizeUser(user);
      res.status(201).json({ user: safe, status });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  /** POST /api/auth/login */
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message ?? "Invalid credentials" });

      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json({ user: sanitizeUser(user) });
      });
    })(req, res, next);
  });

  /** POST /api/auth/logout */
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ success: true });
    });
  });

  /** GET /api/auth/me */
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json({ user: sanitizeUser(req.user as any) });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/admin/pending-teachers */
  app.get("/api/admin/pending-teachers", requireAuth, requireRole("admin"), async (_req, res) => {
    try {
      const teachers = await storage.getPendingTeachers();
      res.json(teachers.map(sanitizeUser));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pending teachers" });
    }
  });

  /** PATCH /api/admin/teachers/:id/validate */
  app.patch("/api/admin/teachers/:id/validate", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { approve } = z.object({ approve: z.boolean() }).parse(req.body);
      const teacher = await storage.validateTeacher(id, approve);
      res.json(sanitizeUser(teacher));
    } catch (err) {
      console.error("Validate teacher error:", err);
      res.status(500).json({ message: "Validation failed" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEACHER–STUDENT LINK ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/teacher/by-code/:code — look up a teacher by profile code */
  app.get("/api/teacher/by-code/:code", requireAuth, async (req, res) => {
    const teacher = await storage.getUserByProfileCode(req.params.code as string);
    if (!teacher || teacher.role !== "teacher")
      return res.status(404).json({ message: "No teacher found with that code" });
    // Return only safe fields
    res.json(sanitizeUser(teacher));
  });

  /** POST /api/links/request — student sends a link request to a teacher */
  app.post("/api/links/request", requireAuth, requireRole("student"), async (req, res) => {
    try {
      const student = req.user as any;
      const { teacherId } = z.object({ teacherId: z.number() }).parse(req.body);

      // Ensure teacher exists and is active
      const teacher = await storage.getUser(teacherId);
      if (!teacher || teacher.role !== "teacher" || teacher.status !== "active") {
        return res.status(404).json({ message: "Teacher not found or not yet active" });
      }

      // Prevent duplicate requests
      const existing = await storage.getLinkByTeacherAndStudent(teacherId, student.id);
      if (existing) {
        const msgs: Record<string, string> = {
          pending: "You already have a pending request to this teacher",
          accepted: "You are already linked to this teacher",
          declined: "Your previous request was declined. You cannot re-request.",
        };
        return res.status(409).json({ message: msgs[existing.status] ?? "Already requested" });
      }

      const link = await storage.createLink(teacherId, student.id);
      res.status(201).json(link);
    } catch (err) {
      console.error("Link request error:", err);
      res.status(500).json({ message: "Request failed" });
    }
  });

  /** GET /api/links/incoming — teacher fetches their pending link requests (with student info) */
  app.get("/api/links/incoming", requireAuth, requireRole("teacher", "admin"), async (req, res) => {
    try {
      const teacher = req.user as any;
      const links = await storage.getLinksByTeacher(teacher.id);

      // Attach student details to each link
      const enriched = await Promise.all(
        links.map(async (link) => {
          const student = await storage.getUser(link.studentId);
          return { ...link, student: student ? sanitizeUser(student) : null };
        })
      );
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  /** GET /api/links/my-teachers — student fetches their linked teachers */
  app.get("/api/links/my-teachers", requireAuth, requireRole("student"), async (req, res) => {
    try {
      const student = req.user as any;
      const links = await storage.getLinksByStudent(student.id);

      const enriched = await Promise.all(
        links.map(async (link) => {
          const teacher = await storage.getUser(link.teacherId);
          return { ...link, teacher: teacher ? sanitizeUser(teacher) : null };
        })
      );
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  /** PATCH /api/links/:id — teacher accepts or declines */
  app.patch("/api/links/:id", requireAuth, requireRole("teacher"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = z.object({ status: z.enum(["accepted", "declined"]) }).parse(req.body);

      const teacher = req.user as any;
      // Fetch to verify ownership
      const links = await storage.getLinksByTeacher(teacher.id);
      const link = links.find(l => l.id === id);
      if (!link) return res.status(404).json({ message: "Link request not found" });

      const updated = await storage.updateLink(id, status);
      res.json(updated);
    } catch (err) {
      console.error("Link respond error:", err);
      res.status(500).json({ message: "Failed to respond to request" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GRADING ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // Grading route — Phase 1: MCQs graded instantly and saved; Phase 2: AI runs in background
  app.post("/api/submissions/:id/grade", async (req, res) => {
    try {
      const submissionId = Number(req.params.id);
      const submission = await storage.getSubmission(submissionId);
      if (!submission)
        return res.status(404).json({ message: "Submission not found" });

      const session = await storage.getSession(submission.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });

      if (session.status !== "completed" && session.status !== "closed") {
        return res.status(400).json({ message: "Please, close exam before grading" });
      }

      const exam = await storage.getExam(submission.examId);
      const questions = await storage.getQuestions(submission.examId);

      // ── PHASE 1: Grade all MCQs instantly, set placeholders for open-ended ──
      type GradeEntry = { score: number; feedback: string; pending?: boolean };
      const grades: Record<string, GradeEntry> = {};
      let totalScore = 0;
      const openEndedQuestions: typeof questions = [];

      for (const q of questions) {
        const studentResponse = (submission.responses?.[q.id.toString()] || "").trim();

        if (q.type === "multiple_choice") {
          const answer = (q.correctAnswer || q.rubric || "").trim();
          const isCorrect =
            answer.length > 0 &&
            studentResponse.toLowerCase() === answer.toLowerCase();
          const grade: GradeEntry = {
            score: isCorrect ? q.points : 0,
            feedback: isCorrect
              ? `Correct! The answer is "${answer}".`
              : studentResponse.length === 0
                ? `No response provided. The correct answer is "${answer}".`
                : `Incorrect. You answered "${studentResponse}". The correct answer is "${answer}".`,
          };
          grades[q.id.toString()] = grade;
          totalScore += grade.score;
        } else {
          grades[q.id.toString()] = {
            score: 0,
            feedback: "AI grading in progress...",
            pending: true,
          };
          openEndedQuestions.push(q);
        }
      }

      const updated = await storage.updateSubmission(submissionId, {
        grades: grades as any,
        totalScore,
        status: "submitted",
      });

      res.json(updated);

      // ── PHASE 2: Grade open-ended questions in the background ──────────────
      if (openEndedQuestions.length === 0) return;

      const limit = pLimit(2);

      Promise.all(
        openEndedQuestions.map((q) =>
          limit(async () => {
            const studentResponse = (submission.responses?.[q.id.toString()] || "").trim();
            const responseText = studentResponse.length > 0 ? studentResponse : "No response provided.";

            const prompt = `
You are a strict, fair examiner grading a student's response for the subject: ${exam?.subject}.
Question: ${q.text}
Rubric/Criteria: ${q.rubric || "Use your best judgement based on the question."}
Student Response: "${responseText}"

Evaluate the response and provide a score from 0 to ${q.points}.
If the answer is nonsense or off-topic, give a low score and flag it. Do not reward irrelevant content.
Be consistent.
Also provide a brief, professional feedback explaining the score.

Return ONLY a JSON object: { "score": number, "feedback": string }
            `.trim();

            let result: GradeEntry;
            try {
              const aiResponse = await getAnthropic().messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 256,
                messages: [{ role: "user", content: prompt }],
              });
              const rawText =
                aiResponse.content[0]?.type === "text"
                  ? aiResponse.content[0].text
                  : '{"score":0,"feedback":"Grading error."}';
              result = JSON.parse(rawText) as GradeEntry;
            } catch (aiErr) {
              console.error(`AI grading failed for question ${q.id}:`, aiErr);
              result = {
                score: 0,
                feedback: "AI grading failed — please review and score this response manually.",
              };
            }

            const current = await storage.getSubmission(submissionId);
            if (!current) return;
            const mergedGrades: Record<string, GradeEntry> = {
              ...(current.grades as any),
              [q.id.toString()]: result,
            };
            const newTotal = Object.values(mergedGrades).reduce(
              (sum, g) => sum + ((g as any).pending ? 0 : g.score || 0),
              0
            );
            await storage.updateSubmission(submissionId, {
              grades: mergedGrades as any,
              totalScore: newTotal,
            });
          })
        )
      ).catch((err) => console.error("Background AI grading error:", err));

    } catch (err) {
      console.error("Grading Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Grading failed" });
      }
    }
  });

  // Exam-level batch grading
  app.post("/api/exams/:id/grade-all", async (req, res) => {
    try {
      const examId = Number(req.params.id);
      const exam = await storage.getExam(examId);
      if (!exam) return res.status(404).json({ message: "Exam not found" });

      const questions = await storage.getQuestions(examId);
      if (questions.length === 0)
        return res.status(400).json({ message: "Exam has no questions" });

      const allSubmissions = await storage.getSubmissionsByExam(examId);
      const toGrade = allSubmissions.filter(s => s.status !== "graded");

      if (toGrade.length === 0)
        return res.status(200).json({ message: "All submissions already graded", queued: 0 });

      type GradeEntry = { score: number; feedback: string; pending?: boolean };

      const mcqQuestions = questions.filter(q => q.type === "multiple_choice");
      const openQuestions = questions.filter(q => q.type !== "multiple_choice");

      const submissionGrades = new Map<number, Record<string, GradeEntry>>();
      const submissionMCQTotals = new Map<number, number>();

      for (const sub of toGrade) {
        const grades: Record<string, GradeEntry> = {};
        let mcqTotal = 0;

        for (const q of mcqQuestions) {
          const studentResponse = ((sub.responses as any)?.[q.id.toString()] || "").trim();
          const answer = (q.correctAnswer || q.rubric || "").trim();
          const isCorrect = answer.length > 0 && studentResponse.toLowerCase() === answer.toLowerCase();
          grades[q.id.toString()] = {
            score: isCorrect ? q.points : 0,
            feedback: isCorrect
              ? `Correct! The answer is "${answer}".`
              : studentResponse.length === 0
                ? `No response provided. The correct answer is "${answer}".`
                : `Incorrect. You answered "${studentResponse}". The correct answer is "${answer}".`,
          };
          mcqTotal += isCorrect ? q.points : 0;
        }

        for (const q of openQuestions) {
          grades[q.id.toString()] = { score: 0, feedback: "AI grading in progress...", pending: true };
        }

        submissionGrades.set(sub.id, grades);
        submissionMCQTotals.set(sub.id, mcqTotal);

        await storage.updateSubmission(sub.id, {
          grades: grades as any,
          totalScore: mcqTotal,
          status: openQuestions.length === 0 ? "graded" : "submitted",
        });
      }

      res.json({ queued: toGrade.length, message: "MCQs graded. AI grading open-ended questions in background." });

      if (openQuestions.length === 0) return;

      const limit = pLimit(2);

      await Promise.all(
        openQuestions.map(q =>
          limit(async () => {
            const responseLines = toGrade
              .map(sub => {
                const resp = ((sub.responses as any)?.[q.id.toString()] || "").trim();
                return `[${sub.studentId}]: "${resp.length > 0 ? resp : "No response provided."}"`;
              })
              .join("\n");

            const prompt = `
You are a strict, fair examiner grading a student exam for the subject: ${exam.subject}.

Question: ${q.text}
Rubric / Grading Criteria: ${q.rubric || "Use your best judgement based on the question."}
Maximum score per student: ${q.points}

Grade EACH student's response below. Be consistent across all students.
Do NOT reward irrelevant or off-topic content.

Student responses (format: [studentId]: "response"):
${responseLines}

Return ONLY a valid JSON object in this exact format — one entry per studentId:
{ "[studentId]": { "score": number, "feedback": string }, ... }
            `.trim();

            let results: Record<string, GradeEntry>;
            try {
              const aiResponse = await getAnthropic().messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 1024,
                messages: [{ role: "user", content: prompt }],
              });
              const rawText =
                aiResponse.content[0]?.type === "text"
                  ? aiResponse.content[0].text
                  : "{}";
              results = JSON.parse(rawText);
            } catch (aiErr) {
              console.error(`Batch AI grading failed for question ${q.id}:`, aiErr);
              results = Object.fromEntries(
                toGrade.map(sub => [
                  sub.studentId.toString(),
                  { score: 0, feedback: "AI grading failed — please score manually." },
                ])
              );
            }

            await Promise.all(
              toGrade.map(async sub => {
                const result: GradeEntry = results[sub.studentId.toString()] ?? {
                  score: 0,
                  feedback: "No AI result returned — please score manually.",
                };

                const current = await storage.getSubmission(sub.id);
                if (!current) return;

                const mergedGrades: Record<string, GradeEntry> = {
                  ...(current.grades as any),
                  [q.id.toString()]: result,
                };

                const newTotal = Object.values(mergedGrades).reduce(
                  (sum, g) => sum + ((g as any).pending ? 0 : (g.score || 0)),
                  0
                );

                await storage.updateSubmission(sub.id, {
                  grades: mergedGrades as any,
                  totalScore: newTotal,
                });
              })
            );
          })
        )
      ).catch(err => console.error("Batch AI grading error:", err));

    } catch (err) {
      console.error("Grade-All Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Batch grading failed" });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXISTING RESOURCE ROUTES
  // (protected with requireAuth where appropriate)
  // ═══════════════════════════════════════════════════════════════════════════

  // Users
  app.get(api.users.list.path, requireAuth, async (req, res) => {
    // Both admin and teacher need access to map user IDs to names. 
    // Admin needs all users. Teacher technically only needs their linked students,
    // but returning sanitized users is safe here for the MVP.
    const user = req.user as any;
    if (user.role !== "admin" && user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied" });
    }
    const users = await storage.getUsers();
    res.json(users.map(sanitizeUser));
  });

  // Exams
  app.get(api.exams.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;

    if (user.role === "student") {
      // Students only see published exams from teachers they are accepted-linked with
      const linkedTeacherIds = await storage.getLinkedTeacherIds(user.id);
      if (linkedTeacherIds.length === 0) return res.json([]);
      const allExams = await storage.getExams();
      const visible = allExams.filter(
        e => linkedTeacherIds.includes(e.teacherId) && e.status === "published"
      );
      return res.json(visible);
    }

    // Teachers see their own exams; admins see all
    const teacherId = req.query.teacherId
      ? Number(req.query.teacherId)
      : undefined;
    const exams = await storage.getExams(teacherId);
    res.json(exams);
  });

  app.post(api.exams.create.path, requireAuth, requireRole("teacher", "admin"), requireActiveTeacher, async (req, res) => {
    try {
      const exam = await storage.createExam(req.body);
      res.status(201).json(exam);
    } catch (err) {
      console.error("Exam Creation Error:", err);
      res.status(500).json({ message: "Failed to create exam" });
    }
  });

  app.get(api.exams.get.path, requireAuth, async (req, res) => {
    const exam = await storage.getExam(Number(req.params.id));
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json(exam);
  });

  // Questions
  app.get(api.questions.list.path, requireAuth, async (req, res) => {
    const questions = await storage.getQuestions(Number(req.params.examId));
    res.json(questions);
  });

  app.post(api.questions.create.path, requireAuth, requireRole("teacher", "admin"), requireActiveTeacher, async (req, res) => {
    const examId = Number(req.params.examId);
    const input = api.questions.create.input.parse(req.body);
    const question = await storage.createQuestion({ ...input, examId });
    res.status(201).json(question);
  });

  // Sessions
  app.get(api.sessions.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const examId = req.query.examId ? Number(req.query.examId) : undefined;

    if (user.role === "student") {
      // Only expose sessions for exams from accepted linked teachers
      const linkedTeacherIds = await storage.getLinkedTeacherIds(user.id);
      if (linkedTeacherIds.length === 0) return res.json([]);
      const allSessions = await storage.getSessions(examId);
      const allExams = await storage.getExams();
      const linkedExamIds = new Set(
        allExams
          .filter(e => linkedTeacherIds.includes(e.teacherId))
          .map(e => e.id)
      );
      return res.json(allSessions.filter(s => linkedExamIds.has(s.examId)));
    }

    const sessions = await storage.getSessions(examId);
    res.json(sessions);
  });

  app.post(api.sessions.create.path, requireAuth, requireRole("teacher", "admin"), requireActiveTeacher, async (req, res) => {
    const input = api.sessions.create.input.parse(req.body);
    const exam = await storage.getExam(input.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.status !== "published") {
      return res.status(400).json({ message: "Exam is not published" });
    }

    const questions = await storage.getQuestions(input.examId);
    if (questions.length === 0) {
      return res.status(400).json({ message: "Exam has no questions" });
    }

    const session = await storage.createSession(input);
    res.status(201).json(session);
  });

  app.get(api.sessions.get.path, requireAuth, async (req, res) => {
    const session = await storage.getSession(Number(req.params.id));
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  // Submissions
  app.get("/api/submissions/exam/:examId", requireAuth, async (req, res) => {
    const examId = Number(req.params.examId);
    const examSubmissions = await storage.getSubmissionsByExam(examId);
    res.json(examSubmissions);
  });

  app.get("/api/submissions/student/:studentId", requireAuth, async (req, res) => {
    const studentId = Number(req.params.studentId);
    const studentSubmissions = await storage.getSubmissionsByStudent(studentId);
    res.json(studentSubmissions);
  });

  app.post(api.submissions.create.path, requireAuth, async (req, res) => {
    const input = api.submissions.create.input.parse(req.body);

    const existing = await storage.getSubmissionsByStudent(input.studentId);
    const alreadyExists = existing.some((s) => s.examId === input.examId);
    if (alreadyExists) {
      return res.status(400).json({
        message: "You already have an active session or submission for this exam.",
      });
    }

    const submission = await storage.createSubmission(input);
    res.status(201).json(submission);
  });

  app.patch(api.submissions.update.path, requireAuth, async (req, res) => {
    const input = api.submissions.update.input.parse(req.body);
    const submission = await storage.updateSubmission(
      Number(req.params.id),
      input,
    );
    res.json(submission);
  });

  // Publish Exam
  app.patch(api.exams.publish.path, requireAuth, requireRole("teacher", "admin"), requireActiveTeacher, async (req, res) => {
    const examId = Number(req.params.id);
    const questions = await storage.getQuestions(examId);

    if (questions.length === 0) {
      return res
        .status(400)
        .json({ message: "Cannot publish exam without questions" });
    }

    const exam = await storage.publishExam(examId);
    res.json(exam);
  });

  app.patch(api.exams.update.path, requireAuth, requireRole("teacher", "admin"), async (req, res) => {
    const exam = await storage.updateExam(Number(req.params.id), req.body);
    res.json(exam);
  });

  app.delete(api.exams.delete.path, requireAuth, requireRole("teacher", "admin"), requireActiveTeacher, async (req, res) => {
    await storage.deleteExam(Number(req.params.id));
    res.json({ success: true });
  });

  // Get Submissions by Exam
  app.get(api.submissions.listByExam.path, requireAuth, async (req, res) => {
    const submissions = await storage.getSubmissionsByExam(
      Number(req.params.examId),
    );
    res.json(submissions);
  });

  // === SEED DATA ===
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingUsers = await storage.getUsers();
  if (existingUsers.length === 0) {
    console.log("Seeding database...");
    const { hashPassword, generateProfileCode } = await import("./auth");

    // Seed admin (immediately active)
    const adminHash = await hashPassword("admin123");
    await storage.createUser({
      username: "admin",
      email: "admin@gradeint.app",
      passwordHash: adminHash,
      name: "System Administrator",
      role: "admin",
      status: "active",
    });

    // Seed teacher (immediately active for demo — skip pending flow)
    const teacherHash = await hashPassword("teacher123");
    const teacherProfileCode = await generateProfileCode();
    const teacher = await db.insert(schema.users).values({
      username: "teacher",
      email: "teacher@gradeint.app",
      passwordHash: teacherHash,
      name: "Sarah Connor",
      role: "teacher",
      status: "active",
      profileCode: teacherProfileCode,
      validatedAt: new Date(),
      avatarUrl: "https://i.pravatar.cc/150?u=teacher",
    }).returning().then(r => r[0]);

    // Seed student (active immediately)
    const studentHash = await hashPassword("student123");
    await storage.createUser({
      username: "student",
      email: "student@gradeint.app",
      passwordHash: studentHash,
      name: "John Doe",
      role: "student",
      status: "active",
    });

    // Seed Sample Exam
    if (teacher) {
      const exam = await storage.createExam({
        title: "Mid-Term Physics Assessment",
        subject: "Physics",
        description: "Comprehensive assessment covering mechanics and thermodynamics.",
        durationMinutes: 90,
        teacherId: teacher.id,
        status: "published",
      });

      await storage.createQuestion({
        examId: exam.id,
        text: "Explain Newton's Second Law of Motion.",
        type: "short_answer",
        points: 5,
        order: 1,
        rubric: "Must mention F=ma and relation between force, mass, and acceleration.",
      });

      await storage.createQuestion({
        examId: exam.id,
        text: "Which of the following is a unit of energy?",
        type: "multiple_choice",
        options: ["Joule", "Newton", "Watt", "Pascal"],
        correctAnswer: "Joule",
        points: 2,
        order: 2,
      });

      await storage.createQuestion({
        examId: exam.id,
        text: "Describe the efficiency of a Carnot engine.",
        type: "essay",
        points: 10,
        order: 3,
        rubric: "Discuss temperature dependence and maximum theoretical efficiency.",
      });

      await storage.createSession({
        examId: exam.id,
        accessCode: "PHYS-2024",
        status: "active",
      });
    }
    console.log("Seeding complete.");
    console.log("Seed credentials:");
    console.log("  admin   / admin123");
    console.log("  teacher / teacher123");
    console.log("  student / student123");
  }
}

import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
