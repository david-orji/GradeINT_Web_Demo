import { useState, useEffect } from "react";
import { type User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Simple mock auth for prototype
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem("mock_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  const login = (user: User) => {
    localStorage.setItem("mock_user", JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("mock_user");
    setUser(null);
    window.location.href = "/login";
  };

  return { user, isLoading, login, logout };
}

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path);
      if (!res.ok) throw new Error("Failed to fetch users");
      return api.users.list.responses[200].parse(await res.json());
    },
  });
}
