import { QueryClient, QueryFunction, QueryCache } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Global 401 interceptor — if ANY query unexpectedly receives a 401 (i.e. the
// server session expired while the client still thinks it's logged in), we
// redirect to /login. The auth query (use-auth.ts) is exempt because its
// queryFn returns null on 401 instead of throwing, so it never reaches here.
const globalQueryCache = new QueryCache({
  onError: (error) => {
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("401:")) {
      // Avoid redirect loops: only redirect if not already on /login
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
  },
});

export const queryClient = new QueryClient({
  queryCache: globalQueryCache,
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
