import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { apiRequest } from "@/lib/queryClient";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/login";
    },
  });

  const role = user?.role ?? "viewer";

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    // Admin Tools access (User Approvals, Export Backup) — admin only
    isAdminRole: role === "admin",
    // Admin Mode access (all normal admin pages) — admin + manager
    canAccessAdminMode: role === "admin" || role === "manager",
    // Can perform field movements — staff, manager, admin (not viewer)
    canDoMovements: role === "staff" || role === "manager" || role === "admin",
    // Can edit/modify data in admin mode — manager + admin
    isManagerOrAbove: role === "manager" || role === "admin",
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
