import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertExamSchema, insertQuestionSchema, insertSessionSchema, insertSubmissionSchema, type Question } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === API ROUTES ===

  // Users
  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  // Exams
  app.get(api.exams.list.path, async (req, res) => {
    const teacherId = req.query.teacherId ? Number(req.query.teacherId) : undefined;
    const exams = await storage.getExams(teacherId);
    res.json(exams);
  });

  app.post(api.exams.create.path, async (req, res) => {
    try {
      const input = api.exams.create.input.parse(req.body);
      const exam = await storage.createExam(input);
      res.status(201).json(exam);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
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
    const session = await storage.createSession(input);
    res.status(201).json(session);
  });

  app.get(api.sessions.get.path, async (req, res) => {
    const session = await storage.getSession(Number(req.params.id));
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  });

  // Submissions
  app.get(api.submissions.list.path, async (req, res) => {
    const submissions = await storage.getSubmissions(Number(req.params.sessionId));
    res.json(submissions);
  });

  app.post(api.submissions.create.path, async (req, res) => {
    const input = api.submissions.create.input.parse(req.body);
    const submission = await storage.createSubmission(input);
    res.status(201).json(submission);
  });

  app.patch(api.submissions.update.path, async (req, res) => {
    const input = api.submissions.update.input.parse(req.body);
    const submission = await storage.updateSubmission(Number(req.params.id), input);
    res.json(submission);
  });

  // Publish Exam
  app.patch(api.exams.publish.path, async (req, res) => {
    const exam = await storage.publishExam(Number(req.params.id));
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
    const submissions = await storage.getSubmissionsByExam(Number(req.params.examId));
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
      { username: "admin", name: "System Administrator", role: "admin", avatarUrl: "https://github.com/shadcn.png" },
      { username: "teacher", name: "Sarah Connor", role: "teacher", avatarUrl: "https://i.pravatar.cc/150?u=teacher" },
      { username: "student", name: "John Doe", role: "student", avatarUrl: "https://i.pravatar.cc/150?u=student" },
    ]);

    // Seed Sample Exam
    const [teacher] = await db.select().from(schema.users).where(eq(schema.users.role, "teacher"));
    if (teacher) {
      const exam = await storage.createExam({
        title: "Mid-Term Physics Assessment",
        subject: "Physics",
        description: "Comprehensive assessment covering mechanics and thermodynamics.",
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
