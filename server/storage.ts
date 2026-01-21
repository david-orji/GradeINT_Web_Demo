import { db } from "./db";
import { 
  users, exams, questions, examSessions, submissions,
  type User, type Exam, type Question, type ExamSession, type Submission,
  type CreateExamRequest, type CreateQuestionRequest, type CreateSessionRequest, 
  type CreateSubmissionRequest, type UpdateSubmissionRequest
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  
  // Exams
  getExams(teacherId?: number): Promise<Exam[]>;
  getExam(id: number): Promise<Exam | undefined>;
  createExam(exam: CreateExamRequest): Promise<Exam>;
  updateExam(id: number, updates: Partial<CreateExamRequest>): Promise<Exam>;
  deleteExam(id: number): Promise<void>;
  publishExam(id: number): Promise<Exam>;
  
  // Questions
  getQuestions(examId: number): Promise<Question[]>;
  createQuestion(question: CreateQuestionRequest): Promise<Question>;
  
  // Sessions
  getSessions(examId?: number): Promise<ExamSession[]>;
  getSession(id: number): Promise<ExamSession | undefined>;
  createSession(session: CreateSessionRequest): Promise<ExamSession>;
  
  // Submissions
  getSubmissions(sessionId: number): Promise<Submission[]>;
  getSubmissionsByExam(examId: number): Promise<Submission[]>;
  createSubmission(submission: CreateSubmissionRequest): Promise<Submission>;
  updateSubmission(id: number, updates: UpdateSubmissionRequest): Promise<Submission>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getExams(teacherId?: number): Promise<Exam[]> {
    if (teacherId) {
      return await db.select().from(exams).where(eq(exams.teacherId, teacherId)).orderBy(desc(exams.createdAt));
    }
    return await db.select().from(exams).orderBy(desc(exams.createdAt));
  }

  async getExam(id: number): Promise<Exam | undefined> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, id));
    return exam;
  }

  async createExam(exam: CreateExamRequest): Promise<Exam> {
    const accessCode = this.generateAccessCode();
    const [newExam] = await db.insert(exams).values({ ...exam, accessCode }).returning();
    
    // Auto-create a session for the published exam to make it immediately testable
    if (exam.status === "published") {
      await db.insert(examSessions).values({
        examId: newExam.id,
        accessCode: accessCode,
        status: "active",
      });
    }
    return newExam;
  }

  private generateAccessCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async updateExam(id: number, updates: Partial<CreateExamRequest>): Promise<Exam> {
    const [updated] = await db.update(exams).set(updates).where(eq(exams.id, id)).returning();
    if (!updated) throw new Error("Exam not found");
    return updated;
  }

  async deleteExam(id: number): Promise<void> {
    await db.delete(questions).where(eq(questions.examId, id));
    await db.delete(exams).where(eq(exams.id, id));
  }

  async publishExam(id: number): Promise<Exam> {
    const [updated] = await db.update(exams).set({ status: "published" }).where(eq(exams.id, id)).returning();
    
    // Create an active session when an exam is published
    await db.insert(examSessions).values({
      examId: updated.id,
      accessCode: updated.accessCode,
      status: "active",
    });
    
    return updated;
  }

  async getQuestions(examId: number): Promise<Question[]> {
    return await db.select().from(questions).where(eq(questions.examId, examId)).orderBy(questions.order);
  }

  async createQuestion(question: CreateQuestionRequest): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getSessions(examId?: number): Promise<ExamSession[]> {
    if (examId) {
      return await db.select().from(examSessions).where(eq(examSessions.examId, examId)).orderBy(desc(examSessions.startTime));
    }
    return await db.select().from(examSessions).orderBy(desc(examSessions.startTime));
  }

  async getSession(id: number): Promise<ExamSession | undefined> {
    const [session] = await db.select().from(examSessions).where(eq(examSessions.id, id));
    return session;
  }

  async createSession(session: CreateSessionRequest): Promise<ExamSession> {
    const [newSession] = await db.insert(examSessions).values(session).returning();
    return newSession;
  }

  async getSubmissions(sessionId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.sessionId, sessionId));
  }

  async createSubmission(submission: CreateSubmissionRequest): Promise<Submission> {
    const [newSubmission] = await db.insert(submissions).values(submission).returning();
    return newSubmission;
  }

  async updateSubmission(id: number, updates: UpdateSubmissionRequest): Promise<Submission> {
    const [updated] = await db.update(submissions).set(updates).where(eq(submissions.id, id)).returning();
    return updated;
  }

  async getSubmissionsByExam(examId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.examId, examId));
  }
}

export const storage = new DatabaseStorage();
