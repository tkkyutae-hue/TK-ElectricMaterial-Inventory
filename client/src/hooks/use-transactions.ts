import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

type CreateTransactionInput = z.infer<typeof api.transactions.create.input>;

export function useTransactions(filters?: { itemId?: string; projectId?: string; actionType?: string }) {
  return useQuery({
    queryKey: [api.transactions.list.path, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.itemId) params.append("itemId", filters.itemId);
      if (filters?.projectId) params.append("projectId", filters.projectId);
      if (filters?.actionType) params.append("actionType", filters.actionType);
      
      const url = `${api.transactions.list.path}${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return api.transactions.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTransactionInput) => {
      const res = await fetch(api.transactions.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log transaction");
      return api.transactions.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] }); // Items stock likely changed
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}
