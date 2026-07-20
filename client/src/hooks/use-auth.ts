import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type SafeUser } from "@shared/schema";

type AuthResponse = { user: SafeUser };

async function fetchMe(): Promise<SafeUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch session");
  const data: AuthResponse = await res.json();
  return data.user;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<SafeUser | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
    // Re-verify session validity whenever the user returns to the tab after
    // being idle. If the session expired, fetchMe returns null → ProtectedRoute
    // redirects to /login cleanly without any "Access denied" flash.
    refetchOnWindowFocus: true,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Login failed");
      }
      const data: AuthResponse = await res.json();
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["auth", "me"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  return {
    user: user ?? null,
    isLoading,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error?.message,
    isLoggingIn: loginMutation.isPending,
    logout: () => logoutMutation.mutate(),
  };
}
