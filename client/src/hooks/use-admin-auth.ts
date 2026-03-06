import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useAdminAuth() {
  const { data, isLoading, isFetching, refetch } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/status"],
    staleTime: 60_000,
    retry: false,
  });

  const verifyMutation = useMutation({
    mutationFn: (creds: { adminId: string; adminPassword: string }) =>
      apiRequest("POST", "/api/admin/verify", creds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/status"] }),
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/logout"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/status"] }),
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    isLoading,
    isFetching,
    refetch,
    verify: verifyMutation.mutateAsync,
    verifyPending: verifyMutation.isPending,
    verifyError: verifyMutation.error as Error | null,
    logout: logoutMutation.mutateAsync,
    logoutPending: logoutMutation.isPending,
  };
}
