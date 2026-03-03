import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

type CreateTransactionInput = z.infer<typeof api.transactions.create.input>;

export function useTransactions(filters?: { itemId?: string; projectId?: string; movementType?: string }) {
  return useQuery({
    queryKey: ['/api/items/movements', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.itemId) params.append("itemId", filters.itemId);
      if (filters?.movementType) params.append("movementType", filters.movementType);
      
      const url = `/api/items/movements${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return z.array(z.custom<any>()).parse(await res.json());
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/items/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log transaction");
      return z.custom<any>().parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/items/movements'] });
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}
