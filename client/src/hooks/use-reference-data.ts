import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

async function fetchJson(path: string) {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  return res.json();
}

export function useCategories() {
  return useQuery({ queryKey: [api.categories.list.path], queryFn: () => fetchJson(api.categories.list.path) });
}

export function useLocations() {
  return useQuery({ queryKey: [api.locations.list.path], queryFn: () => fetchJson(api.locations.list.path) });
}

export function useSuppliers() {
  return useQuery({ queryKey: [api.suppliers.list.path], queryFn: () => fetchJson(api.suppliers.list.path) });
}

export function useSupplier(id: number) {
  return useQuery({
    queryKey: [api.suppliers.get.path, id],
    queryFn: () => fetchJson(buildUrl(api.suppliers.get.path, { id })),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.suppliers.list.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to create supplier');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.suppliers.list.path] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(buildUrl(api.suppliers.get.path, { id }), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to update supplier');
      return res.json();
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [api.suppliers.list.path] });
      qc.invalidateQueries({ queryKey: [api.suppliers.get.path, id] });
    },
  });
}

export function useProjects() {
  return useQuery({ queryKey: [api.projects.list.path], queryFn: () => fetchJson(api.projects.list.path) });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: [api.projects.get.path, id],
    queryFn: () => fetchJson(buildUrl(api.projects.get.path, { id })),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.projects.list.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to create project');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.projects.list.path] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(buildUrl(api.projects.get.path, { id }), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      if (!res.ok) throw new Error('Failed to update project');
      return res.json();
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [api.projects.list.path] });
      qc.invalidateQueries({ queryKey: [api.projects.get.path, id] });
    },
  });
}
