import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CreateSessionRequest, CreateSubmissionRequest, UpdateSubmissionRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// All fetches include credentials so the session cookie is sent
const withCredentials: RequestInit = { credentials: "include" };

export function useSessions(examId?: number) {
  return useQuery({
    queryKey: [api.sessions.list.path, examId],
    queryFn: async () => {
      const url = examId
        ? `${api.sessions.list.path}?examId=${examId}`
        : api.sessions.list.path;
      const res = await fetch(url, withCredentials);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return api.sessions.list.responses[200].parse(await res.json());
    },
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: [api.sessions.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.sessions.get.path, { id });
      const res = await fetch(url, withCredentials);
      if (!res.ok) throw new Error("Failed to fetch session");
      return api.sessions.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSessionRequest) => {
      const res = await fetch(api.sessions.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create session");
      return api.sessions.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sessions.list.path] });
      toast({ title: "Session Active", description: "Students can now join with the access code." });
    },
  });
}

// Submissions
export function useSessionSubmissions(sessionId: number) {
  return useQuery({
    queryKey: [api.submissions.list.path, sessionId],
    queryFn: async () => {
      const url = buildUrl(api.submissions.list.path, { sessionId });
      const res = await fetch(url, withCredentials);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return api.submissions.list.responses[200].parse(await res.json());
    },
    enabled: !!sessionId,
  });
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSubmissionRequest) => {
      const res = await fetch(api.submissions.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to start submission");
      return api.submissions.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.submissions.list.path, data.sessionId] });
    }
  });
}

export function useUpdateSubmission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateSubmissionRequest) => {
      const url = buildUrl(api.submissions.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update submission");
      return api.submissions.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.submissions.list.path, data.sessionId] });
      if (data.status === "graded") {
        toast({ title: "Grading Complete", description: "Feedback has been published." });
      }
    }
  });
}
