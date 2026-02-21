import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Mock users for the prototype (no real auth)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "teacher", "student", "invigilator"] }).notNull(),
  avatarUrl: text("avatar_url"),
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  teacherId: integer("teacher_id").notNull(),
  accessCode: text("access_code").notNull().unique(),
  status: text("status", { enum: ["draft", "published", "closed", "archived"] }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  text: text("text").notNull(),
  type: text("type", { enum: ["multiple_choice", "short_answer", "essay"] }).notNull(),
  // For MCQ: ["Option A", "Option B", ...]
  options: jsonb("options").$type<string[]>(),
  // For auto-grading/simulation
  correctAnswer: text("correct_answer"),
  // Grading rubric/criteria for the AI simulator
  rubric: text("rubric"),
  points: integer("points").notNull().default(1),
  order: integer("order").notNull(),
});

export const examSessions = pgTable("exam_sessions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  accessCode: text("access_code").notNull(),
  status: text("status", { enum: ["active", "completed", "locked", "inactive", "closed"] }).notNull().default("active"),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  studentId: integer("student_id").notNull(),
  examId: integer("exam_id").notNull(),
  status: text("status", { enum: ["in_progress", "submitted", "graded"] }).notNull().default("in_progress"),
  startedAt: timestamp("started_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
  // Stores answers: { [questionId]: "student answer" }
  responses: jsonb("responses").$type<Record<string, string>>(),
  // Stores grades: { [questionId]: { score: number, feedback: string } }
  grades: jsonb("grades").$type<Record<string, { score: number, feedback: string }>>(),
  totalScore: integer("total_score"),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertExamSchema = createInsertSchema(exams).omit({ id: true, createdAt: true, updatedAt: true, accessCode: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true });
export const insertSessionSchema = createInsertSchema(examSessions).omit({ id: true, startTime: true, endTime: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, startedAt: true, submittedAt: true, grades: true, totalScore: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type ExamSession = typeof examSessions.$inferSelect;
export type Submission = typeof submissions.$inferSelect;

export type CreateExamRequest = z.infer<typeof insertExamSchema>;
export type CreateQuestionRequest = z.infer<typeof insertQuestionSchema>;
export type CreateSessionRequest = z.infer<typeof insertSessionSchema>;
export type CreateSubmissionRequest = z.infer<typeof insertSubmissionSchema>;
export type UpdateSubmissionRequest = Partial<Submission>;

export type UpdateExamRequest = { status: "published" | "archived" };

export * from "./models/chat";
