import { db } from "./db";
import { 
  users, exams, questions, examSessions, submissions,
  type User, type Exam, type Question, type ExamSession, type Submission,
  type CreateExamRequest, type CreateQuestionRequest, type CreateSessionRequest, 
  type CreateSubmissionRequest, type UpdateSubmissionRequest
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

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
  getSubmissionsByExam(examId: number): Promise<Submission[]>;
  getSubmissionsByStudent(studentId: number): Promise<Submission[]>;
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionByStudentAndExam(studentId: number, examId: number): Promise<Submission | undefined>;
  createSubmission(submission: CreateSubmissionRequest): Promise<Submission>;
  updateSubmission(id: number, updates: Partial<Submission>): Promise<Submission>;
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
    const { questions: questionsData, ...examFields } = exam as any;
    const accessCode = this.generateAccessCode();
    const [newExam] = await db.insert(exams).values({ ...examFields, accessCode }).returning();
    
    // If questions are provided, add them
    if (questionsData && Array.isArray(questionsData) && questionsData.length > 0) {
      console.log(`Adding ${questionsData.length} questions to exam ${newExam.id}`);
      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i];
        await db.insert(questions).values({
          examId: newExam.id,
          text: q.text,
          type: q.type as "multiple_choice" | "short_answer" | "essay",
          points: q.points || 1,
          options: q.options || [],
          rubric: q.rubric || "",
          order: i + 1
        });
      }
    }

    // Auto-create a session for the published exam to make it immediately testable
    if (examFields.status === "published") {
      // Check if questions were actually added before creating session
      const [qCount] = await db.select({ count: sql<number>`count(*)` }).from(questions).where(eq(questions.examId, newExam.id));
      if (Number(qCount.count) > 0) {
        await db.insert(examSessions).values({
          examId: newExam.id,
          accessCode: accessCode,
          status: "active",
        });
      }
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
    const { questions: questionsData, ...examFields } = updates as any;
    
    // If we're closing the exam, also close associated active sessions
    if (examFields.status === "closed") {
      await db.update(examSessions)
        .set({ status: "inactive" })
        .where(eq(examSessions.examId, id));
    }

    const [updated] = await db.update(exams)
      .set(examFields)
      .where(eq(exams.id, id))
      .returning();
      
    if (!updated) throw new Error("Exam not found");

    if (questionsData && Array.isArray(questionsData)) {
      console.log(`Updating ${questionsData.length} questions for exam ${id}`);
      await db.delete(questions).where(eq(questions.examId, id));
      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i];
        await db.insert(questions).values({
          examId: id,
          text: q.text,
          type: q.type as "multiple_choice" | "short_answer" | "essay",
          points: q.points || 1,
          options: q.options || [],
          rubric: q.rubric || "",
          order: i + 1
        });
      }
    }

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
    const [newQuestion] = await db.insert(questions).values({
      ...question,
      type: question.type as "multiple_choice" | "short_answer" | "essay"
    }).returning();
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

  async getSubmissions(sessionId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.sessionId, sessionId));
  }

  async createSession(session: CreateSessionRequest): Promise<ExamSession> {
    const [newSession] = await db.insert(examSessions).values(session).returning();
    return newSession;
  }

  async getSubmissionsByExam(examId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.examId, examId));
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission;
  }

  async getSubmissionsByStudent(studentId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.studentId, studentId));
  }

  async getSubmissionByStudentAndExam(studentId: number, examId: number): Promise<Submission | undefined> {
    const [submission] = await db.select()
      .from(submissions)
      .where(and(eq(submissions.studentId, studentId), eq(submissions.examId, examId)));
    return submission;
  }

  async createSubmission(submission: CreateSubmissionRequest): Promise<Submission> {
    const [newSubmission] = await db.insert(submissions).values(submission).returning();
    return newSubmission;
  }

  async updateSubmission(id: number, updates: Partial<Submission>): Promise<Submission> {
    const [updated] = await db.update(submissions).set({
      ...updates,
      submittedAt: updates.status === "submitted" ? new Date() : undefined
    }).where(eq(submissions.id, id)).returning();
    if (!updated) throw new Error("Submission not found");
    return updated;
  }
}

export const storage = new DatabaseStorage();
