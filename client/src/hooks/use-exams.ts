import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CreateExamRequest, CreateQuestionRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useExams(teacherId?: number) {
  return useQuery({
    queryKey: [api.exams.list.path, teacherId],
    queryFn: async () => {
      // In a real app we'd pass teacherId as query param
      const res = await fetch(api.exams.list.path);
      if (!res.ok) throw new Error("Failed to fetch exams");
      const allExams = await res.json();
      const parsed = api.exams.list.responses[200].parse(allExams);
      
      // Client-side filter for prototype since backend is simple
      if (teacherId) {
        return parsed.filter(e => e.teacherId === teacherId);
      }
      return parsed;
    },
  });
}

export function useExam(id: number) {
  return useQuery({
    queryKey: [api.exams.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.exams.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch exam");
      return api.exams.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateExamRequest) => {
      const res = await fetch(api.exams.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create exam");
      return api.exams.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
      toast({ title: "Exam created", description: "The exam draft has been saved." });
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateExamRequest> & { id: number }) => {
      const url = buildUrl(api.exams.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update exam");
      return api.exams.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
      toast({ title: "Exam updated", description: "The exam has been updated." });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.exams.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete exam");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
      toast({ title: "Exam deleted", description: "The exam has been removed." });
    },
  });
}

// Questions
export function useExamQuestions(examId: number) {
  return useQuery({
    queryKey: [api.questions.list.path, examId],
    queryFn: async () => {
      const url = buildUrl(api.questions.list.path, { examId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return api.questions.list.responses[200].parse(await res.json());
    },
    enabled: !!examId,
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ examId, ...data }: CreateQuestionRequest & { examId: number }) => {
      const url = buildUrl(api.questions.create.path, { examId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add question");
      return api.questions.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.questions.list.path, variables.examId] });
      toast({ title: "Question added", description: "Question saved successfully." });
    },
  });
}

export function usePublishExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (examId: number) => {
      const url = buildUrl(api.exams.publish.path, { id: examId });
      const res = await fetch(url, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to publish exam");
      return api.exams.publish.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
      toast({ title: "Exam Published", description: "Exam is now live for students." });
    },
  });
}

export function useSubmissionsByExam(examId: number) {
  return useQuery({
    queryKey: [api.submissions.listByExam.path, examId],
    queryFn: async () => {
      const url = buildUrl(api.submissions.listByExam.path, { examId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return api.submissions.listByExam.responses[200].parse(await res.json());
    },
    enabled: !!examId,
  });
}

// Submissions
export function useCreateSubmission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.submissions.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit exam");
      return api.submissions.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      toast({ title: "Exam Submitted", description: "Your responses have been sealed and uploaded." });
    },
  });
}
