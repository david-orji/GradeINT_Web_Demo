import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const exams = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cloud_exam_id: text("cloud_exam_id").notNull(),
  access_code: text("access_code").notNull().unique(),
  title: text("title").notNull(),
  package_data: text("package_data").notNull(), // JSON string of ExamPackage
  checksum: text("checksum").notNull(),
  downloaded_at: integer("downloaded_at"),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exam_id: integer("exam_id").notNull(),
  session_code: text("session_code").notNull().unique(),
  status: text("status", { enum: ["pending", "active", "closed", "synced"] }).notNull().default("pending"),
  activated_at: integer("activated_at"),
  closed_at: integer("closed_at"),
});

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  session_id: integer("session_id").notNull(),
  student_id: text("student_id").notNull(),
  student_name: text("student_name").notNull(),
  answers: text("answers").notNull(),
  sealed_at: integer("sealed_at"),
  synced_at: integer("synced_at"),
  sync_attempts: integer("sync_attempts").notNull().default(0),
  checksum: text("checksum"),
});
