import { z } from 'zod';

// Minimal route definitions for queryKey references on the frontend
export const api = {
  categories: { list: { path: '/api/categories' as const } },
  locations: {
    list: { path: '/api/locations' as const },
    get: { path: '/api/locations/:id' as const },
  },
  suppliers: {
    list: { path: '/api/suppliers' as const },
    get: { path: '/api/suppliers/:id' as const },
  },
  projects: {
    list: { path: '/api/projects' as const },
    get: { path: '/api/projects/:id' as const },
  },
  items: {
    list: { path: '/api/items' as const },
    get: { path: '/api/items/:id' as const },
    create: { path: '/api/items' as const },
    update: { path: '/api/items/:id' as const },
    delete: { path: '/api/items/:id' as const },
  },
  movements: {
    list: { path: '/api/movements' as const },
    create: { path: '/api/movements' as const },
  },
  dashboard: { stats: { path: '/api/dashboard/stats' as const } },
  reorder: { recommendations: { path: '/api/reorder/recommendations' as const } },
  reports: {
    lowStock: { path: '/api/reports/low-stock' as const },
    byLocation: { path: '/api/reports/by-location' as const },
    valuation: { path: '/api/reports/valuation' as const },
    usageByProject: { path: '/api/reports/usage-by-project' as const },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }
  return url;
}
