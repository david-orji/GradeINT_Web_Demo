import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const exams = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cloudExamId: text("cloud_exam_id").notNull(),
  accessCode: text("access_code").notNull().unique(),
  title: text("title").notNull(),
  packageData: text("package_data").notNull(), // JSON string of ExamPackage
  checksum: text("checksum").notNull(),
  downloadedAt: integer("downloaded_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").references(() => exams.id).notNull(),
  status: text("status", { enum: ["active", "closed", "synced"] }).notNull().default("active"),
  startedAt: integer("started_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  sealedAt: integer("sealed_at", { mode: 'timestamp' }),
});

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => sessions.id).notNull(),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(), // Optional: local name capture
  clientIp: text("client_ip").notNull(),
  answersData: text("answers_data").notNull().default("[]"), // JSON array of Answer
  status: text("status", { enum: ["connected", "in_progress", "submitted", "sealed"] }).notNull().default("connected"),
  lastAutosaveAt: integer("last_autosave_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  sealedAt: integer("sealed_at", { mode: 'timestamp' }),
});

export const insertExamSchema = createInsertSchema(exams);
export const selectExamSchema = createSelectSchema(exams);
export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);
export const insertSubmissionSchema = createInsertSchema(submissions);
export const selectSubmissionSchema = createSelectSchema(submissions);
