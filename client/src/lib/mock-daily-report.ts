export type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";

export interface MockProject {
  id: number;
  name: string;
  code: string;
  location: string;
  status: ProjectStatus;
  lastReportDate: string | null;
  reportCount: number;
}

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: 1,
    name: "Riverside Office Complex",
    code: "TK-2025-001",
    location: "3200 Riverside Dr, Los Angeles, CA",
    status: "active",
    lastReportDate: "2026-03-16",
    reportCount: 42,
  },
  {
    id: 2,
    name: "Harbor Light Industrial",
    code: "TK-2025-002",
    location: "8800 Harbor Blvd, Long Beach, CA",
    status: "active",
    lastReportDate: "2026-03-15",
    reportCount: 28,
  },
  {
    id: 3,
    name: "Sunset Mall Renovation",
    code: "TK-2025-003",
    location: "1100 Sunset Strip, West Hollywood, CA",
    status: "on_hold",
    lastReportDate: "2026-02-28",
    reportCount: 17,
  },
  {
    id: 4,
    name: "Northgate Warehouse Fit-Out",
    code: "TK-2025-004",
    location: "4450 Northgate Pkwy, Burbank, CA",
    status: "active",
    lastReportDate: "2026-03-17",
    reportCount: 63,
  },
  {
    id: 5,
    name: "Pacific View High School",
    code: "TK-2024-018",
    location: "700 Pacific View Ave, Santa Monica, CA",
    status: "completed",
    lastReportDate: "2026-01-10",
    reportCount: 91,
  },
  {
    id: 6,
    name: "Cerritos Medical Center",
    code: "TK-2025-005",
    location: "2255 Medical Center Dr, Cerritos, CA",
    status: "active",
    lastReportDate: "2026-03-14",
    reportCount: 11,
  },
  {
    id: 7,
    name: "Downtown Loft Tower",
    code: "TK-2025-006",
    location: "500 S Grand Ave, Los Angeles, CA",
    status: "cancelled",
    lastReportDate: null,
    reportCount: 0,
  },
];

export const STATUS_CFG: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-500 border-slate-200" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

export function formatReportDate(dateStr: string | null): string {
  if (!dateStr) return "No reports yet";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Progress item (project-level estimated quantities) ───────────────────────
export interface ProgressItem {
  id: number;
  description: string;
  unit: string;
  estimatedQty: number;
  cumulativeQty: number; // sum of all previously submitted daily reports
}

export interface ProgressRow extends ProgressItem {
  todayQty: number;
  actualTotal: number;  // cumulativeQty + todayQty
  remaining: number;    // estimatedQty - actualTotal  (floor 0)
  pct: number;          // actualTotal / estimatedQty * 100  (cap 100)
}

export function calcProgressRow(item: ProgressItem, todayQty: number): ProgressRow {
  const actualTotal = item.cumulativeQty + todayQty;
  const remaining   = Math.max(0, item.estimatedQty - actualTotal);
  const pct         = Math.min(100, Math.round((actualTotal / item.estimatedQty) * 100));
  return { ...item, todayQty, actualTotal, remaining, pct };
}

export function overallProgress(rows: ProgressRow[]): number {
  if (rows.length === 0) return 0;
  const totalEst    = rows.reduce((s, r) => s + r.estimatedQty, 0);
  const totalActual = rows.reduce((s, r) => s + r.actualTotal,  0);
  return totalEst > 0 ? Math.min(100, Math.round((totalActual / totalEst) * 100)) : 0;
}

// Mock project-scope quantities (project 1 — Riverside Office Complex)
export const MOCK_PROGRESS_ITEMS: ProgressItem[] = [
  { id: 1,  description: 'EMT Conduit 3/4"',              unit: "LF",  estimatedQty: 2400, cumulativeQty: 1800 },
  { id: 2,  description: 'EMT Conduit 1"',                unit: "LF",  estimatedQty: 1200, cumulativeQty: 960  },
  { id: 3,  description: 'EMT Conduit 1-1/2"',            unit: "LF",  estimatedQty: 600,  cumulativeQty: 390  },
  { id: 4,  description: "Wire Pull 12 AWG THHN",         unit: "LF",  estimatedQty: 9600, cumulativeQty: 7200 },
  { id: 5,  description: "Wire Pull 10 AWG THHN",         unit: "LF",  estimatedQty: 4800, cumulativeQty: 3360 },
  { id: 6,  description: 'Junction Box 4×4"',             unit: "EA",  estimatedQty: 180,  cumulativeQty: 144  },
  { id: 7,  description: "Duplex Receptacle 20A",         unit: "EA",  estimatedQty: 240,  cumulativeQty: 168  },
  { id: 8,  description: "Single-Pole Switch 20A",        unit: "EA",  estimatedQty: 120,  cumulativeQty: 72   },
  { id: 9,  description: "Panel Terminations",            unit: "EA",  estimatedQty: 48,   cumulativeQty: 36   },
  { id: 10, description: "Light Fixture Whips",           unit: "EA",  estimatedQty: 320,  cumulativeQty: 160  },
];
