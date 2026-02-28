import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import {
  insertExamSchema,
  insertQuestionSchema,
  insertSessionSchema,
  insertSubmissionSchema,
  type Question,
} from "@shared/schema";

import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";

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


export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // === API ROUTES ===

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
          // Placeholder — AI will fill this in during Phase 2
          grades[q.id.toString()] = {
            score: 0,
            feedback: "AI grading in progress...",
            pending: true,
          };
          openEndedQuestions.push(q);
        }
      }

      // Save MCQ results and pending placeholders immediately, then respond
      const updated = await storage.updateSubmission(submissionId, {
        grades: grades as any,
        totalScore,
        status: "submitted",
      });

      res.json(updated); // ← client gets result right away

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

            // Merge this result into the live DB record (fetch-merge-save)
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

  // Exam-level batch grading — grades ALL ungraded submissions for an exam at once
  // MCQs: instant in-process. Open-ended: one Claude call per question, all students in one prompt.
  app.post("/api/exams/:id/grade-all", async (req, res) => {
    try {
      const examId = Number(req.params.id);
      const exam = await storage.getExam(examId);
      if (!exam) return res.status(404).json({ message: "Exam not found" });

      const questions = await storage.getQuestions(examId);
      if (questions.length === 0)
        return res.status(400).json({ message: "Exam has no questions" });

      // Only grade submissions that are not already graded
      const allSubmissions = await storage.getSubmissionsByExam(examId);
      const toGrade = allSubmissions.filter(s => s.status !== "graded");

      if (toGrade.length === 0)
        return res.status(200).json({ message: "All submissions already graded", queued: 0 });

      type GradeEntry = { score: number; feedback: string; pending?: boolean };

      // ── PHASE 1: Grade all MCQs instantly for every submission ──────────────
      const mcqQuestions = questions.filter(q => q.type === "multiple_choice");
      const openQuestions = questions.filter(q => q.type !== "multiple_choice");

      // Initialise each submission's grade map with MCQ results + pending placeholders
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

        // Save MCQ results — if no open-ended questions, grading is complete
        await storage.updateSubmission(sub.id, {
          grades: grades as any,
          totalScore: mcqTotal,
          status: openQuestions.length === 0 ? "graded" : "submitted",
        });
      }

      // Respond immediately — client can start refetch polling
      res.json({ queued: toGrade.length, message: "MCQs graded. AI grading open-ended questions in background." });

      // ── PHASE 2: Per-question batch AI grading across all students ──────────
      if (openQuestions.length === 0) return;

      const limit = pLimit(2); // max 2 Claude calls in parallel

      await Promise.all(
        openQuestions.map(q =>
          limit(async () => {
            // Build one prompt with all students' responses for this question
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
              // Fallback: mark as manual review needed
              results = Object.fromEntries(
                toGrade.map(sub => [
                  sub.studentId.toString(),
                  { score: 0, feedback: "AI grading failed — please score manually." },
                ])
              );
            }

            // Merge this question's results into each submission
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

  // Users
  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  // Exams
  app.get(api.exams.list.path, async (req, res) => {
    const teacherId = req.query.teacherId
      ? Number(req.query.teacherId)
      : undefined;
    const exams = await storage.getExams(teacherId);
    res.json(exams);
  });

  app.post(api.exams.create.path, async (req, res) => {
    try {
      const exam = await storage.createExam(req.body);
      res.status(201).json(exam);
    } catch (err) {
      console.error("Exam Creation Error:", err);
      res.status(500).json({ message: "Failed to create exam" });
    }
  });

  app.get(api.exams.get.path, async (req, res) => {
    const exam = await storage.getExam(Number(req.params.id));
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json(exam);
  });

  // Questions
  app.get(api.questions.list.path, async (req, res) => {
    const questions = await storage.getQuestions(Number(req.params.examId));
    res.json(questions);
  });

  app.post(api.questions.create.path, async (req, res) => {
    const examId = Number(req.params.examId);
    const input = api.questions.create.input.parse(req.body);
    const question = await storage.createQuestion({ ...input, examId });
    res.status(201).json(question);
  });

  // Sessions
  app.get(api.sessions.list.path, async (req, res) => {
    const examId = req.query.examId ? Number(req.query.examId) : undefined;
    const sessions = await storage.getSessions(examId);
    res.json(sessions);
  });

  app.post(api.sessions.create.path, async (req, res) => {
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

  app.get(api.sessions.get.path, async (req, res) => {
    const session = await storage.getSession(Number(req.params.id));
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  // Submissions
  app.get("/api/submissions/exam/:examId", async (req, res) => {
    const examId = Number(req.params.examId);
    const examSubmissions = await storage.getSubmissionsByExam(examId);
    res.json(examSubmissions);
  });

  app.get("/api/submissions/student/:studentId", async (req, res) => {
    const studentId = Number(req.params.studentId);
    const studentSubmissions = await storage.getSubmissionsByStudent(studentId);
    res.json(studentSubmissions);
  });

  app.post(api.submissions.create.path, async (req, res) => {
    const input = api.submissions.create.input.parse(req.body);

    // Enforce one active session/submission per student per exam
    const existing = await storage.getSubmissionsByStudent(input.studentId);
    const alreadyExists = existing.some((s) => s.examId === input.examId);
    if (alreadyExists) {
      return res.status(400).json({
        message:
          "You already have an active session or submission for this exam.",
      });
    }

    const submission = await storage.createSubmission(input);
    res.status(201).json(submission);
  });

  app.patch(api.submissions.update.path, async (req, res) => {
    const input = api.submissions.update.input.parse(req.body);
    const submission = await storage.updateSubmission(
      Number(req.params.id),
      input,
    );
    res.json(submission);
  });

  // Publish Exam
  app.patch(api.exams.publish.path, async (req, res) => {
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

  app.patch(api.exams.update.path, async (req, res) => {
    const exam = await storage.updateExam(Number(req.params.id), req.body);
    res.json(exam);
  });

  app.delete(api.exams.delete.path, async (req, res) => {
    await storage.deleteExam(Number(req.params.id));
    res.json({ success: true });
  });

  // Get Submissions by Exam
  app.get(api.submissions.listByExam.path, async (req, res) => {
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
  const users = await storage.getUsers();
  if (users.length === 0) {
    console.log("Seeding database...");

    // Seed Users
    await db.insert(schema.users).values([
      {
        username: "admin",
        name: "System Administrator",
        role: "admin",
        avatarUrl: "https://github.com/shadcn.png",
      },
      {
        username: "teacher",
        name: "Sarah Connor",
        role: "teacher",
        avatarUrl: "https://i.pravatar.cc/150?u=teacher",
      },
      {
        username: "student",
        name: "John Doe",
        role: "student",
        avatarUrl: "https://i.pravatar.cc/150?u=student",
      },
    ]);

    // Seed Sample Exam
    const [teacher] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, "teacher"));
    if (teacher) {
      const exam = await storage.createExam({
        title: "Mid-Term Physics Assessment",
        subject: "Physics",
        description:
          "Comprehensive assessment covering mechanics and thermodynamics.",
        durationMinutes: 90,
        teacherId: teacher.id,
        status: "published",
      });

      // Seed Questions
      await storage.createQuestion({
        examId: exam.id,
        text: "Explain Newton's Second Law of Motion.",
        type: "short_answer",
        points: 5,
        order: 1,
        rubric:
          "Must mention F=ma and relation between force, mass, and acceleration.",
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
        rubric:
          "Discuss temperature dependence and maximum theoretical efficiency.",
      });

      // Seed Session
      await storage.createSession({
        examId: exam.id,
        accessCode: "PHYS-2024",
        status: "active",
      });
    }
    console.log("Seeding complete.");
  }
}

import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
