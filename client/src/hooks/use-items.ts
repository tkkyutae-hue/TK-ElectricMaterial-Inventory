import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

async function fetchJson(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed: ${url}`);
  return res.json();
}

export function useItems(filters?: { categoryId?: string; locationId?: string; status?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.categoryId) params.append("categoryId", filters.categoryId);
  if (filters?.locationId) params.append("locationId", filters.locationId);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.search) params.append("search", filters.search);
  const url = `${api.items.list.path}${params.toString() ? `?${params.toString()}` : ''}`;
  return useQuery({ queryKey: [api.items.list.path, filters], queryFn: () => fetchJson(url) });
}

export function useItem(id: number) {
  return useQuery({
    queryKey: [api.items.get.path, id],
    queryFn: () => fetchJson(buildUrl(api.items.get.path, { id })),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.items.create.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error("Failed to create item");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.items.list.path] }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(buildUrl(api.items.update.path, { id }), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [api.items.list.path] });
      qc.invalidateQueries({ queryKey: [api.items.get.path, id] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.items.delete.path, { id }), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.items.list.path] }),
  });
}
