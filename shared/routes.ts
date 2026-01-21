import { z } from "zod";
import { 
  insertExamSchema, 
  insertQuestionSchema, 
  insertSessionSchema, 
  insertSubmissionSchema,
  exams,
  questions,
  examSessions,
  submissions,
  users
} from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  users: {
    list: {
      method: "GET" as const,
      path: "/api/users",
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
  },
  exams: {
    list: {
      method: "GET" as const,
      path: "/api/exams",
      input: z.object({
        teacherId: z.string().optional(), // Coerced from query
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof exams.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/exams",
      input: insertExamSchema,
      responses: {
        201: z.custom<typeof exams.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/exams/:id",
      responses: {
        200: z.custom<typeof exams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    publish: {
      method: "PATCH" as const,
      path: "/api/exams/:id/publish",
      responses: {
        200: z.custom<typeof exams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  questions: {
    list: {
      method: "GET" as const,
      path: "/api/exams/:examId/questions",
      responses: {
        200: z.array(z.custom<typeof questions.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/exams/:examId/questions",
      input: insertQuestionSchema.omit({ examId: true }),
      responses: {
        201: z.custom<typeof questions.$inferSelect>(),
      },
    },
  },
  sessions: {
    list: {
      method: "GET" as const,
      path: "/api/sessions",
      input: z.object({
        examId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof examSessions.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/sessions",
      input: insertSessionSchema,
      responses: {
        201: z.custom<typeof examSessions.$inferSelect>(),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/sessions/:id",
      responses: {
        200: z.custom<typeof examSessions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  submissions: {
    list: {
      method: "GET" as const,
      path: "/api/sessions/:sessionId/submissions",
      responses: {
        200: z.array(z.custom<typeof submissions.$inferSelect>()),
      },
    },
    listByExam: {
      method: "GET" as const,
      path: "/api/exams/:examId/submissions",
      responses: {
        200: z.array(z.custom<typeof submissions.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/submissions",
      input: insertSubmissionSchema,
      responses: {
        201: z.custom<typeof submissions.$inferSelect>(),
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/submissions/:id",
      input: z.object({
        status: z.enum(["submitted", "graded"]).optional(),
        responses: z.record(z.string()).optional(),
        grades: z.record(z.object({ score: z.number(), feedback: z.string() })).optional(),
        totalScore: z.number().optional(),
      }),
      responses: {
        200: z.custom<typeof submissions.$inferSelect>(),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
