import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

async function fetchJson(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useMovements(filters?: { itemId?: number; projectId?: number; movementType?: string }) {
  const params = new URLSearchParams();
  if (filters?.itemId) params.append("itemId", String(filters.itemId));
  if (filters?.projectId) params.append("projectId", String(filters.projectId));
  if (filters?.movementType) params.append("movementType", filters.movementType);

  const url = `${api.movements.list.path}${params.toString() ? `?${params.toString()}` : ''}`;

  return useQuery({
    queryKey: [api.movements.list.path, filters],
    queryFn: () => fetchJson(url),
  });
}

// Legacy alias
export function useTransactions(filters?: { itemId?: string; movementType?: string }) {
  return useMovements({
    itemId: filters?.itemId ? Number(filters.itemId) : undefined,
    movementType: filters?.movementType,
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.movements.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to log movement");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.movements.list.path] });
      qc.invalidateQueries({ queryKey: [api.items.list.path] });
      qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      qc.invalidateQueries({ queryKey: [api.projects.list.path] });
    },
  });
}

export function useCreateTransaction() {
  return useCreateMovement();
}
