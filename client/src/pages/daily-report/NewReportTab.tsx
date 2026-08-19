import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import type { Translations } from "@/lib/i18n";

const TASK_STATUS_LABEL_KEY: Record<string, keyof Translations> = {
  "not-started": "newReportTaskNotStarted",
  "in-progress": "newReportTaskInProgress",
  "completed":   "newReportTaskCompleted",
  "delayed":     "newReportTaskDelayed",
  "blocked":     "newReportTaskBlocked",
};
const taskStatusLabel = (val: string, t: Translations): string =>
  t[TASK_STATUS_LABEL_KEY[val] ?? "newReportTaskNotStarted"] as string;

const EQ_TAG_LABEL_KEY: Record<string, keyof Translations> = {
  repair:  "newReportEqRepairTag",
  return:  "newReportEqReturnTag",
  pending: "newReportEqPendingTag",
};
const eqTagLabel = (tag: string, t: Translations): string =>
  t[EQ_TAG_LABEL_KEY[tag]] as string;
import {
  Calendar, Users, Package, Truck, FileText, ChevronDown, ChevronRight,
  Plus, Trash2, Save, Send, AlertTriangle, CheckCircle2,
  Info, Loader2, HardHat, Paperclip, Camera, Wrench, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Worker } from "@shared/schema";
import { PdfViewer } from "./PdfViewer";
import { FT } from "./fieldTicketTheme";

// ─── Constants ────────────────────────────────────────────────────────────────
const TASK_STATUS_CFG: Record<string, {
  label: string; dotColor: string;
  badgeBg: string; badgeBorder: string; badgeText: string;
  accentColor: string;
  dot: string; text: string; rowBg: string; borderColor: string;
}> = {
  "not-started": { label: "Not Started", dotColor: FT.RULE,    badgeBg: "transparent", badgeBorder: FT.INK,    badgeText: FT.INK,    accentColor: FT.RULE,   dot: "bg-slate-400",   text: "text-slate-500",   rowBg: "",               borderColor: FT.RULE   },
  "in-progress":  { label: "In Progress", dotColor: FT.ACCENT,  badgeBg: FT.ACCENT,     badgeBorder: FT.ACCENT, badgeText: "#fff",    accentColor: FT.ACCENT, dot: "bg-blue-500",    text: "text-blue-700",    rowBg: "",               borderColor: FT.ACCENT },
  "completed":    { label: "Completed",   dotColor: FT.SUCCESS,  badgeBg: FT.SUCCESS,    badgeBorder: FT.SUCCESS,badgeText: "#fff",    accentColor: FT.SUCCESS,dot: "bg-emerald-500", text: "text-emerald-700", rowBg: "",               borderColor: FT.SUCCESS},
  "delayed":      { label: "Delayed",     dotColor: FT.DANGER,   badgeBg: FT.DANGER,     badgeBorder: FT.DANGER, badgeText: "#fff",    accentColor: FT.DANGER, dot: "bg-orange-500",  text: "text-orange-700",  rowBg: "bg-amber-50/30", borderColor: FT.DANGER },
  "blocked":      { label: "Blocked",     dotColor: FT.DANGER,   badgeBg: FT.DANGER,     badgeBorder: FT.DANGER, badgeText: "#fff",    accentColor: FT.DANGER, dot: "bg-red-500",     text: "text-red-700",     rowBg: "bg-red-50/30",   borderColor: FT.DANGER },
};

const TRADE_COLOR_CFG: Record<string, { bg: string; color: string; border: string }> = {
  "Foreman":     { bg: FT.SUCCESS,  color: "#fff", border: "#2d6b29" },
  "Helper":      { bg: "#1d4ed8",   color: "#fff", border: "#1741b0" },
  "Safety":      { bg: FT.DANGER,   color: "#fff", border: "#8a2a17" },
  "Apprentice":  { bg: "#d97706",   color: "#fff", border: "#b86006" },
  "Electrician": { bg: "#7c3aed",   color: "#fff", border: "#6d2fd6" },
  "Supervisor":  { bg: "#0d9488",   color: "#fff", border: "#0b7c75" },
};
const DEFAULT_TRADE_COLOR = { bg: FT.TEXT_MUTED, color: "#fff", border: "#57534a" };
function tradeBadge(trade: string | undefined) {
  if (!trade) return null;
  const t = TRADE_COLOR_CFG[trade] ?? DEFAULT_TRADE_COLOR;
  return (
    <span style={{
      display: "inline-flex", padding: "2px 8px", borderRadius: 3,
      fontSize: 11, fontWeight: 700, border: `1px solid ${t.border}`,
      background: t.bg, color: t.color, whiteSpace: "nowrap", flexShrink: 0,
      fontFamily: FT.FONT, letterSpacing: "0.02em", textTransform: "uppercase",
    }}>{trade}</span>
  );
}

const ATTENDANCE_STATUSES = [
  "ATTEND", "PTO", "SICK", "ABSENT", "OFF",
  "LATE", "EARLY_LEAVE", "WFH", "TRAINING", "SUSPENDED", "TERMINATED",
];

const HOURS_COMPUTED = new Set(["ATTEND", "LATE", "EARLY_LEAVE", "WFH", "TRAINING"]);

const STATUS_COLOR_CFG: Record<string, { color: string; bg: string; border: string }> = {
  "ATTEND":      { color: "#fff", bg: FT.SUCCESS,      border: "#2d6b29" },
  "PTO":         { color: "#fff", bg: "#0f766e",        border: "#0d605a" },
  "SICK":        { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
  "ABSENT":      { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
  "OFF":         { color: "#fff", bg: FT.TEXT_MUTED,    border: "#57534a" },
  "LATE":        { color: "#fff", bg: FT.ACCENT,        border: "#c44e00" },
  "EARLY_LEAVE": { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
  "WFH":         { color: "#fff", bg: FT.INK,           border: "#111"    },
  "TRAINING":    { color: "#fff", bg: "#0369a1",        border: "#025f8f" },
  "SUSPENDED":   { color: "#fff", bg: "#7c3aed",        border: "#6d2fd6" },
  "TERMINATED":  { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
};

function tradeIconColor(trade?: string): string {
  if (!trade) return "#6366f1";
  const t = trade.toLowerCase();
  if (t.includes("general manager") || t.includes("gm")) return "#d97706";
  if (t.includes("project engineer") || t.includes("pe") || t.includes("engineer")) return "#059669";
  return "#6366f1";
}

const EQ_STATUS_CFG = {
  operational: { label: "✓  Operational",  border: FT.RULE,   bg: FT.PAPER, color: FT.SUCCESS },
  partial:     { label: "⚠  Partial Issue", border: FT.ACCENT, bg: FT.PAPER, color: FT.ACCENT  },
  broken:      { label: "✕  Broken Down",   border: FT.DANGER, bg: FT.PAPER, color: FT.DANGER  },
} as const;

const EQ_TAG_CFG: Record<string, { bg: string; border: string; color: string; label: string }> = {
  repair:  { bg: FT.DANGER,       border: "#8a2a17", color: "#fff",  label: "🔧 Repair Requested" },
  return:  { bg: FT.INK,          border: "#111",    color: "#fff",  label: "↩ Return Scheduled"  },
  pending: { bg: FT.TEXT_MUTED,   border: "#57534a", color: "#fff",  label: "⏳ Pending"           },
};

const EQUIPMENT_PRESETS = [
  "Scissor Lift", "Boom Lift", "One Man Lift", "Reach Forklift",
  "Forklift", "Trench", "Excavator Small", "Excavator Big",
];

// Exact rank allowlist for "Prepared By" — Foreman and above
const PREPARED_BY_RANKS = new Set([
  "general manager",
  "deputy general manager",
  "manager",
  "assistant manager",
  "project engineer",
  "foreman",
]);
function isForemanPlus(trade: string | null | undefined): boolean {
  if (!trade) return false;
  return PREPARED_BY_RANKS.has(trade.toLowerCase().trim());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 1000;
function uid() { return ++_uid; }

function calcHours(start: string, end: string, status: string): number {
  if (!HOURS_COMPUTED.has(status) || !start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const gross = Math.max(0, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10);
  // Always deduct 1-hour lunch break (like Jibble)
  return Math.max(0, Math.round((gross - 1) * 10) / 10);
}

// Convert ISO timestamp → "HH:MM" in local time (for Jibble punch-in/out)
function tsToHHMM(ts: string | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
  } catch { return null; }
}

// Flexible word-order match for material search
function flexMatch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const n = name.toLowerCase();
  if (n.includes(q)) return true;
  const words = q.split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every(w => n.includes(w));
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Mobile breakpoint hook ───────────────────────────────────────────────────
function useIsMobile(breakpoint = 640) {
  const [isMob, setIsMob] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMob(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMob;
}


// ─── Types ────────────────────────────────────────────────────────────────────
interface PhotoFile { url: string; workDescription: string; memo: string }
interface TaskRow {
  id: number; description: string; area: string; status: string; notes: string;
  expanded: boolean; detailNotes: string; drawingFiles: string[]; photoFiles: PhotoFile[];
}
interface ManpowerRow {
  id: number; workerId: number | null; workerName: string; trade: string;
  attendanceStatus: string; startTime: string; endTime: string;
  hoursWorked: number; notes: string;
}
interface MaterialRow  { id: number; description: string; spec: string; unit: string; qty: number; notes: string; inventoryItemId: number | null; scopeItemId: number | null; section?: string | null }
interface EquipmentRow {
  id: number; name: string; size: string; brand: string;
  unit: string; qty: number; hours: number; notes: string;
  eqStatus: "operational" | "partial" | "broken"; tags: string[];
}

function isWorkerBasedManpower(rows: any[]): boolean {
  return rows.length === 0 || "workerId" in rows[0];
}

// ─── Section navigator ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { num: 1, labelKey: "newReportNavInfo"      as const, color: "#3b82f6" },
  { num: 2, labelKey: "newReportNavManpower"  as const, color: "#8b5cf6" },
  { num: 3, labelKey: "newReportNavTasks"     as const, color: "#059669" },
  { num: 4, labelKey: "newReportNavMaterials" as const, color: "#d97706" },
  { num: 5, labelKey: "newReportNavEquipment" as const, color: "#f97316" },
  { num: 6, labelKey: "newReportNavMemo"      as const, color: "#64748b" },
] as const;

function NavIcon({ idx }: { idx: number }) {
  const cls = "w-3.5 h-3.5";
  const icons = [
    <Calendar key={idx} className={cls} />,
    <Users    key={idx} className={cls} />,
    <Wrench   key={idx} className={cls} />,
    <Package  key={idx} className={cls} />,
    <Truck    key={idx} className={cls} />,
    <FileText key={idx} className={cls} />,
  ];
  return icons[idx] ?? null;
}

function SectionNavigator({
  sectionRefs,
  navRef,
  activeSection,
  completionHints,
}: {
  sectionRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  navRef:      React.RefObject<HTMLDivElement>;
  activeSection: number;
  completionHints: boolean[];
}) {
  const { t } = useLanguage();
  function scrollToSection(idx: number) {
    const el  = sectionRefs.current[idx];
    const nav = navRef.current;
    if (!el) return;
    const navH = nav ? nav.offsetHeight : 0;
    const top  = el.getBoundingClientRect().top + window.scrollY - navH - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  return (
    <div
      ref={navRef}
      style={{
        position: "sticky", top: 0, zIndex: 40,
        background: FT.PAPER_MUTED,
        borderBottom: `1px solid ${FT.RULE}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="no-scrollbar"
        style={{ display: "flex", overflowX: "auto" }}
      >
        {NAV_ITEMS.map((item, idx) => {
          const isActive = activeSection === idx;
          const done     = completionHints[idx];
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => scrollToSection(idx)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "11px 14px",
                border: "none",
                background: isActive ? FT.INK : "transparent",
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                transition: "background 0.15s",
                fontFamily: FT.FONT,
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(28,28,30,0.07)";
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: isActive ? FT.PAPER : FT.TEXT_MUTED,
                fontFamily: FT.FONT, letterSpacing: "0.05em",
              }}>
                {item.num}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: isActive ? FT.PAPER : FT.TEXT_MUTED,
                fontFamily: FT.FONT, letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}>
                {t[item.labelKey]}
              </span>
              {done && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isActive ? FT.PAPER : FT.SUCCESS,
                  flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
// overflow-hidden removed so combobox dropdowns are not clipped
function Section({
  num, title, defaultOpen = true, summary, alert, headerRight, children,
}: {
  num: number; title: string; icon?: React.ReactNode;
  defaultOpen?: boolean; summary?: string; alert?: React.ReactNode;
  headerRight?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ boxShadow: "none", border: `1px solid ${FT.RULE}`, background: FT.PAPER, borderRadius: 10 }}>
      <div style={{ borderBottom: open ? `3px solid ${FT.ACCENT}` : "none" }}>
        <div className="flex items-center px-5 transition-colors" style={{ borderRadius: open ? "10px 10px 0 0" : 10 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = FT.PAPER_MUTED; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
          <button type="button" data-testid={`section-toggle-${num}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={`section-content-${num}`}
            className="flex-1 flex items-center justify-between py-3 text-left min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* 30×30 square number badge */}
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, border: `2px solid ${FT.INK}`, borderRadius: 4,
                fontSize: 15, fontWeight: 800, fontFamily: FT.FONT,
                color: FT.INK, flexShrink: 0, lineHeight: 1,
              }}>
                {num}
              </span>
              {/* Title */}
              <span style={{
                fontFamily: FT.FONT, fontSize: 17, fontWeight: 800,
                textTransform: "uppercase", letterSpacing: "0.04em",
                color: FT.INK, flexShrink: 0,
              }}>{title}</span>
              {!open && summary && (
                <span style={{ marginLeft: 4, fontSize: 12, color: FT.TEXT_MUTED }} className="truncate">{summary}</span>
              )}
              {alert && <span className="ml-2 shrink-0">{alert}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: FT.TEXT_MUTED }} />
            </div>
          </button>
          {headerRight && (
            <div className="flex items-center shrink-0 ml-2">
              {headerRight}
            </div>
          )}
        </div>
      </div>
      {open && (
        <CardContent id={`section-content-${num}`} className="pt-0 pb-6 px-5" style={{ borderTop: "none" }}>
          <div className="pt-4">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────
function FL({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: "block", fontSize: 13, fontWeight: 700,
      color: FT.TEXT_MUTED, textTransform: "uppercase",
      letterSpacing: "0.04em", marginBottom: 6, userSelect: "none",
      fontFamily: FT.FONT,
    }}>
      {children}
    </label>
  );
}

// ─── Table header ─────────────────────────────────────────────────────────────
function TH({ cols }: { cols: { label: string; cls?: string }[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: `1px solid ${FT.RULE}`, background: FT.PAPER_MUTED }}>
        {cols.map(({ label, cls }) => (
          <th key={label} className={cls ?? ""} style={{
            padding: "8px 10px", fontSize: 11, fontWeight: 700,
            color: FT.TEXT_MUTED, textTransform: "uppercase",
            letterSpacing: "0.05em", whiteSpace: "nowrap", textAlign: "left",
            fontFamily: FT.FONT,
          }}>
            {label}
          </th>
        ))}
        <th style={{ width: 36, padding: "8px 4px" }} />
      </tr>
    </thead>
  );
}

// ─── Delete button ────────────────────────────────────────────────────────────
function DelBtn({ onClick, testId }: { onClick: () => void; testId: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
      style={{ color: FT.RULE, background: "transparent" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = FT.DANGER; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = FT.RULE; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Add row button ───────────────────────────────────────────────────────────
function AddRow({ onClick, label, testId }: { onClick: () => void; label: string; testId: string }) {
  return (
    <button data-testid={testId} type="button"
      onClick={onClick}
      style={{
        marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
        border: `1.5px dashed ${FT.RULE}`, background: "transparent",
        color: FT.TEXT_MUTED, cursor: "pointer", transition: "all 0.15s",
        fontFamily: FT.FONT, letterSpacing: "0.02em",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = FT.TEXT_MUTED; (e.currentTarget as HTMLElement).style.color = FT.INK; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = FT.RULE; (e.currentTarget as HTMLElement).style.color = FT.TEXT_MUTED; }}>
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// ─── Read-only cell display ───────────────────────────────────────────────────
function ROCell({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div style={{
      height: 32, display: "flex", alignItems: "center",
      paddingLeft: 10, paddingRight: 10, fontSize: 13,
      color: center ? FT.INK : FT.TEXT_MUTED,
      background: FT.PAPER, borderRadius: 6,
      border: `1px solid ${FT.RULE}`, userSelect: "none",
      ...(center ? { justifyContent: "center", fontWeight: 700, fontFamily: FT.FONT } : {}),
    }}>
      {children}
    </div>
  );
}

// ─── Transparent input (for table cells) ─────────────────────────────────────
const cellInputCls = "h-8 text-[13px] border-transparent bg-transparent hover:border-[#D8D3C4] hover:bg-[#F7F5EF] focus:border-[#E85D04] focus:bg-[#F7F5EF] transition-colors";

// ─── Content-sized textarea ───────────────────────────────────────────────────
function AutoSizeTextarea({
  value, style, ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value"> & { value: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    let lastWidth = el.getBoundingClientRect().width;
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(([entry]) => {
          const nextWidth = entry.contentRect.width;
          if (nextWidth !== lastWidth) {
            lastWidth = nextWidth;
            resize();
          }
        })
      : null;

    observer?.observe(el);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [resize]);

  return (
    <Textarea
      {...props}
      ref={textareaRef}
      value={value}
      style={{ ...style, overflowY: "hidden" }}
    />
  );
}

// ─── Worker Combobox ──────────────────────────────────────────────────────────
function WorkerCombobox({
  row, allWorkers, takenIds, testId, onChange,
}: {
  row: ManpowerRow; allWorkers: Worker[]; takenIds: Set<number | null>;
  testId: string; onChange: (patch: Partial<ManpowerRow>) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState(row.workerName);
  const [focused, setFocused] = useState(false);

  const filtered = allWorkers
    .filter((w) => !takenIds.has(w.id) || w.id === row.workerId)
    .filter((w) => !query || w.fullName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => { setQuery(row.workerName); }, [row.workerName]);

  return (
    <div className="relative">
      {/* Wrapper div carries the border — input inside is borderless */}
      <div
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: "flex", alignItems: "center",
          width: "100%", height: 32,
          border: `1px solid ${focused ? "#3b82f6" : "#e2e8f0"}`,
          borderRadius: 6, background: "#fff", overflow: "hidden",
          boxShadow: focused ? "0 0 0 2px rgba(59,130,246,0.15)" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}>
        <input
          data-testid={testId}
          value={query}
          placeholder={t.newReportTypeNameSearch}
          style={{
            flex: 1, minWidth: 0,
            border: "none", outline: "none",
            background: "transparent",
            fontSize: 13, padding: "0 9px",
            color: "#1e293b",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange({ workerName: e.target.value, workerId: null, trade: "" });
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {row.trade && (
          <span style={{
            flexShrink: 0, fontSize: 11, color: "#94a3b8",
            whiteSpace: "nowrap",
          }}>
            {row.trade}
          </span>
        )}
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setQuery(""); setOpen(false); onChange({ workerName: "", workerId: null, trade: "" }); }}
          style={{
            width: 20, height: 20, borderRadius: "50%",
            background: "#f0f0f0", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginRight: 6, flexShrink: 0,
            color: "#aaa", fontSize: 10,
            opacity: query ? 1 : 0,
            pointerEvents: query ? "auto" : "none",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => { const b = e.currentTarget; b.style.background = "#f43f5e"; b.style.color = "#fff"; }}
          onMouseLeave={e => { const b = e.currentTarget; b.style.background = "#f0f0f0"; b.style.color = "#aaa"; }}>
          ×
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] top-full left-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto overflow-x-hidden" style={{ minWidth: 240 }}>
          {filtered.map((w) => (
            <button key={w.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setQuery(w.fullName); setOpen(false); onChange({ workerId: w.id, workerName: w.fullName, trade: w.trade ?? "" }); }}
              className="w-full text-left hover:bg-slate-50 transition-colors"
              style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <HardHat className="w-3.5 h-3.5 text-slate-400" style={{ flexShrink: 0 }} />
              <span className="font-medium text-slate-700" style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.fullName}</span>
              {w.trade && <span className="text-slate-400" style={{ flexShrink: 0, fontSize: 11, marginLeft: 8 }}>{w.trade}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prepared By Combobox (Foreman+ workers) ─────────────────────────────────
function PreparedByCombobox({
  value, allWorkers, onChange, disabled,
}: {
  value: string; allWorkers: Worker[];
  onChange: (name: string, id: number | null, trade?: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(() =>
    value ? allWorkers.find(w => w.fullName === value) ?? null : null
  );

  const foremanPlus = allWorkers.filter(w => w.isActive && isForemanPlus(w.trade));
  const filtered = foremanPlus
    .filter(w => !query || w.fullName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  useEffect(() => {
    setQuery(value);
    if (!value) { setSelectedWorker(null); return; }
    const found = allWorkers.find(w => w.fullName === value);
    if (found) setSelectedWorker(found);
  }, [value, allWorkers]);

  const displayWorker = selectedWorker ?? (value ? allWorkers.find(w => w.fullName === value) ?? null : null);

  if (displayWorker && value) {
    return (
      <div style={{ position: "relative", height: 36 }}>
        <div style={{
          background: "#dcfce7", border: "1px solid #86efac",
          color: "#16a34a", fontWeight: 600, borderRadius: 8,
          padding: "0 38px 0 10px", height: 36,
          display: "flex", alignItems: "center", fontSize: 13,
          userSelect: "none", cursor: "default", overflow: "hidden",
        }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayWorker.fullName}{displayWorker.trade ? `  ·  ${displayWorker.trade}` : ""}
          </span>
        </div>
        {!disabled && (
          <button type="button"
            data-testid="btn-clear-prepared-by"
            title={t.newReportClearSelection}
            onClick={() => { setSelectedWorker(null); setQuery(""); onChange("", null, ""); }}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              width: 20, height: 20, borderRadius: "50%",
              background: "#86efac", color: "#16a34a",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", flexShrink: 0,
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = "#16a34a"; b.style.color = "white"; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = "#86efac"; b.style.color = "#16a34a"; }}>
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        data-testid="input-prepared-by"
        value={query}
        placeholder={foremanPlus.length > 0 ? t.newReportSelectForeman : t.newReportEnterName}
        disabled={disabled}
        className={`h-9 text-sm ${!value && !disabled ? "border-slate-300" : ""}`}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setSelectedWorker(null);
          onChange(e.target.value, null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
          {filtered.map(w => (
            <button key={w.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setQuery(w.fullName); setOpen(false); setSelectedWorker(w); onChange(w.fullName, w.id, w.trade); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", minHeight: 40,
                width: "100%", textAlign: "left",
                background: "none", border: "none", cursor: "pointer",
              }}
              className="hover:bg-slate-50 transition-colors">
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#e0e7ff",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, overflow: "hidden",
              }}>
                <HardHat style={{ width: 14, height: 14, color: tradeIconColor(w.trade) }} />
              </div>
              <span style={{
                flex: 1, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontSize: 13, color: "#1a1a1a",
              }}>
                {w.fullName}
              </span>
              {w.trade && (
                <span style={{ flexShrink: 0, fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>
                  {w.trade}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Person Card Combobox (Reporter / Project Manager) ────────────────────────
function PersonCardCombobox({
  value, allWorkers, onChange, disabled, variant, testId,
}: {
  value: string; allWorkers: Worker[];
  onChange: (name: string, id: number | null, trade?: string) => void;
  disabled?: boolean; variant: "reporter" | "pm"; testId?: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(() =>
    value ? allWorkers.find(w => w.fullName === value) ?? null : null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const isReporter = variant === "reporter";
  const vs = isReporter
    ? { border: "1.5px solid #6ee7b7", bg: "#f0fdf4", avatarBg: "#10b981", subColor: "#10b981" }
    : { border: "1.5px solid #a5b4fc", bg: "#eef2ff", avatarBg: "#6366f1", subColor: "#818cf8" };
  const candidates = isReporter
    ? allWorkers.filter(w => w.isActive && isForemanPlus(w.trade))
    : allWorkers.filter(w => {
        const tr = w.trade?.toLowerCase().trim() ?? "";
        return w.isActive && (tr === "general manager" || tr === "manager");
      });
  const filtered = candidates
    .filter(w => !query || w.fullName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  useEffect(() => {
    setQuery(value);
    if (!value) { setSelectedWorker(null); return; }
    const found = allWorkers.find(w => w.fullName === value);
    if (found) setSelectedWorker(found);
  }, [value, allWorkers]);

  const displayWorker = selectedWorker ?? (value ? allWorkers.find(w => w.fullName === value) ?? null : null);
  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }

  if (displayWorker && value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: vs.border, borderRadius: 10, background: vs.bg, padding: "8px 12px", minHeight: 52 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: vs.avatarBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {getInitials(displayWorker.fullName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayWorker.fullName}</div>
          <div style={{ fontSize: 10, color: vs.subColor }}>{displayWorker.trade || (isReporter ? t.newReportReporter : t.newReportProjectManager)}</div>
        </div>
        {!disabled && (
          <button type="button" data-testid={testId ? `${testId}-clear` : undefined}
            onClick={() => { setSelectedWorker(null); setQuery(""); onChange("", null, ""); }}
            style={{ width: 20, height: 20, borderRadius: "50%", background: vs.avatarBg, color: "#fff", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, border: "1.5px dashed #d1d5db", borderRadius: 10, background: "#fafafa", padding: "8px 12px", cursor: disabled ? "default" : "pointer", minHeight: 52, transition: "border-color 0.15s, background 0.15s" }}
        onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#f5f3ff"; } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#fafafa"; }}
        onClick={() => { if (!disabled) { inputRef.current?.focus(); setOpen(true); } }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input ref={inputRef} data-testid={testId} value={query}
            placeholder={isReporter ? t.newReportSelectReporter : t.newReportSelectPM}
            disabled={disabled}
            onChange={e => { setQuery(e.target.value); setOpen(true); onChange(e.target.value, null); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#374151", fontWeight: 400, width: "100%", cursor: "pointer" }} />
          <div style={{ fontSize: 10, color: "#d1d5db" }}>{isReporter ? t.newReportRequiredToSubmit : t.newReportOptional}</div>
        </div>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
          {filtered.map(w => (
            <button key={w.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setQuery(w.fullName); setOpen(false); setSelectedWorker(w); onChange(w.fullName, w.id, w.trade); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", minHeight: 40, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
              className="hover:bg-slate-50 transition-colors">
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                <HardHat style={{ width: 14, height: 14, color: tradeIconColor(w.trade) }} />
              </div>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "#1a1a1a" }}>{w.fullName}</span>
              {w.trade && <span style={{ flexShrink: 0, fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>{w.trade}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Material Combobox (inventory-linked, flexible word-order search) ─────────
// ─── Size extractor (display-only, no data model changes) ────────────────────
function extractSize(name: string): { size: string; rest: string } {
  if (!name) return { size: "", rest: "" };
  function cleanRest(s: string) { return s.replace(/^[\s\/\-]+/, "").trim(); }
  // #N / #N/N / #NXXX  (e.g. #1, #10, #4/0, #1AWG)
  let m = name.match(/^(#[\d]+(?:\/[\d]+)?(?:[A-Za-z]+)?)\s+(.*)/);
  if (m) return { size: m[1], rest: cleanRest(m[2]) };
  // fraction + optional quote  (e.g. 3/4", 1/2", 1/4")
  m = name.match(/^(\d+\/\d+"?)\s+(.*)/);
  if (m) return { size: m[1], rest: cleanRest(m[2]) };
  // integer or decimal + "  (e.g. 2", 4", 1.5")
  m = name.match(/^(\d+(?:\.\d+)?")\s+(.*)/);
  if (m) return { size: m[1], rest: cleanRest(m[2]) };
  // kVA  (e.g. "112.5 kVA", "100kVA") → normalize to "NNN.N kVA" with space
  m = name.match(/^([\d.]+\s*kVA)\s+(.*)/i);
  if (m) {
    const size = m[1].trim().replace(/(\d)(kVA)/i, "$1 kVA");
    return { size, rest: cleanRest(m[2]) };
  }
  // Amps / milliamps  (e.g. "100A", "200A", "50mA")
  m = name.match(/^(\d+(?:\.\d+)?m?A)\s+(.*)/i);
  if (m) return { size: m[1], rest: cleanRest(m[2]) };
  return { size: "", rest: name };
}

function ThumbPlaceholder({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 7, border: "1.5px dashed #e0e0e0", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#ddd" }}>
      <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>
  );
}

function MaterialSearch({
  row, inventoryItems, testId, onChange,
}: {
  row: MaterialRow; inventoryItems: any[]; testId: string;
  onChange: (patch: Partial<MaterialRow>) => void;
}) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Fixed-position coords for mobile so the popup never overflows the visual viewport
  const [fixedPos, setFixedPos] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);

  const initQuery = row.inventoryItemId
    ? (extractSize(row.description).rest || row.description)
    : row.description;
  const [query, setQuery] = useState(initQuery);

  const filtered = inventoryItems
    .filter(item => flexMatch(item.name, query))
    .slice(0, 12);

  useEffect(() => {
    const next = row.inventoryItemId
      ? (extractSize(row.description).rest || row.description)
      : row.description;
    setQuery(next);
  }, [row.description, row.inventoryItemId]);

  // Recalculates position using visualViewport so the popup stays inside the visible area
  // even when the virtual keyboard is open.
  const calcPos = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = window.innerWidth;
    const pad = 16;
    // layout-viewport coordinates of visual viewport edges
    const vvTop    = vv?.offsetTop  ?? 0;
    const vvBottom = vvTop + (vv?.height ?? window.innerHeight);

    const spaceBelow = vvBottom - rect.bottom - pad;
    const spaceAbove = rect.top   - vvTop    - pad;
    const desiredH   = 280;

    let top: number, maxHeight: number;
    if (spaceBelow >= 100) {
      top       = rect.bottom + 4;
      maxHeight = Math.min(desiredH, spaceBelow);
    } else if (spaceAbove > spaceBelow) {
      maxHeight = Math.min(desiredH, spaceAbove);
      top       = rect.top - 4 - maxHeight;
    } else {
      top       = rect.bottom + 4;
      maxHeight = Math.max(80, spaceBelow);
    }

    setFixedPos({
      top:       Math.max(vvTop + pad, top),
      left:      pad,
      width:     vw - pad * 2,
      maxHeight,
    });
  }, []);

  // Update position while open (handles keyboard appearing / page scroll)
  useEffect(() => {
    if (!open || !isMobile) return;
    calcPos();
    const vv = window.visualViewport;
    const update = () => calcPos();
    vv?.addEventListener("resize",  update);
    vv?.addEventListener("scroll",  update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      vv?.removeEventListener("resize",  update);
      vv?.removeEventListener("scroll",  update);
      window.removeEventListener("scroll", update);
    };
  }, [open, isMobile, calcPos]);

  function openWithPos() {
    setOpen(true);
    if (isMobile) { calcPos(); } else { setFixedPos(null); }
  }

  const dropdownStyle: React.CSSProperties = isMobile && fixedPos
    ? { position: "fixed", top: fixedPos.top, left: fixedPos.left, width: fixedPos.width, zIndex: 99999, maxHeight: fixedPos.maxHeight }
    : { position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "min(400px, calc(100vw - 32px))", zIndex: 9999, maxHeight: 280 };

  return (
    <div className="relative" ref={wrapperRef}>
      {isMobile ? (
        <AutoSizeTextarea data-testid={testId} value={query}
          placeholder={t.newReportSearchInventory}
          onChange={(e) => {
            setQuery(e.target.value);
            openWithPos();
            onChange({ description: e.target.value, inventoryItemId: null });
          }}
          onFocus={() => openWithPos()}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{
            width: "100%", minHeight: 30, padding: "3px 0", border: "none",
            outline: "none", boxShadow: "none", resize: "none", overflow: "hidden",
            background: "transparent", color: "#1a1a1a", fontSize: 13,
            fontWeight: 600, lineHeight: 1.4, overflowWrap: "anywhere",
          }} />
      ) : (
        <Input data-testid={testId} value={query}
          placeholder={t.newReportSearchInventory}
          className={cellInputCls}
          onChange={(e) => {
            setQuery(e.target.value);
            openWithPos();
            onChange({ description: e.target.value, inventoryItemId: null });
          }}
          onFocus={() => openWithPos()}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
      )}
      {open && filtered.length > 0 && (
        <div style={{ ...dropdownStyle, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.10)", overflowY: "auto" }}>
          {filtered.map((item) => {
            const { size, rest } = extractSize(item.name);
            return (
              <button key={item.id} type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(rest || item.name); setOpen(false);
                  onChange({ description: item.name, unit: item.unitOfMeasure ?? row.unit, inventoryItemId: item.id });
                }}
                className="w-full text-left hover:bg-slate-50 transition-colors"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
                {/* Thumbnail */}
                {item.imageUrl ? (
                  <>
                    <img src={item.imageUrl} alt=""
                      style={{ width: 40, height: 40, borderRadius: 7, objectFit: "cover", border: "1px solid #e8e8e8", flexShrink: 0, background: "#f5f5f5" }}
                      onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex"; }} />
                    <div style={{ display: "none" }}><ThumbPlaceholder size={40} /></div>
                  </>
                ) : (
                  <ThumbPlaceholder size={40} />
                )}
                {/* Size badge */}
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 600,
                  color: size ? "#555" : "#ccc",
                  background: size ? "#f0f0f0" : "#fafafa",
                  border: `1px solid ${size ? "#e0e0e0" : "#eee"}`,
                  borderRadius: 4, padding: "2px 7px",
                  minWidth: 36, textAlign: "center", whiteSpace: "nowrap",
                }}>{size || "—"}</span>
                {/* Name + category */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{rest || item.name}</div>
                  {item.category?.name && (
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: "#aaa", marginTop: 1 }}>{item.category.name}</div>
                  )}
                </div>
                {/* Unit */}
                {item.unitOfMeasure && (
                  <span style={{ flexShrink: 0, fontSize: 11, color: "#999", background: "#f3f3f3", borderRadius: 4, padding: "2px 7px" }}>{item.unitOfMeasure}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function NewReportTab({
  projectId, reportId, initialData, onSaved, forceEdit = false,
}: {
  projectId: number; reportId?: number | null; initialData?: any;
  onSaved?: (id: number, status: string, savedReport?: any) => void;
  forceEdit?: boolean;
}) {
  const { toast }   = useToast();
  const { t }       = useLanguage();
  const queryClient = useQueryClient();
  const { isManagerOrAbove, isAdminRole } = useAuth();
  const isMobile    = useIsMobile();
  const fd          = initialData?.formData ?? null;

  // ── Section navigator ──
  const sectionRefs     = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null, null]);
  const navRef          = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);
  const visibleSections = useRef<boolean[]>([true, false, false, false, false, false]);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const idx = sectionRefs.current.findIndex(r => r === e.target);
        if (idx !== -1) visibleSections.current[idx] = e.isIntersecting;
      }
      const first = visibleSections.current.findIndex(v => v);
      if (first !== -1) setActiveSection(first);
    }, { threshold: 0.05, rootMargin: "-80px 0px -40% 0px" });
    sectionRefs.current.forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCopyConfirm,   setShowCopyConfirm]   = useState(false);
  // Mobile defaults to quick mode; only explicit "false" in localStorage turns it off.
  const [quickMode, setQuickMode] = useState<boolean>(() => {
    try { return localStorage.getItem("dr-quick-mode") !== "false"; } catch { return true; }
  });
  const [quickStep, setQuickStep] = useState(0);
  const QUICK_TOTAL = 6;

  function toggleQuickMode() {
    setQuickMode(prev => {
      const next = !prev;
      try { localStorage.setItem("dr-quick-mode", String(next)); } catch {}
      if (next) setQuickStep(0);
      return next;
    });
  }

  // ── Registry queries ──
  const { data: workers = [] }        = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: inventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });
  const { data: project }             = useQuery<any>({
    queryKey: ["/api/projects", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const { data: scopeItems = [] }     = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "scope-items"],
    queryFn: () => fetch(`/api/projects/${projectId}/scope-items`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const activeWorkers                 = workers.filter((w) => w.isActive);

  // ── Existing reports for auto report number ──
  const { data: existingReports = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !reportId,
  });

  // ── General Info state ──
  const [reportNumber,    setReportNumber]    = useState<string>(fd?.reportNumber ?? "");
  const [preparedBy,      setPreparedBy]      = useState<string>(fd?.preparedBy   ?? "");
  const [preparedById,    setPreparedById]    = useState<number | null>(fd?.preparedById ?? null);
  const [preparedByTrade, setPreparedByTrade] = useState<string>(fd?.preparedByTrade ?? "");
  const [reportDate,      setReportDate]      = useState<string>(fd?.reportDate   ?? new Date().toISOString().slice(0, 10));
  const [shift,           setShift]           = useState<string>(fd?.shift           ?? "day");
  const [weather,         setWeather]         = useState<string>(fd?.weather         ?? "clear");
  const [temperature,     setTemperature]     = useState<string>(fd?.temperature     ?? "72");
  const [temperatureHigh, setTemperatureHigh] = useState<string>(fd?.temperatureHigh ?? fd?.temperature ?? "72");
  const [temperatureLow,  setTemperatureLow]  = useState<string>(fd?.temperatureLow  ?? "62");
  const [weatherAutoState, setWeatherAutoState] = useState<"idle" | "loading" | "auto" | "failed">("idle");
  const [projectManager,      setProjectManager]      = useState<string>(fd?.projectManager      ?? "");
  const [projectManagerId,    setProjectManagerId]    = useState<number | null>(fd?.projectManagerId    ?? null);
  const [projectManagerTrade, setProjectManagerTrade] = useState<string>(fd?.projectManagerTrade ?? "");

  // ── Crew assignments for the selected report date ──
  const { data: crewAssignments = [], isSuccess: crewLoaded } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "crew-assignments", reportDate],
    queryFn: () => fetch(`/api/projects/${projectId}/crew-assignments?date=${reportDate}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });

  // ── Jibble today's punch-in/out times ──
  const { data: jibbleActive, isSuccess: jibbleLoaded } = useQuery<{ active: { entry: any; worker: any }[] }>({
    queryKey: ["/api/jibble/active"],
    queryFn: () => fetch("/api/jibble/active", { credentials: "include" }).then(r => r.json()),
  });
  // Build workerId → { start, end } map from Jibble data
  const jibbleTimeMap = (() => {
    const map: Record<number, { start: string; end: string }> = {};
    if (!jibbleActive?.active) return map;
    for (const { entry, worker } of jibbleActive.active) {
      if (!worker?.id) continue;
      const start = tsToHHMM(entry.firstIn);
      const end   = tsToHHMM(entry.lastOut);
      if (start) map[worker.id] = { start, end: end ?? "17:00" };
    }
    return map;
  })();

  // Auto-generate report number
  const autoNumApplied = useRef(false);
  useEffect(() => {
    if (reportId || fd?.reportNumber || autoNumApplied.current) return;
    autoNumApplied.current = true;
    setReportNumber(String(existingReports.length + 1).padStart(3, "0"));
  }, [existingReports.length, reportId, fd?.reportNumber]);

  // ── Auto-populate manpower from Crew Dispatch (new report + empty manpower only) ──
  const crewAutoApplied = useRef(false);
  useEffect(() => {
    if (reportId || crewAutoApplied.current || !crewLoaded || !jibbleLoaded || crewAssignments.length === 0) return;
    crewAutoApplied.current = true;
    setManpower(prev => {
      if (prev.length > 0) return prev;
      return crewAssignments.map(w => {
        const jt = jibbleTimeMap[w.workerId];
        const start = jt?.start ?? "07:00";
        const end   = jt?.end   ?? "17:00";
        return { id: uid(), workerId: w.workerId, workerName: w.workerName, trade: w.trade ?? "",
          attendanceStatus: "ATTEND", startTime: start, endTime: end,
          hoursWorked: calcHours(start, end, "ATTEND"), notes: "" };
      });
    });
  }, [crewLoaded, jibbleLoaded, crewAssignments, reportId]);

  // ── Auto-populate materials from Scope Items (new report + empty materials only) ──
  const scopeAutoApplied = useRef(false);
  useEffect(() => {
    if (reportId || scopeAutoApplied.current || scopeItems.length === 0) return;
    scopeAutoApplied.current = true;
    setMaterials(prev => {
      if (prev.length > 0) return prev;
      return scopeItems
        .filter((s: any) => s.isActive)
        .map((s: any) => ({
          id: uid(), description: s.itemName, spec: s.remarks ?? "", unit: s.unit ?? "EA", qty: 0, notes: "",
          inventoryItemId: s.linkedInventoryItemId ?? null, scopeItemId: s.id, section: s.section ?? null,
        }));
    });
  }, [scopeItems, reportId]);

  // ── Weather auto-fill (Open-Meteo, new reports only) ──
  const weatherAutoApplied = useRef(false);
  useEffect(() => {
    // Only auto-fill for new reports (no initialData) and when project location is known
    if (reportId || weatherAutoApplied.current || !project?.jobLocation || !reportDate) return;
    weatherAutoApplied.current = true;
    setWeatherAutoState("loading");
    (async () => {
      try {
        const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(project.jobLocation)}`, { credentials: "include" });
        if (!geoRes.ok) { setWeatherAutoState("failed"); return; }
        const { lat, lng } = await geoRes.json();
        const wxRes = await fetch(`/api/weather?lat=${lat}&lng=${lng}&date=${reportDate}`, { credentials: "include" });
        if (!wxRes.ok) { setWeatherAutoState("failed"); return; }
        const { temperatureHigh: high, temperatureLow: low, weather: wx } = await wxRes.json();
        setTemperatureHigh(String(high));
        setTemperatureLow(String(low));
        setWeather(wx);
        setWeatherAutoState("auto");
      } catch {
        setWeatherAutoState("failed");
      }
    })();
  }, [project?.jobLocation, reportDate, reportId]);

  // ── Manual import helpers ──
  function importCrewDispatch() {
    if (!crewAssignments.length) {
      toast({ title: t.newReportToastNoCrewTitle, description: t.newReportToastNoCrewDesc, variant: "destructive" });
      return;
    }
    const existingIds = new Set(manpower.map(r => r.workerId).filter(Boolean));
    const newRows = crewAssignments
      .filter(w => !existingIds.has(w.workerId))
      .map(w => {
        const jt = jibbleTimeMap[w.workerId];
        const start = jt?.start ?? "07:00";
        const end   = jt?.end   ?? "17:00";
        return { id: uid(), workerId: w.workerId, workerName: w.workerName, trade: w.trade ?? "",
          attendanceStatus: "ATTEND", startTime: start, endTime: end,
          hoursWorked: calcHours(start, end, "ATTEND"), notes: "" };
      });
    if (!newRows.length) { toast({ title: t.newReportToastCrewAlready, description: t.newReportToastCrewAlreadyDesc }); return; }
    setManpower(prev => [...prev, ...newRows]);
    toast({ title: t.newReportToastCrewAdded.replace("{n}", String(newRows.length)) });
  }

  function applyCopyFromPrevious() {
    if (!prevReport) return;
    const pfd = prevReport.formData ?? {};
    setTasks((pfd.tasks ?? []).map((taskRow: any) => ({
      ...taskRow,
      id: uid(),
      status: "not-started",
      photoFiles: [],
      drawingFiles: [],
      expanded: false,
      detailNotes: taskRow.detailNotes ?? "",
    })));
    setMaterials((pfd.materials ?? []).map((m: any) => ({
      inventoryItemId: null, scopeItemId: null, spec: "", ...m,
      id: uid(), qty: 0,
    })));
    setEquipment((pfd.equipment ?? []).map((e: any) => ({ ...e, id: uid() })));
    if (pfd.generalNotes)       setGeneralNotes(pfd.generalNotes);
    if (pfd.safetyNotes)        setSafetyNotes(pfd.safetyNotes);
    if (pfd.inspectorVisitor)   setInspectorVisitor(pfd.inspectorVisitor);
    if (pfd.requestFromClient)  setRequestFromClient(pfd.requestFromClient);
    if (pfd.drawingNo)          setDrawingNo(pfd.drawingNo);
    if (pfd.drawingDescription) setDrawingDescription(pfd.drawingDescription);
    const taskCount = (pfd.tasks ?? []).length;
    const matCount  = (pfd.materials ?? []).length;
    toast({ title: t.newReportCopyPrevToast.replace("{tasks}", String(taskCount)).replace("{mats}", String(matCount)) });
  }

  function handleCopyPrevious() {
    const formIsEmpty = tasks.length === 0 && materials.length === 0 && equipment.length === 0
      && !generalNotes.trim() && !safetyNotes.trim();
    if (formIsEmpty) {
      applyCopyFromPrevious();
    } else {
      setShowCopyConfirm(true);
    }
  }

  function importScopeItems() {
    const active = scopeItems.filter((s: any) => s.isActive);
    if (!active.length) return;
    const existingScopeIds = new Set(materials.map(r => r.scopeItemId).filter(Boolean));
    const newRows = active
      .filter((s: any) => !existingScopeIds.has(s.id))
      .map((s: any) => ({
        id: uid(), description: s.itemName, spec: s.remarks ?? "", unit: s.unit ?? "EA", qty: 0, notes: "",
        inventoryItemId: s.linkedInventoryItemId ?? null, scopeItemId: s.id, section: s.section ?? null,
      }));
    if (!newRows.length) { toast({ title: t.newReportToastScopeAlready, description: t.newReportToastScopeAlreadyDesc }); return; }
    setMaterials(prev => [...prev, ...newRows]);
    toast({ title: t.newReportToastScopeAdded.replace("{n}", String(newRows.length)) });
  }

  // ── Dynamic rows ──
  const [tasks, setTasks] = useState<TaskRow[]>(() =>
    (fd?.tasks ?? []).map((t: any) => {
      const rawPhotos: any[] = t.photoFiles ?? [];
      const photoFiles: PhotoFile[] = rawPhotos.map((p: any) =>
        typeof p === "string" ? { url: p, workDescription: "", memo: "" } : p
      );
      return { expanded: false, detailNotes: "", drawingFiles: [], ...t, photoFiles };
    })
  );
  const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);
  const [undoState,      setUndoState]      = useState<{ task: TaskRow; index: number; progress: number } | null>(null);
  const undoTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drawing Board state
  const [drawingUrl,       setDrawingUrl]       = useState<string | null>(null);
  const [drawingFilename,  setDrawingFilename]  = useState("");
  const [drawingCollapsed, setDrawingCollapsed] = useState(false);
  const drawingInputRef    = useRef<HTMLInputElement>(null);
  const photoInputRef      = useRef<HTMLInputElement>(null);
  const [photoTaskId,      setPhotoTaskId]      = useState<number | null>(null);
  const matRowRefs         = useRef<(HTMLElement | null)[]>([]);
  const matDragRef         = useRef<{ col: "photo" | "spec"; startX: number; startW: number } | null>(null);
  const [matColWidths, setMatColWidths] = useState<{ photo: number; spec: number }>(() => {
    try { const s = localStorage.getItem("dr-mat-col-widths"); if (s) return JSON.parse(s); } catch {}
    return { photo: 56, spec: 130 };
  });
  const startMatColDrag = (col: "photo" | "spec") => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = matColWidths[col];
    matDragRef.current = { col, startX, startW };
    const onMove = (mv: MouseEvent) => {
      const newW = Math.max(28, startW + mv.clientX - startX);
      setMatColWidths(prev => {
        const next = { ...prev, [col]: newW };
        try { localStorage.setItem("dr-mat-col-widths", JSON.stringify(next)); } catch {}
        return next;
      });
    };
    const onUp = () => { matDragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  function flashRow(i: number) {
    const el = matRowRefs.current[i];
    if (!el) return;
    el.classList.remove("mat-row-flash");
    void el.offsetWidth;
    el.classList.add("mat-row-flash");
    setTimeout(() => { el.classList.remove("mat-row-flash"); }, 900);
  }

  const [manpower, setManpower] = useState<ManpowerRow[]>(() => {
    const rows = isWorkerBasedManpower(fd?.manpower ?? []) ? (fd?.manpower ?? []) : [];
    return rows.map((r: any) => { const { lunchBreak: _lb, ...rest } = r; return rest; });
  });
  const [materials,  setMaterials]  = useState<MaterialRow[]>(
    (fd?.materials ?? []).map((m: any) => ({ inventoryItemId: null, scopeItemId: null, spec: "", ...m }))
  );
  const [equipment, setEquipment]  = useState<EquipmentRow[]>(fd?.equipment  ?? []);

  // ── Notes ──
  const [generalNotes,       setGeneralNotes]       = useState<string>(fd?.generalNotes       ?? "");
  const [safetyNotes,        setSafetyNotes]        = useState<string>(fd?.safetyNotes        ?? "");
  const [inspectorVisitor,   setInspectorVisitor]   = useState<string>(fd?.inspectorVisitor   ?? "");
  const [requestFromClient,  setRequestFromClient]  = useState<string>(fd?.requestFromClient  ?? "");
  const [drawingNo,          setDrawingNo]          = useState<string>(fd?.drawingNo          ?? "");
  const [drawingDescription, setDrawingDescription] = useState<string>(fd?.drawingDescription ?? "");

  // ── Save state ──
  const [savedStatus, setSavedStatus] = useState<string | null>(initialData?.status ?? null);
  const [lastSaved,   setLastSaved]   = useState<Date | null>(null);

  // ── Most recent previous report (for "Copy Previous" feature) ──
  const prevReport = useMemo(() => {
    if (reportId || existingReports.length === 0) return null;
    const sorted = [...existingReports].sort((a, b) =>
      (b.reportDate ?? "").localeCompare(a.reportDate ?? "")
    );
    return sorted[0] ?? null;
  }, [existingReports, reportId]);

  // ── Computed ──
  const totalWorkers    = manpower.length;
  const totalManhours   = manpower.reduce((s, r) => s + r.hoursWorked, 0);
  const presentCount    = manpower.filter((r) => r.attendanceStatus === "ATTEND").length;
  const exceptionsCount = manpower.filter((r) => r.attendanceStatus !== "ATTEND").length;

  // ── Submit validation ──
  const isSubmitted  = savedStatus === "submitted" && !forceEdit;
  const canSubmit    = !!preparedBy.trim();
  const submitHelper = !canSubmit && !isSubmitted
    ? "Add Reporter to enable submission"
    : "";

  // ── Summaries ──
  const mpSummary  = manpower.length  ? `${totalWorkers}w · ${totalManhours.toFixed(1)}h` : undefined;
  const matSummary = materials.length ? `${materials.length} item${materials.length !== 1 ? "s" : ""}` : undefined;
  const eqSummary  = equipment.length ? `${equipment.length} item${equipment.length !== 1 ? "s" : ""}` : undefined;
  const eqIssueCount = equipment.filter(r => r.eqStatus === "partial" || r.eqStatus === "broken").length;
  const eqAlert = eqIssueCount > 0 ? (
    <span style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 20, padding: "3px 12px", fontSize: 12, color: "#e11d48", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {eqIssueCount} issue{eqIssueCount !== 1 ? "s" : ""}
    </span>
  ) : undefined;
  const taskSummary = tasks.length ? `${tasks.length} task${tasks.length !== 1 ? "s" : ""}` : undefined;

  // Completion hints for the section navigator (true = section has data)
  const completionHints = [
    !!preparedBy.trim(),
    manpower.length > 0,
    tasks.length > 0,
    materials.length > 0,
    equipment.length > 0,
    !!(generalNotes.trim() || safetyNotes.trim() || inspectorVisitor.trim() || requestFromClient.trim()),
  ];

  const taskChipStyle = (bg: string, border: string, color: string): React.CSSProperties => ({
    borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600,
    border: `1px solid ${border}`, background: bg, color, display: "inline-flex", alignItems: "center",
  });
  const taskStatusChips = tasks.length > 0 ? (
    <span className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {(() => {
        const inProg  = tasks.filter(t => t.status === "in-progress").length;
        const done    = tasks.filter(t => t.status === "completed").length;
        const blocked = tasks.filter(t => t.status === "blocked").length;
        return (<>
          {inProg  > 0 && <span style={taskChipStyle("#eff6ff","#bfdbfe","#1d4ed8")}>{inProg} {t.newReportTaskInProgress}</span>}
          {done    > 0 && <span style={taskChipStyle("#f0fdf4","#86efac","#15803d")}>{done} {t.newReportTaskCompleted}</span>}
          {blocked > 0 && <span style={taskChipStyle("#fff1f2","#fecdd3","#e11d48")}>{blocked} {t.newReportTaskBlocked}</span>}
        </>);
      })()}
    </span>
  ) : undefined;

  function handleDeleteTask(task: TaskRow, index: number) {
    setDeleteConfirm(null);
    setTasks(prev => prev.filter(r => r.id !== task.id));
    if (undoTimerRef.current)    clearTimeout(undoTimerRef.current);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    let progress = 100;
    setUndoState({ task, index, progress });
    undoIntervalRef.current = setInterval(() => {
      progress -= 2;
      setUndoState(prev => prev ? { ...prev, progress: Math.max(0, progress) } : null);
    }, 100);
    undoTimerRef.current = setTimeout(() => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      setUndoState(null);
    }, 5000);
  }

  function handleUndo() {
    if (!undoState) return;
    if (undoTimerRef.current)    clearTimeout(undoTimerRef.current);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    const restoredTask = undoState.task;
    setTasks(prev => {
      const arr = [...prev];
      arr.splice(undoState.index, 0, restoredTask);
      return arr;
    });
    setUndoState(null);
  }

  // ── Form data builder ──
  function buildFormData() {
    return {
      reportDate, reportNumber, preparedBy, preparedById, preparedByTrade, shift, weather,
      temperature: temperatureHigh, temperatureHigh, temperatureLow,
      projectManager, projectManagerId, projectManagerTrade,
      tasks, manpower, materials, equipment,
      generalNotes, safetyNotes, inspectorVisitor,
      requestFromClient, drawingNo, drawingDescription,
    };
  }

  // ── Mutation ──
  const saveMutation = useMutation({
    mutationFn: async (status: "draft" | "submitted") => {
      // ── Register extra materials as scope items (manager/admin only) ──
      // Staff cannot POST /api/projects/:id/scope-items (requireManager), so we skip for them.
      // The server endpoint is now a transactional upsert: it always returns the item (200),
      // never 409, so concurrent same-key submissions resolve to the same scope item ID.
      let updatedMaterials = [...materials];
      if (isManagerOrAbove && projectId) {
        const extraToRegister = materials.filter(r => r.scopeItemId === null && r.description.trim() !== "");
        if (extraToRegister.length > 0) {
          // Coalesce identical extras (same description+unit+spec) — send only one POST per
          // unique combination, then assign the returned ID to all matching rows.
          const seen = new Map<string, number>(); // dedup key → returned scopeItemId
          const deduped = Array.from(
            new Map(
              extraToRegister.map(r => [
                `${r.description.trim().toLowerCase()}|${(r.unit || "EA").trim().toLowerCase()}|${(r.spec ?? "").trim().toLowerCase()}`,
                r,
              ])
            ).values()
          );

          await Promise.allSettled(
            deduped.map(async (row) => {
              const key = `${row.description.trim().toLowerCase()}|${(row.unit || "EA").trim().toLowerCase()}|${(row.spec ?? "").trim().toLowerCase()}`;
              try {
                const res = await fetch(`/api/projects/${projectId}/scope-items`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    itemName: row.description,
                    unit: row.unit || "EA",
                    remarks: row.spec || null,
                  }),
                });
                if (res.ok) {
                  const returned = await res.json();
                  seen.set(key, returned.id);
                }
              } catch {
                // network error — leave scopeItemId as null, retry on next save
              }
            })
          );

          // Assign the returned IDs to all matching rows (including duplicates)
          updatedMaterials = updatedMaterials.map(r => {
            if (r.scopeItemId !== null) return r;
            const key = `${r.description.trim().toLowerCase()}|${(r.unit || "EA").trim().toLowerCase()}|${(r.spec ?? "").trim().toLowerCase()}`;
            const newId = seen.get(key);
            return newId !== undefined ? { ...r, scopeItemId: newId } : r;
          });

          // Persist new scopeItemIds into React state so subsequent saves don't re-register
          setMaterials(updatedMaterials);
          queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
        }
      }
      const body = {
        projectId, reportDate,
        reportNumber: reportNumber || null,
        preparedBy:   preparedBy   || null,
        status, formData: { ...buildFormData(), materials: updatedMaterials },
      };
      if (reportId) return apiRequest("PATCH", `/api/daily-reports/${reportId}`, body);
      return apiRequest("POST", "/api/daily-reports", body);
    },
    onSuccess: async (res: any, status) => {
      const saved = await res.json();
      setSavedStatus(status);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({
        title: status === "submitted" ? t.newReportReportSubmitted : t.newReportDraftSaved,
        description: status === "submitted"
          ? t.newReportReportSubmittedDesc
          : t.newReportDraftSavedDesc,
      });
      // Pass the complete saved report back to the workspace.  A new report
      // changes the workspace from "new" to "edit" after this callback, which
      // remounts this component.  Keeping the server's formData here prevents
      // photos (and their per-photo descriptions/memos) from disappearing from
      // the form immediately after the first draft save.
      onSaved?.(saved.id, status, saved);
    },
    onError: (err: any) => {
      toast({ title: t.newReportSaveFailed, description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) throw new Error("No report ID");
      return apiRequest("DELETE", `/api/daily-reports/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports-summary"] });
      toast({ title: t.newReportReportDeleted, description: t.newReportReportDeletedDesc });
      onSaved?.(-1, "deleted");
    },
    onError: (err: any) => {
      toast({ title: t.newReportDeleteFailed, description: err.message, variant: "destructive" });
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Copy-previous confirmation modal ── */}
      {showCopyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div style={{ background: FT.PAPER, borderRadius: 16, border: `1px solid ${FT.RULE}`, padding: 24, maxWidth: 360, width: "calc(100% - 32px)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: FT.PAPER_MUTED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={FT.ACCENT} strokeWidth={2.5}>
                  <path d="M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: FT.INK, fontFamily: FT.FONT, margin: 0 }}>{t.newReportCopyPrevConfirmTitle}</p>
                <p style={{ fontSize: 12, color: FT.TEXT_MUTED, marginTop: 2 }}>{t.newReportCopyPrevConfirmDesc}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowCopyConfirm(false)}
                style={{ padding: "6px 16px", borderRadius: 7, border: `1px solid ${FT.RULE}`, background: "transparent", fontSize: 13, fontWeight: 600, color: FT.TEXT_MUTED, cursor: "pointer", fontFamily: FT.FONT }}>
                {t.newReportCopyPrevCancel}
              </button>
              <button type="button" onClick={() => { setShowCopyConfirm(false); applyCopyFromPrevious(); }}
                style={{ padding: "6px 16px", borderRadius: 7, border: "none", background: FT.ACCENT, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: FT.FONT }}>
                {t.newReportCopyPrevConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t.newReportDeleteReport}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t.newReportActionUndone}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-5">{t.newReportConfirmDelete}</p>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-9"
                onClick={() => setShowDeleteConfirm(false)}
                data-testid="btn-delete-cancel">
                {t.newReportCancel}
              </Button>
              <Button size="sm"
                className="h-9 gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold"
                disabled={deleteMutation.isPending}
                onClick={() => { deleteMutation.mutate(); setShowDeleteConfirm(false); }}
                data-testid="btn-delete-confirm">
                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {t.newReportDelete}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top action bar ── */}
      <div className="rounded-xl px-5 py-3" style={{ background: FT.PAPER_MUTED, border: `1px solid ${FT.RULE}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Left: actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button data-testid="btn-save-draft"
              disabled={saveMutation.isPending || isSubmitted}
              onClick={() => saveMutation.mutate("draft")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "0 20px", height: 48, borderRadius: 8, fontSize: 13,
                fontWeight: 700, fontFamily: FT.FONT, letterSpacing: "0.03em",
                textTransform: "uppercase", cursor: (saveMutation.isPending || isSubmitted) ? "not-allowed" : "pointer",
                border: `2px solid ${FT.INK}`, background: "transparent", color: FT.INK,
                transition: "all 0.15s", opacity: (saveMutation.isPending || isSubmitted) ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!saveMutation.isPending && !isSubmitted) { (e.currentTarget as HTMLElement).style.background = FT.INK; (e.currentTarget as HTMLElement).style.color = FT.PAPER; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = FT.INK; }}>
              {saveMutation.isPending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Save style={{ width: 14, height: 14 }} />}
              {t.newReportSaveDraft}
            </button>

            <button data-testid="btn-submit-report"
              disabled={saveMutation.isPending || isSubmitted || !canSubmit}
              onClick={() => saveMutation.mutate("submitted")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "0 24px", height: 48, borderRadius: 8, fontSize: 14,
                fontWeight: 700, fontFamily: FT.FONT, letterSpacing: "0.03em",
                textTransform: "uppercase", transition: "all 0.15s",
                cursor: (!canSubmit && !isSubmitted) ? "not-allowed" : "pointer",
                border: (isSubmitted || canSubmit) ? `1px solid ${FT.ACCENT}` : `1px solid ${FT.RULE}`,
                background: (isSubmitted || canSubmit) ? FT.ACCENT : FT.RULE,
                color: (isSubmitted || canSubmit) ? "#ffffff" : FT.TEXT_MUTED,
                boxShadow: (canSubmit || isSubmitted) ? `0 2px 8px rgba(232,93,4,0.3)` : "none",
                opacity: 1,
              }}
              onMouseEnter={e => { if (canSubmit || isSubmitted) { (e.currentTarget as HTMLElement).style.background = "#c44e00"; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(232,93,4,0.45)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = (isSubmitted || canSubmit) ? FT.ACCENT : FT.RULE; (e.currentTarget as HTMLElement).style.boxShadow = (canSubmit || isSubmitted) ? `0 2px 8px rgba(232,93,4,0.3)` : "none"; }}
              onMouseDown={e => { if (canSubmit || isSubmitted) (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}>
              {saveMutation.isPending
                ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                : isSubmitted
                ? <CheckCircle2 style={{ width: 14, height: 14 }} />
                : canSubmit
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              }
              {isSubmitted ? t.newReportSubmitted : t.newReportSubmit}
            </button>

            {isManagerOrAbove && reportId && (
              <Button data-testid="btn-delete-report"
                variant="outline" size="sm"
                className="gap-2 h-9 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                disabled={deleteMutation.isPending}
                onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                {t.newReportDeleteReport}
              </Button>
            )}
          </div>

          {/* Right: status */}
          <div className="flex items-center gap-3">
            {submitHelper && (
              <span style={{ fontSize: 13, color: FT.TEXT_MUTED, fontStyle: "italic" }}>{submitHelper}</span>
            )}
            <div style={{ width: 1, height: 20, background: FT.RULE }} />
            <div className="flex flex-col items-end">
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: FT.FONT, letterSpacing: "0.04em",
                textTransform: "uppercase", padding: "2px 10px", borderRadius: 4,
                background: isSubmitted ? FT.SUCCESS : savedStatus === "draft" ? FT.ACCENT : "transparent",
                color: (isSubmitted || savedStatus === "draft") ? "#fff" : FT.TEXT_MUTED,
                border: (isSubmitted || savedStatus === "draft") ? "none" : `1px solid ${FT.RULE}`,
              }}>
                {isSubmitted ? t.newReportSubmittedTag : savedStatus === "draft" ? t.newReportDraft : t.newReportUnsaved}
              </span>
              {lastSaved && (
                <span style={{ fontSize: 12, color: FT.TEXT_MUTED, marginTop: 2 }}>{t.newReportLastSaved} {fmtTime(lastSaved)}</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Quick mode toggle removed — mobile always uses quick mode by default */}
      {/* ── Section navigator / Quick step indicator ── */}
      {quickMode && isMobile ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: FT.PAPER_MUTED, border: `1px solid ${FT.RULE}`, borderRadius: 10, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", background: NAV_ITEMS[quickStep].color, color: "#fff" }}>
              <NavIcon idx={quickStep} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: FT.INK, fontFamily: FT.FONT }}>
              {t[NAV_ITEMS[quickStep].labelKey]}
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: FT.TEXT_MUTED, fontFamily: FT.FONT, fontVariantNumeric: "tabular-nums" }}>
            {quickStep + 1} / {QUICK_TOTAL}
          </span>
        </div>
      ) : (
        <SectionNavigator
          sectionRefs={sectionRefs}
          navRef={navRef}
          activeSection={activeSection}
          completionHints={completionHints}
        />
      )}

      {/* ── Sections: locked when submitted (pointer-events + opacity) ── */}
      <div className="space-y-3" style={isSubmitted ? { opacity: 0.72, pointerEvents: "none", userSelect: "none" } : {}}>

      {/* ══════════════════════════════════════════════════════
          §1 — General Info
      ══════════════════════════════════════════════════════ */}
      <div ref={el => { sectionRefs.current[0] = el; }} style={quickMode && isMobile && quickStep !== 0 ? { display: "none" } : undefined}>
      <Section num={1} title={t.newReportGeneralInfo} icon={<Calendar className="w-4 h-4" />}
        headerRight={!reportId && prevReport ? (
          <button type="button" onClick={handleCopyPrevious}
            style={{ fontSize: 11, fontFamily: FT.FONT, fontWeight: 700, letterSpacing: "0.04em",
              padding: "3px 10px", border: `1.5px dashed ${FT.RULE}`, borderRadius: 6,
              background: "transparent", color: FT.TEXT_MUTED, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, textTransform: "uppercase",
              whiteSpace: "nowrap" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            {t.newReportCopyPrevBtn}
          </button>
        ) : undefined}>
        <div style={{ padding: isMobile ? "16px 12px" : "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* General info header — mobile puts Report No on its own row, then Shift + Date */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "72px 130px 1fr 148px", gap: 10, alignItems: "end" }}>

            {/* Col 1: Report No */}
            <div style={isMobile ? { gridColumn: "1 / -1", width: 72 } : undefined}>
              <FL>{t.newReportReportNo}</FL>
              <div style={{ width: 72, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", textAlign: "center", background: "#f9fafb", color: "#374151", fontFamily: "monospace" }}>
                {reportNumber || <span style={{ fontSize: 11, color: "#d1d5db", fontWeight: 400, fontStyle: "italic", fontFamily: "sans-serif" }}>auto…</span>}
              </div>
            </div>

            {/* Col 2: Shift */}
            <div>
              <FL>{t.newReportShift}</FL>
              <select data-testid="select-shift" value={shift} onChange={e => setShift(e.target.value)}
                style={{ width: "100%", height: 36, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111", background: "#fff", outline: "none", cursor: "pointer" }}>
                <option value="day">{t.newReportDayShift}</option>
                <option value="night">{t.newReportNightShift}</option>
                <option value="both">{t.newReportBothShifts}</option>
              </select>
            </div>

            {/* Col 3 mobile: Report Date — Col 3 desktop: Weather+Temp */}
            {isMobile ? (
              <div>
                <FL>{t.newReportReportDate}</FL>
                <input data-testid="input-report-date" type="date" value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  style={{ width: "100%", height: 36, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111", background: "#fff", outline: "none" }} />
              </div>
            ) : (
              <div>
                <FL>{t.newReportWeatherTemp}</FL>
                <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", height: 36, background: "#fff" }}>
                  <select data-testid="select-weather" value={weather} onChange={e => setWeather(e.target.value)}
                    style={{ flex: 1, border: "none", padding: "0 10px", fontSize: 13, color: "#111", background: "transparent", outline: "none", cursor: "pointer" }}>
                    <option value="clear">{t.newReportWClear}</option>
                    <option value="partly-cloudy">{t.newReportWPartlyCloudy}</option>
                    <option value="overcast">{t.newReportWOvercast}</option>
                    <option value="rain">{t.newReportWRain}</option>
                    <option value="wind">{t.newReportWWind}</option>
                    <option value="heat">{t.newReportWHeat}</option>
                  </select>
                  <div style={{ width: 1, background: "#e8e8e8", margin: "6px 0", flexShrink: 0 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px 0 8px", flexShrink: 0 }}>
                    <span style={{ color: "#f87171", fontSize: 10, fontWeight: 700 }}>H</span>
                    <input data-testid="input-temp-high" type="number" value={temperatureHigh} onChange={e => setTemperatureHigh(e.target.value)}
                      style={{ width: 40, textAlign: "center", border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#111" }} />
                    <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700 }}>L</span>
                    <input data-testid="input-temp-low" type="number" value={temperatureLow} onChange={e => setTemperatureLow(e.target.value)}
                      style={{ width: 40, textAlign: "center", border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#111" }} />
                    <span style={{ color: "#9ca3af", fontSize: 11, paddingRight: weatherAutoState === "idle" || weatherAutoState === "failed" ? 6 : 4 }}>°F</span>
                    {weatherAutoState === "loading" && (
                      <span style={{ fontSize: 9, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.02em", paddingRight: 4, display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
                        <svg style={{ animation: "spin 1s linear infinite", width: 10, height: 10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      </span>
                    )}
                    {weatherAutoState === "auto" && (
                      <span style={{ fontSize: 9, color: FT.ACCENT, fontWeight: 700, letterSpacing: "0.04em", paddingRight: 6, whiteSpace: "nowrap" }}>AUTO</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Col 4 desktop only: Report Date */}
            {!isMobile && (
              <div>
                <FL>{t.newReportReportDate}</FL>
                <input data-testid="input-report-date" type="date" value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  style={{ width: "100%", height: 36, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111", background: "#fff", outline: "none" }} />
              </div>
            )}
          </div>

          {/* ROW 1b — Weather + Temperature on mobile (full row) */}
          {isMobile && (
            <div>
              <FL>{t.newReportWeatherTemp}</FL>
              <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", height: 40, background: "#fff" }}>
                <select data-testid="select-weather" value={weather} onChange={e => setWeather(e.target.value)}
                  style={{ flex: 1, minWidth: 0, border: "none", padding: "0 8px", fontSize: 13, color: "#111", background: "transparent", outline: "none", cursor: "pointer" }}>
                  <option value="clear">{t.newReportWClear}</option>
                  <option value="partly-cloudy">{t.newReportWPartlyCloudy}</option>
                  <option value="overcast">{t.newReportWOvercast}</option>
                  <option value="rain">{t.newReportWRain}</option>
                  <option value="wind">{t.newReportWWind}</option>
                  <option value="heat">{t.newReportWHeat}</option>
                </select>
                <div style={{ width: 1, background: "#e8e8e8", margin: "6px 0", flexShrink: 0 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 6px", flexShrink: 0 }}>
                  <span style={{ color: "#f87171", fontSize: 10, fontWeight: 700 }}>H</span>
                  <input data-testid="input-temp-high" type="number" value={temperatureHigh} onChange={e => setTemperatureHigh(e.target.value)}
                    style={{ width: 36, textAlign: "center", border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#111" }} />
                  <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700 }}>L</span>
                  <input data-testid="input-temp-low" type="number" value={temperatureLow} onChange={e => setTemperatureLow(e.target.value)}
                    style={{ width: 36, textAlign: "center", border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#111" }} />
                  <span style={{ color: "#9ca3af", fontSize: 11, paddingRight: weatherAutoState === "idle" || weatherAutoState === "failed" ? 4 : 2 }}>°F</span>
                  {weatherAutoState === "loading" && (
                    <span style={{ fontSize: 9, color: "#9ca3af", fontWeight: 600, paddingRight: 4, display: "flex", alignItems: "center" }}>
                      <svg style={{ animation: "spin 1s linear infinite", width: 10, height: 10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    </span>
                  )}
                  {weatherAutoState === "auto" && (
                    <span style={{ fontSize: 9, color: FT.ACCENT, fontWeight: 700, letterSpacing: "0.04em", paddingRight: 4, whiteSpace: "nowrap" }}>AUTO</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ROW 2 — Reporter | Project Manager */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            <div>
              <FL>
                {t.newReportReporter}
                <span style={{ fontSize: 9, color: "#dc2626", fontWeight: 500, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>* {t.newReportRequired}</span>
              </FL>
              <PersonCardCombobox
                variant="reporter"
                value={preparedBy}
                allWorkers={activeWorkers}
                disabled={isSubmitted}
                testId="input-prepared-by"
                onChange={(name, id, trade) => { setPreparedBy(name); setPreparedById(id); setPreparedByTrade(trade ?? ""); }}
              />
            </div>
            <div>
              <FL>{t.newReportProjectManager}</FL>
              <PersonCardCombobox
                variant="pm"
                value={projectManager}
                allWorkers={activeWorkers}
                disabled={isSubmitted}
                testId="input-project-manager"
                onChange={(name, id, trade) => { setProjectManager(name); setProjectManagerId(id); setProjectManagerTrade(trade ?? ""); }}
              />
            </div>
          </div>

          {/* ROW 3 — Auto-filled strip */}
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", border: `1px solid ${FT.RULE}`, borderRadius: 10, background: FT.PAPER, overflow: "hidden" }}>
            <div style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderRight: isMobile ? "none" : `1px solid ${FT.RULE}`, borderBottom: isMobile ? `1px solid ${FT.RULE}` : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: FT.PAPER_MUTED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={FT.TEXT_MUTED} strokeWidth={2}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3, fontFamily: FT.FONT }}>{t.newReportProjectLocation}</div>
                <div data-testid="field-project-location" style={{ fontSize: 14, fontWeight: 600, color: FT.INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project?.jobLocation || "—"}</div>
              </div>
            </div>
            <div style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderRight: isMobile ? "none" : `1px solid ${FT.RULE}`, borderBottom: isMobile ? `1px solid ${FT.RULE}` : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: FT.PAPER_MUTED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={FT.TEXT_MUTED} strokeWidth={2}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3, fontFamily: FT.FONT }}>{t.newReportOwnerManager}</div>
                <div data-testid="field-project-owner" style={{ fontSize: 14, fontWeight: 600, color: FT.INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project?.ownerName || "—"}</div>
              </div>
            </div>
            <div style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: FT.PAPER_MUTED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={FT.TEXT_MUTED} strokeWidth={2}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3, fontFamily: FT.FONT }}>{t.newReportPONumber}</div>
                <div data-testid="field-project-po" style={{ fontSize: 14, fontWeight: 600, color: FT.INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project?.poNumber || "—"}</div>
              </div>
            </div>
          </div>

          {/* ROW 4 — Submit status bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderRadius: 10, background: preparedBy.trim() ? "#ecfdf5" : "#fffbeb", border: preparedBy.trim() ? "1.5px solid #6ee7b7" : "1.5px solid #fde68a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: preparedBy.trim() ? "#10b981" : "#f59e0b", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: preparedBy.trim() ? "#065f46" : "#92400e" }}>
                  {preparedBy.trim() ? t.newReportReadyToSubmit : t.newReportNotReady}
                </div>
                <div style={{ fontSize: 10, color: preparedBy.trim() ? "#6ee7b7" : "#fbbf24" }}>
                  {preparedBy.trim()
                    ? `${preparedBy}${preparedByTrade ? ` · ${preparedByTrade}` : ""}`
                    : t.newReportAddReporterHint}
                </div>
              </div>
            </div>
            {preparedBy.trim() ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>
              </svg>
            )}
          </div>

        </div>
      </Section>
      </div>{/* end §1 */}

      {/* ══════════════════════════════════════════════════════
          §2 — Manpower
      ══════════════════════════════════════════════════════ */}
      <div ref={el => { sectionRefs.current[1] = el; }} style={quickMode && isMobile && quickStep !== 1 ? { display: "none" } : undefined}>
      <Section num={2} title={t.newReportManpower} icon={<Users className="w-4 h-4" />} summary={mpSummary}
        headerRight={!isSubmitted ? (
          <button type="button" onClick={e => { e.stopPropagation(); importCrewDispatch(); }}
            className="flex items-center gap-1 whitespace-nowrap transition-colors"
            style={{ fontSize: 11, fontWeight: 700, fontFamily: FT.FONT, letterSpacing: "0.03em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 5, background: FT.PAPER_MUTED, border: `1px solid ${FT.RULE}`, color: FT.INK }}
            title={t.newReportCrewImportTitle}>
            <Users className="w-3 h-3" /> {t.newReportCrewImportBtn}
          </button>
        ) : undefined}>

        {/* Manpower table — no overflow-x-auto so dropdown panels are not clipped */}
        <div>
          {isMobile ? (
            /* ── Mobile: stacked worker cards ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 0 4px" }} data-testid="table-manpower">
              {manpower.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 0", fontSize: 13, color: FT.TEXT_MUTED, fontStyle: "italic" }}>{t.newReportNoWorkers}</div>
              )}
              {manpower.map((row, i) => {
                const takenIds    = new Set(manpower.filter((r) => r.id !== row.id).map((r) => r.workerId));
                const hoursActive = HOURS_COMPUTED.has(row.attendanceStatus);
                const sc = STATUS_COLOR_CFG[row.attendanceStatus] ?? { color: "#374151", bg: "#f9fafb", border: "#e5e7eb" };
                return (
                  <div key={row.id} style={{ border: `1.5px solid ${FT.INK}`, borderRadius: 10, padding: "12px 12px 10px", background: FT.PAPER, display: "flex", flexDirection: "column", gap: 9 }}>
                    {/* Row 1: Worker + Delete */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <WorkerCombobox row={row} allWorkers={activeWorkers} takenIds={takenIds}
                          testId={`input-mp-worker-${i}`}
                          onChange={(p) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, ...p } : r))} />
                      </div>
                      <DelBtn testId={`btn-remove-mp-${i}`} onClick={() => setManpower(manpower.filter((r) => r.id !== row.id))} />
                    </div>
                    {/* Row 2: Status + Hrs badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Select value={row.attendanceStatus}
                        onValueChange={(v) => {
                          const hrs = calcHours(row.startTime, row.endTime, v);
                          setManpower(manpower.map((r) => r.id === row.id ? { ...r, attendanceStatus: v, hoursWorked: hrs } : r));
                        }}>
                        <SelectTrigger data-testid={`select-mp-status-${i}`} className="h-9"
                          style={{ minWidth: 120, padding: "5px 28px 5px 10px", fontSize: 13, fontWeight: 700,
                            fontFamily: FT.FONT, letterSpacing: "0.02em", textTransform: "uppercase",
                            color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTENDANCE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hoursActive && !(quickMode && isMobile) && (
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontSize: 11, color: FT.TEXT_MUTED, fontFamily: FT.FONT, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.newReportColHrs}</span>
                          <span style={{ fontSize: 22, fontWeight: 800, color: FT.ACCENT, fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: FT.FONT }}>{row.hoursWorked.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {/* Row 3: Start + End (only when time matters) */}
                    {hoursActive && !(quickMode && isMobile) && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {(["start", "end"] as const).map((which) => {
                          const val = which === "start" ? row.startTime : row.endTime;
                          return (
                            <div key={which} style={{ display: "flex", alignItems: "center", padding: "6px 9px", gap: 6, height: 40, border: "1px solid #e0e0e0", borderRadius: 8 }}>
                              <svg style={{ color: "#ccc", flexShrink: 0, width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                              </svg>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                                {which === "start" ? t.newReportStart : t.newReportEnd}
                              </span>
                              <input data-testid={which === "start" ? `input-mp-start-${i}` : `input-mp-end-${i}`}
                                type="time" value={val}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const hrs = which === "start"
                                    ? calcHours(v, row.endTime, row.attendanceStatus)
                                    : calcHours(row.startTime, v, row.attendanceStatus);
                                  setManpower(manpower.map((r) => r.id === row.id ? { ...r, [which === "start" ? "startTime" : "endTime"]: v, hoursWorked: hrs } : r));
                                }}
                                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, padding: 0, colorScheme: "light" as any }} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Row 4: Notes */}
                    {!(quickMode && isMobile) && (
                    <Input data-testid={`input-mp-notes-${i}`} value={row.notes}
                      onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className={cellInputCls} placeholder={t.newReportOptional}
                      style={{ fontSize: 13, color: row.notes ? "#1a1a1a" : "#bbb" }} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Desktop: original table ── */
            <table className="text-sm w-full" data-testid="table-manpower">
              <TH cols={[
                { label: t.newReportColWorkerName, cls: "w-[280px]" },
                { label: t.newReportColStatusH,    cls: "w-[130px]" },
                { label: t.newReportStart,         cls: "w-[76px]" },
                { label: t.newReportEnd,           cls: "w-[76px]" },
                { label: t.newReportColHrs,        cls: "w-[48px] text-center" },
                { label: t.newReportColNotes,      cls: "w-[130px] text-center" },
              ]} />
              <tbody>
                {manpower.length === 0 && (
                  <tr><td colSpan={8} className="py-7 text-center text-xs text-slate-300 italic">
                    {t.newReportNoWorkers}
                  </td></tr>
                )}
                {manpower.map((row, i) => {
                  const takenIds    = new Set(manpower.filter((r) => r.id !== row.id).map((r) => r.workerId));
                  const hoursActive = HOURS_COMPUTED.has(row.attendanceStatus);
                  return (
                    <tr key={row.id} className="last:border-0 group" style={{ borderBottom: `1px solid ${FT.RULE}` }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = FT.PAPER_MUTED; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      {/* Worker Name */}
                      <td className="py-1.5 px-2.5">
                        <WorkerCombobox row={row} allWorkers={activeWorkers} takenIds={takenIds}
                          testId={`input-mp-worker-${i}`}
                          onChange={(p) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, ...p } : r))} />
                      </td>
                      {/* Status */}
                      <td className="py-1.5 px-2.5">
                        {(() => {
                          const sc = STATUS_COLOR_CFG[row.attendanceStatus] ?? { color: "#374151", bg: "#f9fafb", border: "#e5e7eb" };
                          return (
                            <Select value={row.attendanceStatus}
                              onValueChange={(v) => {
                                const hrs = calcHours(row.startTime, row.endTime, v);
                                setManpower(manpower.map((r) => r.id === row.id ? { ...r, attendanceStatus: v, hoursWorked: hrs } : r));
                              }}>
                              <SelectTrigger data-testid={`select-mp-status-${i}`} className="h-8"
                                style={{ minWidth: "120px", width: "120px", padding: "5px 24px 5px 8px",
                                  fontSize: row.attendanceStatus === "EARLY_LEAVE" ? 10.5 : 11, fontWeight: 600,
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                  color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ATTENDANCE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </td>
                      {/* Start */}
                      <td className="py-1.5 px-2.5">
                        <div style={{ display: "flex", alignItems: "center", padding: "5px 7px", gap: 5, height: 32,
                          border: "1px solid #e0e0e0", borderRadius: 7,
                          opacity: !hoursActive ? 0.4 : 1, pointerEvents: !hoursActive ? "none" : "auto" }}>
                          <svg style={{ color: "#ccc", flexShrink: 0, width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <input data-testid={`input-mp-start-${i}`} type="time" value={row.startTime} disabled={!hoursActive}
                            onChange={(e) => {
                              const hrs = calcHours(e.target.value, row.endTime, row.attendanceStatus);
                              setManpower(manpower.map((r) => r.id === row.id ? { ...r, startTime: e.target.value, hoursWorked: hrs } : r));
                            }}
                            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, padding: 0, colorScheme: "light" as any }} />
                        </div>
                      </td>
                      {/* End */}
                      <td className="py-1.5 px-2.5">
                        <div style={{ display: "flex", alignItems: "center", padding: "5px 7px", gap: 5, height: 32,
                          border: "1px solid #e0e0e0", borderRadius: 7,
                          opacity: !hoursActive ? 0.4 : 1, pointerEvents: !hoursActive ? "none" : "auto" }}>
                          <svg style={{ color: "#ccc", flexShrink: 0, width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <input data-testid={`input-mp-end-${i}`} type="time" value={row.endTime} disabled={!hoursActive}
                            onChange={(e) => {
                              const hrs = calcHours(row.startTime, e.target.value, row.attendanceStatus);
                              setManpower(manpower.map((r) => r.id === row.id ? { ...r, endTime: e.target.value, hoursWorked: hrs } : r));
                            }}
                            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, padding: 0, colorScheme: "light" as any }} />
                        </div>
                      </td>
                      {/* Hrs */}
                      <td className="py-1.5 px-2.5">
                        <ROCell center>
                          {hoursActive ? row.hoursWorked.toFixed(1) : <span className="text-slate-300">—</span>}
                        </ROCell>
                      </td>
                      {/* Notes */}
                      <td className="py-1.5 px-2.5" style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <Input data-testid={`input-mp-notes-${i}`} value={row.notes}
                          onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                          className={cellInputCls} placeholder={t.newReportOptional}
                          style={{ textAlign: "center", fontSize: 12, color: row.notes ? "#1a1a1a" : "#bbb" }} />
                      </td>
                      <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DelBtn testId={`btn-remove-mp-${i}`} onClick={() => setManpower(manpower.filter((r) => r.id !== row.id))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Summary bar — full-width flex div, not a table row */}
          {manpower.length > 0 && (
            <div data-testid="manpower-summary-bar" style={{
              borderTop: `1px solid ${FT.RULE}`, background: FT.PAPER_MUTED,
              padding: "9px 14px", display: "flex", flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 0,
               width: "100%", minWidth: 0, boxSizing: "border-box", overflow: "hidden",
            }}>
              {/* Left: label, Present, Exceptions */}
              <div style={{
                flex: 1, minWidth: isMobile ? 0 : undefined, width: isMobile ? "100%" : undefined,
                display: isMobile ? "grid" : "flex",
                gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
                alignItems: isMobile ? "start" : "center",
                gap: isMobile ? 6 : 14, flexWrap: "wrap",
              }}>
                <span style={{
                  minWidth: 0, fontSize: 13, fontWeight: 800, color: FT.INK,
                  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: FT.FONT,
                  overflowWrap: isMobile ? "anywhere" : undefined,
                }}>
                  {t.newReportMpSummary}
                </span>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4, minWidth: isMobile ? 0 : undefined,
                  paddingRight: isMobile ? 0 : 12, marginRight: 0,
                  borderRight: isMobile ? "none" : `1px solid ${FT.RULE}`,
                }}>
                  <span style={{
                    minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
                    overflowWrap: isMobile ? "anywhere" : undefined,
                  }}>{t.newReportMpPresent}</span>
                  <span style={{ flexShrink: isMobile ? 0 : undefined, fontSize: 13, fontWeight: 800, color: FT.SUCCESS, fontVariantNumeric: "tabular-nums", fontFamily: FT.FONT }}>{presentCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: isMobile ? 0 : undefined }}>
                  <span style={{
                    minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
                    overflowWrap: isMobile ? "anywhere" : undefined,
                  }}>{t.newReportMpExceptions}</span>
                  <span style={{ flexShrink: isMobile ? 0 : undefined, fontSize: 13, fontWeight: 800, color: exceptionsCount > 0 ? FT.ACCENT : FT.TEXT_MUTED, fontVariantNumeric: "tabular-nums", fontFamily: FT.FONT }}>{exceptionsCount}</span>
                </div>
              </div>
              {/* Right: Total Work Hrs, Issues */}
              <div style={{
                display: isMobile ? "grid" : "flex",
                gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
                alignItems: isMobile ? "start" : "center",
                gap: isMobile ? 6 : 14,
                flexShrink: isMobile ? 1 : 0, minWidth: isMobile ? 0 : undefined,
                width: isMobile ? "100%" : undefined, flexWrap: isMobile ? "wrap" : undefined,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: isMobile ? 0 : undefined }}>
                  <span style={{
                    minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
                    whiteSpace: isMobile ? "normal" : "nowrap",
                    overflowWrap: isMobile ? "anywhere" : undefined,
                  }}>{t.newReportMpTotalHrs}</span>
                  <span style={{ flexShrink: isMobile ? 0 : undefined, fontSize: 22, fontWeight: 800, color: exceptionsCount > 0 ? FT.ACCENT : FT.SUCCESS, fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: FT.FONT }}>
                    {totalManhours.toFixed(1)}
                  </span>
                </div>
                {exceptionsCount === 0 ? (
                  <span style={{
                    minWidth: 0, fontSize: 13, color: FT.TEXT_MUTED,
                    whiteSpace: isMobile ? "normal" : "nowrap",
                    overflowWrap: isMobile ? "anywhere" : undefined,
                    textAlign: isMobile ? "left" : undefined,
                  }}>{t.newReportMpIssuesNone}</span>
                ) : (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 4, background: FT.ACCENT,
                    fontSize: 11, fontWeight: 700, color: "#fff",
                    whiteSpace: isMobile ? "normal" : "nowrap", minWidth: isMobile ? 0 : undefined,
                    maxWidth: isMobile ? "100%" : undefined, textAlign: isMobile ? "center" : undefined, fontFamily: FT.FONT,
                    letterSpacing: "0.03em", overflowWrap: isMobile ? "anywhere" : undefined,
                  }}>
                    <span style={{ flexShrink: 0 }}>⚠</span>
                    <span style={{ minWidth: 0, overflowWrap: isMobile ? "anywhere" : undefined }}>
                      {exceptionsCount} {t.newReportMpFlagged}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <AddRow testId="btn-add-manpower" label={t.newReportAddWorker}
          onClick={() => setManpower([...manpower, {
            id: uid(), workerId: null, workerName: "", trade: "",
            attendanceStatus: "ATTEND",
            startTime: "07:00", endTime: "17:00",
            hoursWorked: calcHours("07:00", "17:00", "ATTEND"),
            notes: "",
          }])} />

        {activeWorkers.length === 0 && (
          <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            {t.newReportNoRegisteredWorkers}
          </p>
        )}
      </Section>
      </div>{/* end §2 */}

      {/* ══════════════════════════════════════════════════════
          §3 — Work Tasks
      ══════════════════════════════════════════════════════ */}
      <div ref={el => { sectionRefs.current[2] = el; }} style={quickMode && isMobile && quickStep !== 2 ? { display: "none" } : undefined}>
      <Section num={3} title={t.newReportWorkTasks} icon={<FileText className="w-4 h-4" />} summary={taskSummary} headerRight={taskStatusChips}>

        {/* ── Drawing Board ── */}
        <div style={{ border: "1px solid #d0dbd2", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>

          {/* Header */}
          <div style={{ padding: "9px 14px", background: "#f4f7f5", borderBottom: drawingUrl ? "1px solid #e2e8e4" : undefined, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: "#3d5c45" }}>
              {t.newReportProjectDrawingBoard}{drawingFilename ? ` · ${drawingFilename}` : ""}
            </span>
            {drawingUrl ? (
              <>
                <button type="button" onClick={() => drawingInputRef.current?.click()}
                  style={{ fontSize: 10.5, padding: "3px 9px", border: "1px solid #d0dbd2", borderRadius: 5, background: "white", color: "#3d5c45", cursor: "pointer" }}>
                  {t.newReportReplace}
                </button>
                <button type="button" onClick={() => setDrawingCollapsed(c => !c)}
                  style={{ fontSize: 10.5, padding: "3px 9px", border: "1px solid #d0dbd2", borderRadius: 5, background: "white", color: "#3d5c45", cursor: "pointer" }}>
                  {drawingCollapsed ? t.newReportExpand : t.newReportCollapse}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => drawingInputRef.current?.click()}
                style={{ fontSize: 11, padding: "3px 9px", border: `1.5px dashed ${FT.RULE}`, borderRadius: 5, background: "transparent", color: FT.TEXT_MUTED, cursor: "pointer", fontWeight: 700, fontFamily: FT.FONT }}>
                {t.newReportUploadDrawing}
              </button>
            )}
          </div>

          {/* Body */}
          {!drawingUrl ? (
            /* Empty upload area */
            <div style={{ padding: "18px 18px 14px", background: "transparent" }}
              onClick={() => drawingInputRef.current?.click()}>
              <div style={{
                border: `1.5px dashed ${FT.RULE}`, borderRadius: 8, minHeight: 110,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 6, cursor: "pointer", padding: 20,
              }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>📐</span>
                <p style={{ fontSize: 11, color: FT.TEXT_MUTED, textAlign: "center" }}>{t.newReportUploadHint1}</p>
                <p style={{ fontSize: 11, color: FT.TEXT_MUTED, textAlign: "center" }}>{t.newReportUploadHint2}</p>
              </div>
            </div>
          ) : drawingCollapsed ? (
            /* Collapsed summary bar */
            <div style={{ padding: "7px 14px", background: FT.PAPER_MUTED, borderTop: `1px solid ${FT.RULE}`, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: FT.TEXT_MUTED }}>
              <span style={{ flex: 1 }}>{drawingFilename}</span>
              <button type="button" onClick={() => setDrawingCollapsed(false)}
                style={{ fontSize: 11, color: FT.TEXT_MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {t.newReportExpandDrawing}
              </button>
            </div>
          ) : (
            /* Drawing canvas */
            <div style={{ position: "relative", background: "#f1f5f2" }}>
              {drawingFilename.toLowerCase().endsWith(".pdf") ? (
                <PdfViewer
                  url={drawingUrl!}
                  filename={drawingFilename}
                  onReplaceClick={() => drawingInputRef.current?.click()}
                />
              ) : (
                <img src={drawingUrl!} alt="Project drawing"
                  style={{ width: "100%", height: "auto", objectFit: "contain", display: "block", background: "#f1f5f2" }} />
              )}
            </div>
          )}
        </div>
        <input ref={drawingInputRef} type="file" accept="image/*,.pdf,.dwg" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            setDrawingUrl(url); setDrawingFilename(file.name);
            setDrawingCollapsed(false);
            e.target.value = "";
          }} />
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file || photoTaskId === null) return;
            const reader = new FileReader();
            reader.onload = ev => {
              const dataUrl = ev.target?.result as string;
              setTasks(prev => prev.map(r => r.id === photoTaskId
                ? { ...r, photoFiles: [...r.photoFiles, { url: dataUrl, workDescription: "", memo: "" }].slice(0, 4) } : r));
            };
            reader.readAsDataURL(file);
            e.target.value = "";
            setPhotoTaskId(null);
          }} />

        {/* Empty state */}
        {tasks.length === 0 && (
          <p className="py-7 text-center text-xs text-slate-300 italic">{t.newReportNoTasksClickAdd}</p>
        )}

        {/* Task cards */}
        <div className="space-y-[10px]" data-testid="task-cards">
          {tasks.map((row, i) => {
            const cfg = TASK_STATUS_CFG[row.status] ?? TASK_STATUS_CFG["not-started"];

            return (
              <div key={row.id} data-testid={`task-card-${i}`} className="group"
                style={{ background: "white", border: "1px solid #d0dbd2", borderLeft: `4px solid ${cfg.accentColor}`, borderRadius: 10 }}>

                {/* ── Main row ── */}
                <div
                  onClick={() => setTasks(tasks.map(r => r.id === row.id ? { ...r, expanded: !r.expanded } : r))}
                  className="cursor-pointer hover:bg-[#f8faf9] transition-colors"
                  style={{ display: "flex", alignItems: "center", minHeight: 56, paddingRight: isMobile ? 8 : 12 }}>

                  {/* Task # */}
                  <button type="button"
                    data-testid={`btn-toggle-task-${i}`}
                    aria-label={row.expanded ? "Collapse task details" : "Expand task details"}
                    aria-expanded={row.expanded}
                    aria-controls={`task-detail-${row.id}`}
                    onClick={e => {
                      e.stopPropagation();
                      setTasks(tasks.map(r => r.id === row.id ? { ...r, expanded: !r.expanded } : r));
                    }}
                    className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f7d46]"
                    style={{ background: "transparent", border: "none", fontSize: 10, fontWeight: 700, color: "#9db8a2", flexShrink: 0, padding: isMobile ? "0 6px 0 8px" : "0 8px 0 12px" }}>
                    #{i + 1}
                  </button>

                  {/* Description — flex:1 */}
                  <div style={{ flex: isMobile ? "1 1 0" : "1 1 auto", minWidth: isMobile ? 72 : 0 }} onClick={e => e.stopPropagation()}>
                    <Input data-testid={`input-task-desc-${i}`} value={row.description}
                      onChange={e => setTasks(tasks.map(r => r.id === row.id ? { ...r, description: e.target.value } : r))}
                      className="shadow-none h-auto focus-visible:ring-0 border-0 bg-transparent font-semibold placeholder:italic placeholder:text-[#999] truncate w-full p-0"
                      style={{ fontSize: 13, color: "#1a1a1a" }}
                      placeholder={t.newReportTaskDescPh} />
                  </div>

                  {/* Divider */}
                  <span style={{ width: 1, height: 22, background: "#f0f0f0", margin: isMobile ? "0 6px" : "0 10px", flexShrink: 0 }} />

                  {/* Status Select — single dot badge style */}
                  <div style={{ flex: "0 0 auto", width: isMobile ? "max-content" : undefined, minWidth: isMobile ? 100 : undefined }} onClick={e => e.stopPropagation()}>
                    <Select value={row.status} onValueChange={v => setTasks(tasks.map(r => r.id === row.id ? { ...r, status: v } : r))}>
                      <SelectTrigger data-testid={`select-task-status-${i}`}
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: isMobile ? 4 : 7,
                          width: "100%", borderRadius: 20, padding: isMobile ? "5px 6px" : "5px 10px 5px 13px",
                          fontSize: isMobile ? 11 : 12, fontWeight: 600, whiteSpace: "nowrap",
                          border: `1px solid ${cfg.badgeBorder}`,
                          background: cfg.badgeBg, color: cfg.badgeText,
                          height: "auto", minWidth: isMobile ? "max-content" : 0, boxShadow: "none",
                        }}>
                        <SelectValue style={{ whiteSpace: "nowrap" }} />
                      </SelectTrigger>
                      <SelectContent style={{ minWidth: isMobile ? "max-content" : undefined }}>
                        {Object.entries(TASK_STATUS_CFG).map(([val, c]) => (
                          <SelectItem key={val} value={val}>
                            <span className="flex items-center gap-2" style={{ whiteSpace: "nowrap" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dotColor, display: "inline-block", flexShrink: 0 }} />
                              {taskStatusLabel(val, t)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Chevron + delete */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: isMobile ? 0 : 8, flexShrink: 0 }}>
                    {!isMobile && (
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${row.expanded ? "rotate-180" : ""}`} />
                    )}
                    <button type="button" data-testid={`btn-remove-task-${i}`}
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(row.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── Delete confirm bar ── */}
                {deleteConfirm === row.id && (
                  <div style={{ background: "#fee2e2", borderTop: "1px solid #fecaca", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#dc2626" }}
                    onClick={e => e.stopPropagation()}>
                    <span style={{ flex: 1 }}>{t.newReportDeleteThisTask}</span>
                    <button type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2.5 py-1 text-slate-600 border border-slate-200 rounded text-[11px] bg-white hover:bg-slate-50 transition-colors">
                      {t.newReportCancel}
                    </button>
                    <button type="button"
                      onClick={() => handleDeleteTask(row, i)}
                      className="px-2.5 py-1 text-white rounded text-[11px] hover:bg-red-700 transition-colors"
                      style={{ background: "#dc2626" }}>
                      {t.newReportDelete}
                    </button>
                  </div>
                )}

                {/* ── Detail panel ── */}
                {row.expanded && (
                  <div id={`task-detail-${row.id}`} style={{ background: "#f8faf9", borderTop: "1px solid #e2e8e4", padding: 16, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 0.9fr", gap: 0 }}>

                      {/* Col B: 작업사진 — 2×2 photo grid with per-photo Work Description / Memo */}
                      <div style={{ padding: isMobile ? "0 0 12px 0" : "0 16px 0 0", borderRight: isMobile ? "none" : "1px solid #f5f5f5", borderBottom: isMobile ? "1px solid #f5f5f5" : "none" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, fontFamily: FT.FONT, color: FT.TEXT_MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                          {t.newReportWorkPhotos}{row.photoFiles.length > 0 && <span style={{ color: FT.ACCENT, marginLeft: 4 }}>({row.photoFiles.length})</span>}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {([[0, 1], [2, 3]] as [number, number][]).map(([a, b]) => {
                            const photoA = row.photoFiles[a];
                            const photoB = row.photoFiles[b];
                            const hasPair = !!(photoA || photoB);
                            return (
                              <div key={a}>
                                {/* Photo thumbnails */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: hasPair ? 8 : 0 }}>
                                  {([a, b] as number[]).map(slotIdx => {
                                    const photo = row.photoFiles[slotIdx];
                                    if (photo) {
                                      return (
                                        <div key={slotIdx} style={{
                                          border: "1.5px solid #e0e0e0", borderRadius: 10,
                                          position: "relative", overflow: "hidden", background: "#1a1a2e",
                                        }}>
                                          <img src={photo.url} alt={`Photo ${slotIdx + 1}`}
                                            style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                                          <button type="button"
                                            onClick={() => setTasks(tasks.map(r => r.id === row.id
                                              ? { ...r, photoFiles: r.photoFiles.filter((_, fi) => fi !== slotIdx) } : r))}
                                            style={{
                                              position: "absolute", bottom: 8, right: 8,
                                              width: 24, height: 24, borderRadius: "50%",
                                              background: "rgba(0,0,0,0.55)",
                                              border: "1.5px solid rgba(255,255,255,0.3)",
                                              color: "#fff", fontSize: 10, cursor: "pointer",
                                              display: "flex", alignItems: "center", justifyContent: "center",
                                              zIndex: 2, backdropFilter: "blur(4px)",
                                              transition: "background 0.15s, transform 0.12s",
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f43f5e"; (e.currentTarget as HTMLElement).style.borderColor = "#f43f5e"; (e.currentTarget as HTMLElement).style.transform = "scale(1.1)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.55)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}>
                                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>
                                          </button>
                                        </div>
                                      );
                                    }
                                    return (
                                      <button key={slotIdx} type="button"
                                        onClick={() => { setPhotoTaskId(row.id); photoInputRef.current?.click(); }}
                                        style={{
                                          border: `1.5px dashed ${FT.RULE}`, borderRadius: 10,
                                          aspectRatio: "1", display: "flex", flexDirection: "column",
                                          alignItems: "center", justifyContent: "center",
                                          background: FT.PAPER, cursor: "pointer",
                                          transition: "border-color 0.15s, background 0.15s",
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = FT.ACCENT; (e.currentTarget as HTMLElement).style.background = FT.PAPER_MUTED; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = FT.RULE; (e.currentTarget as HTMLElement).style.background = FT.PAPER; }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FT.TEXT_MUTED} strokeWidth="1.5" style={{ marginBottom: 4 }}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                                        <span style={{ fontSize: 11, color: FT.TEXT_MUTED }}>{t.newReportAddPhoto}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Per-photo Work Description + Memo — only for pairs that have at least one photo */}
                                {hasPair && (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    {([a, b] as number[]).map(slotIdx => {
                                      const photo = row.photoFiles[slotIdx];
                                      if (!photo) return <div key={slotIdx} />;
                                      return (
                                        <div key={slotIdx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                          <p style={{ fontSize: 11, fontWeight: 700, fontFamily: FT.FONT, color: FT.TEXT_MUTED, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>{t.newReportPhotoWorkDesc}</p>
                                          <input
                                            type="text"
                                            placeholder={t.newReportPhotoWorkDescPh}
                                            value={photo.workDescription}
                                            onChange={e => setTasks(tasks.map(r => r.id === row.id
                                              ? { ...r, photoFiles: r.photoFiles.map((pf, i) => i === slotIdx ? { ...pf, workDescription: e.target.value } : pf) } : r))}
                                            style={{
                                              border: `1px solid ${FT.RULE}`, borderRadius: 6, padding: "4px 8px",
                                              fontSize: 13, width: "100%", background: FT.PAPER, outline: "none",
                                              transition: "border-color 0.15s",
                                            }}
                                            onFocus={e => (e.currentTarget.style.borderColor = FT.ACCENT)}
                                            onBlur={e => (e.currentTarget.style.borderColor = FT.RULE)}
                                          />
                                          <p style={{ fontSize: 11, fontWeight: 700, fontFamily: FT.FONT, color: FT.TEXT_MUTED, letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>{t.newReportPhotoMemo}</p>
                                          <textarea
                                            placeholder={t.newReportPhotoMemoPh}
                                            value={photo.memo}
                                            onChange={e => setTasks(tasks.map(r => r.id === row.id
                                              ? { ...r, photoFiles: r.photoFiles.map((pf, i) => i === slotIdx ? { ...pf, memo: e.target.value } : pf) } : r))}
                                            rows={2}
                                            style={{
                                              border: "1px solid #ebebeb", borderRadius: 6, padding: "4px 8px",
                                              fontSize: 11, width: "100%", background: "#fff", resize: "none", outline: "none",
                                              transition: "border-color 0.15s",
                                            }}
                                            onFocus={e => (e.currentTarget.style.borderColor = "#818cf8")}
                                            onBlur={e => (e.currentTarget.style.borderColor = "#ebebeb")}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Col C: Notes */}
                      <div style={{ paddingLeft: 16 }}>
                        {/* Notes */}
                        <p style={{ fontSize: 11, fontWeight: 700, fontFamily: FT.FONT, color: FT.TEXT_MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>{t.newReportNotes}</p>
                        <Textarea value={row.detailNotes}
                          onChange={e => setTasks(tasks.map(r => r.id === row.id ? { ...r, detailNotes: e.target.value } : r))}
                          placeholder={t.newReportTaskNotesPh}
                          style={{
                            border: "1px solid #ebebeb", borderRadius: 8,
                            padding: "8px 10px", fontSize: 12, width: "100%",
                            background: "#fff", resize: "none", minHeight: 130,
                          }}
                          className="shadow-none focus-visible:ring-0 focus-visible:border-[#818cf8] placeholder:text-[11px] placeholder:italic placeholder:text-[#ccc]" />
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <AddRow testId="btn-add-task" label={t.newReportAddTask}
          onClick={() => setTasks([...tasks, {
            id: uid(), description: "", area: "", status: "in-progress", notes: "",
            expanded: false, detailNotes: "", drawingFiles: [], photoFiles: [] as PhotoFile[],
          }])} />

        {/* ── Undo toast ── */}
        {undoState && (
          <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "#1f2937", color: "white", borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 9999,
            minWidth: 240, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 18px" }}>
              <span style={{ flex: 1, fontSize: 11.5 }}>{t.newReportTaskDeleted}</span>
              <button type="button" onClick={handleUndo}
                style={{ color: "#86efac", fontWeight: 700, fontSize: 11.5, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {t.newReportUndo}
              </button>
            </div>
            <div style={{ height: 3, background: "#374151" }}>
              <div style={{ height: "100%", background: "#86efac", width: `${undoState.progress}%`, transition: "width 0.1s linear" }} />
            </div>
          </div>
        )}
      </Section>
      </div>{/* end §3 */}

      {/* ══════════════════════════════════════════════════════
          §4 — Materials
      ══════════════════════════════════════════════════════ */}
      <div ref={el => { sectionRefs.current[3] = el; }} style={quickMode && isMobile && quickStep !== 3 ? { display: "none" } : undefined}>
      <Section num={4} title={t.newReportMaterials} icon={<Package className="w-4 h-4" />} summary={matSummary} defaultOpen={false}
        headerRight={!isSubmitted && scopeItems.filter((s: any) => s.isActive).length > 0 ? (
          <button type="button" onClick={e => { e.stopPropagation(); importScopeItems(); }}
            className="flex items-center gap-1 whitespace-nowrap transition-colors"
            style={{ fontSize: 11, fontWeight: 700, fontFamily: FT.FONT, letterSpacing: "0.03em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 5, background: FT.PAPER_MUTED, border: `1px solid ${FT.RULE}`, color: FT.INK }}
            title={t.newReportScopeImportTitle}>
            <Package className="w-3 h-3" /> {t.newReportScopeImportBtn}
          </button>
        ) : undefined}>
        {isMobile ? (
          /* ── Mobile: material cards ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 0 4px" }} data-testid="table-materials">
            {materials.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 0", fontSize: 13, color: FT.TEXT_MUTED, fontStyle: "italic" }}>{t.newReportNoMaterials}</div>
            )}
            {(() => {
              const mobileNodes: React.ReactNode[] = [];
              let lastMobileSection: string | null | undefined = undefined;
              materials.forEach((row, i) => {
                const sec = row.section ?? null;
                if (sec !== lastMobileSection) {
                  lastMobileSection = sec;
                  if (sec) {
                    mobileNodes.push(
                      <div key={`sec-${sec}`}
                        style={{ padding: "7px 12px", background: FT.INK, borderRadius: 6, fontSize: 12, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
                        {sec}
                      </div>
                    );
                  }
                }
                const isExtra = row.scopeItemId === null && row.description.trim() !== "";
                mobileNodes.push(
                /* ── 2-row compact card: name full-width top, spec+qty+unit bottom ── */
                <div key={row.id} ref={(el) => { matRowRefs.current[i] = el; }}
                  style={{ border: `1px solid ${FT.RULE}`, borderLeft: isExtra ? `3px solid ${FT.ACCENT}` : `1px solid ${FT.RULE}`, borderRadius: 8, padding: "8px", background: FT.PAPER, display: "flex", flexDirection: "column", gap: 7, minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                  {/* Name + delete — name can grow over multiple lines */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: "visible" }}>
                      <MaterialSearch row={row} inventoryItems={inventoryItems} testId={`input-mat-desc-${i}`}
                        onChange={(p) => {
                          let patch: Partial<MaterialRow> = { ...p };
                          if (p.inventoryItemId !== undefined && p.inventoryItemId !== null) {
                            const matched = scopeItems.find((s: any) => s.linkedInventoryItemId === p.inventoryItemId);
                            if (matched) patch.scopeItemId = matched.id;
                            flashRow(i);
                          }
                          setMaterials(materials.map((r) => r.id === row.id ? { ...r, ...patch } : r));
                        }} />
                    </div>
                    {/* Only extra materials are deletable by all users; scope items require admin */}
                    {(isExtra || isAdminRole) && (
                      <button type="button" data-testid={`btn-remove-mat-${i}`}
                        aria-label={t.newReportDelete}
                        title={t.newReportDelete}
                        onClick={() => setMaterials(materials.filter((r) => r.id !== row.id))}
                        style={{ width: 28, height: 26, borderRadius: 6, background: "transparent", border: `1px solid ${FT.RULE}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: FT.TEXT_MUTED, flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = FT.PAPER_MUTED; e.currentTarget.style.borderColor = FT.ACCENT; e.currentTarget.style.color = FT.ACCENT; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = FT.RULE; e.currentTarget.style.color = FT.TEXT_MUTED; }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                  {/* Specification gets its own line so it never competes with quantity controls */}
                  <AutoSizeTextarea data-testid={`input-mat-spec-${i}`} value={row.spec}
                    onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, spec: e.target.value } : r))}
                    placeholder={t.newReportSpec}
                    style={{ width: "100%", minHeight: 18, padding: 0, border: "none", background: "transparent", outline: "none", boxShadow: "none", resize: "none", overflow: "hidden", overflowWrap: "anywhere", fontSize: 11, lineHeight: 1.45, color: row.spec ? "#6b7280" : "#d1d5db", boxSizing: "border-box" }} />
                  {/* Badges and quantity controls use a dedicated bottom row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flexWrap: "wrap" }}>
                      {row.inventoryItemId && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#2e7d32", background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 4, padding: "0px 4px", flexShrink: 0 }}>{t.newReportInv}</span>
                      )}
                      {isExtra && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: FT.ACCENT, background: "transparent", border: `1px solid ${FT.ACCENT}`, borderRadius: 3, padding: "0px 4px", fontFamily: FT.FONT, flexShrink: 0 }}>{t.newReportMaterialExtraLabel}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}>
                      <input data-testid={`input-mat-qty-${i}`} type="number" min={0} value={row.qty}
                        onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, qty: Math.max(0, Number(e.target.value)) } : r))}
                        onInput={(e) => { const v = (e.target as HTMLInputElement); if (Number(v.value) < 0) v.value = "0"; }}
                        style={{ width: 52, height: 32, fontSize: 14, fontWeight: 600, textAlign: "center", border: `1px solid ${FT.RULE}`, borderRadius: 6, background: "#fff", outline: "none", color: "#374151", flexShrink: 0 }} />
                      {row.inventoryItemId ? (
                        <span data-testid={`input-mat-unit-${i}`} style={{ fontSize: 12, fontWeight: 700, color: "#666", flexShrink: 0, minWidth: 22 }}>{row.unit || "EA"}</span>
                      ) : (
                        <input data-testid={`input-mat-unit-${i}`} value={row.unit}
                          onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                          placeholder="EA"
                          style={{ width: 30, fontSize: 12, fontWeight: 700, textAlign: "center", border: "none", background: "transparent", outline: "none", color: "#666", flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                </div>
                );
              });
              return mobileNodes;
            })()}
          </div>
        ) : (
          /* ── Desktop: original table ── */
          <div>
          <table className="text-sm w-full" style={{ tableLayout: "fixed" }} data-testid="table-materials">
            <colgroup>
              <col style={{ width: matColWidths.photo }} />
              <col />
              <col style={{ width: matColWidths.spec }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 44 }} />
              <col style={{ width: 32 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: `1px solid ${FT.RULE}`, background: FT.PAPER_MUTED }}>
                <th className="py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap select-none" style={{ position: "relative" }}>
                  {t.newReportPhoto}
                  <div onMouseDown={startMatColDrag("photo")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize" }} />
                </th>
                <th className="py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-left whitespace-nowrap">{t.newReportMaterialName}</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-left whitespace-nowrap select-none" style={{ position: "relative" }}>
                  {t.newReportSpec}
                  <div onMouseDown={startMatColDrag("spec")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize" }} />
                </th>
                <th colSpan={2} className="py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-center">{t.newReportQtyUnit}</th>
                <th className="py-2 px-1" />
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 && (
                <tr><td colSpan={6} className="py-7 text-center text-xs text-slate-300 italic">{t.newReportNoMaterials}</td></tr>
              )}
              {(() => {
                const deskRows: React.ReactNode[] = [];
                let lastDeskSection: string | null | undefined = undefined;
                materials.forEach((row, i) => {
                  const sec = row.section ?? null;
                  if (sec !== lastDeskSection) {
                    lastDeskSection = sec;
                    if (sec) {
                      deskRows.push(
                        <tr key={`sec-${sec}`} style={{ background: "#f8fafc" }}>
                          <td colSpan={6} style={{ padding: "5px 8px 3px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${FT.RULE}` }}>
                            {sec}
                          </td>
                        </tr>
                      );
                    }
                  }
                  const linkedItem = row.inventoryItemId ? inventoryItems.find((it: any) => it.id === row.inventoryItemId) : null;
                  const imgUrl: string = linkedItem?.imageUrl ?? "";
                  const isExtra = row.scopeItemId === null && row.description.trim() !== "";
                  deskRows.push(
                  <tr key={row.id} ref={(el) => { matRowRefs.current[i] = el; }}
                    className="border-b last:border-0 group"
                    style={{ borderColor: FT.RULE, borderLeft: isExtra ? `3px solid ${FT.ACCENT}` : undefined }}>
                    {/* PHOTO column */}
                    <td className="py-1.5 px-0.5 text-center">
                      {imgUrl ? (
                        <>
                          <img src={imgUrl} alt=""
                            style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", border: "1px solid #e8e8e8", display: "block", margin: "0 auto", cursor: "pointer", transition: "transform 0.12s, box-shadow 0.12s" }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,0.15)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                            onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex"; }} />
                          <div style={{ display: "none", margin: "0 auto" }}><ThumbPlaceholder size={28} /></div>
                        </>
                      ) : (
                        <div style={{ margin: "0 auto", width: "fit-content" }}><ThumbPlaceholder size={28} /></div>
                      )}
                    </td>
                    {/* Material Name */}
                    <td className="py-1.5 px-2" style={{ overflow: "visible" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <MaterialSearch row={row} inventoryItems={inventoryItems} testId={`input-mat-desc-${i}`}
                            onChange={(p) => {
                              let patch: Partial<MaterialRow> = { ...p };
                              if (p.inventoryItemId !== undefined && p.inventoryItemId !== null) {
                                const matched = scopeItems.find((s: any) => s.linkedInventoryItemId === p.inventoryItemId);
                                if (matched) patch.scopeItemId = matched.id;
                                flashRow(i);
                              }
                              setMaterials(materials.map((r) => r.id === row.id ? { ...r, ...patch } : r));
                            }} />
                        </div>
                        {row.inventoryItemId && (
                          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: "#2e7d32", background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap" }}>{t.newReportInv}</span>
                        )}
                        {isExtra && (
                          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: FT.ACCENT, background: "transparent", border: `1px solid ${FT.ACCENT}`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap", fontFamily: FT.FONT, letterSpacing: "0.02em" }}>{t.newReportMaterialExtraLabel}</span>
                        )}
                      </div>
                    </td>
                    {/* SPEC */}
                    <td className="py-1.5 px-2">
                      <input data-testid={`input-mat-spec-${i}`} value={row.spec}
                        onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, spec: e.target.value } : r))}
                        placeholder="—"
                        style={{ width: "100%", fontSize: 12, border: "none", background: "transparent", outline: "none", color: row.spec ? "#374151" : "#ccc" }} />
                    </td>
                    {/* QTY */}
                    <td className="py-1.5 px-1">
                      <Input data-testid={`input-mat-qty-${i}`} type="number" min={0} value={row.qty}
                        onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, qty: Math.max(0, Number(e.target.value)) } : r))}
                        onInput={(e) => { const v = (e.target as HTMLInputElement); if (Number(v.value) < 0) v.value = "0"; }}
                        className="h-8 text-xs text-center tabular-nums w-full" />
                    </td>
                    {/* UNIT */}
                    <td className="py-1.5 px-0.5 text-center">
                      {row.inventoryItemId ? (
                        <span data-testid={`input-mat-unit-${i}`} style={{ fontSize: 13, fontWeight: 600, color: "#666", background: "transparent", whiteSpace: "nowrap", display: "inline-block" }}>{row.unit || "EA"}</span>
                      ) : (
                        <input data-testid={`input-mat-unit-${i}`} value={row.unit}
                          onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                          placeholder={t.newReportUnitEAPh}
                          style={{ width: "100%", fontSize: 13, fontWeight: 600, textAlign: "center", border: "none", background: "transparent", color: "#666", outline: "none" }} />
                      )}
                    </td>
                    {/* Delete */}
                    <td className="py-1.5 px-1">
                      <button type="button" data-testid={`btn-remove-mat-${i}`}
                        onClick={() => setMaterials(materials.filter((r) => r.id !== row.id))}
                        style={{ width: 24, height: 24, borderRadius: "50%", background: "#fee2e2", border: "1px solid #fecaca", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", margin: "0 auto", transition: "all 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#fca5a5"; e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.transform = "scale(1.05)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#f87171"; e.currentTarget.style.transform = "scale(1)"; }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </td>
                  </tr>
                  );
                });
                return deskRows;
              })()}
            </tbody>
          </table>
          </div>
        )}
        <AddRow testId="btn-add-material" label={t.newReportAddMaterial}
          onClick={() => setMaterials([...materials, { id: uid(), description: "", spec: "", unit: "EA", qty: 1, notes: "", inventoryItemId: null, scopeItemId: null }])} />

        {inventoryItems.length > 0 && (
          <p className="mt-2 text-[10px] text-slate-400">
            {t.newReportInvAvailable.replace("{n}", String(inventoryItems.length))}
            {scopeItems.length > 0 && (
              <> · {t.newReportScopeAutoFill}</>
            )}
          </p>
        )}
      </Section>
      </div>{/* end §4 */}

      {/* ══════════════════════════════════════════════════════
          §5 — Equipment
      ══════════════════════════════════════════════════════ */}
      <div ref={el => { sectionRefs.current[4] = el; }} style={quickMode && isMobile && quickStep !== 4 ? { display: "none" } : undefined}>
      <Section num={5} title={t.newReportEquipment} icon={<Truck className="w-4 h-4" />} summary={eqSummary} alert={eqAlert} defaultOpen={false}>

        {/* Quick-add preset buttons */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Wrench className="w-3 h-3" /> {t.newReportQuickAdd}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_PRESETS.map((name) => (
              <button key={name} type="button"
                data-testid={`btn-eq-preset-${name.replace(/ /g, "-").toLowerCase()}`}
                onClick={() => setEquipment([...equipment, { id: uid(), name, size: "", brand: "", unit: "EA", qty: 1, hours: 0, notes: "", eqStatus: "operational", tags: [] }])}
                className="px-2.5 py-1 rounded-full text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                + {name}
              </button>
            ))}
          </div>
        </div>

        {isMobile ? (
          /* ── Mobile: stacked equipment cards ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 0 4px" }} data-testid="table-equipment">
            {equipment.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 0", fontSize: 13, color: FT.TEXT_MUTED, fontStyle: "italic" }}>{t.newReportNoEquipment}</div>
            )}
            {equipment.map((row, i) => {
              const eqCfg = EQ_STATUS_CFG[row.eqStatus] ?? EQ_STATUS_CFG.operational;
              const cardBorderColor = row.eqStatus === "broken" ? FT.DANGER : row.eqStatus === "partial" ? FT.ACCENT : FT.RULE;
              const cardBg = FT.PAPER;
              const visibleTags = row.eqStatus === "broken"
                ? ["repair", "return"]
                : row.eqStatus === "partial"
                ? ["repair", "return", "pending"]
                : [];
              return (
                <div key={row.id}
                  style={{ border: `1px solid ${cardBorderColor}`, borderLeft: row.eqStatus !== "operational" ? `3px solid ${eqCfg.border}` : `1px solid ${cardBorderColor}`, borderRadius: 10, padding: "12px 12px 10px", background: cardBg, display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Row 1: Name + Status badge + Delete */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportEqColName}</div>
                      <Input data-testid={`input-eq-name-${i}`} value={row.name}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                        className="h-9 text-sm w-full" placeholder={t.newReportEqNamePh} />
                    </div>
                    <div style={{ flexShrink: 0, paddingTop: 17 }}>
                      <DelBtn testId={`btn-remove-eq-${i}`} onClick={() => setEquipment(equipment.filter((r) => r.id !== row.id))} />
                    </div>
                  </div>
                  {/* Row 2: Size + Brand */}
                  {!(quickMode && isMobile) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportSize}</div>
                      <Input data-testid={`input-eq-size-${i}`} value={row.size}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, size: e.target.value } : r))}
                        className="h-9 text-sm text-center w-full" placeholder={t.newReportSizePh} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportBrand}</div>
                      <Input data-testid={`input-eq-brand-${i}`} value={row.brand}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, brand: e.target.value } : r))}
                        className="h-9 text-sm w-full" placeholder={t.newReportEqBrandPh} />
                    </div>
                  </div>}
                  {/* Row 3: Qty + Unit + Hours */}
                  {!(quickMode && isMobile) && <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportEqColQty}</div>
                      <Input data-testid={`input-eq-qty-${i}`} type="number" min={0} value={row.qty}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                        className="h-9 text-sm text-center tabular-nums w-full" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportEqColUnit}</div>
                      <Input data-testid={`input-eq-unit-${i}`} value={row.unit}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                        className="h-9 text-sm text-center w-full" placeholder={t.newReportUnitEAPh} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportEqColHours}</div>
                      <Input data-testid={`input-eq-hours-${i}`} type="number" min={0} step={0.5} value={row.hours}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, hours: Number(e.target.value) } : r))}
                        className="h-9 text-sm text-center tabular-nums w-full" />
                    </div>
                  </div>}
                  {/* Row 4: Status select + action tags */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportStatus}</div>
                    <div style={{ position: "relative", marginBottom: visibleTags.length > 0 ? 8 : 0 }}>
                      <select
                        data-testid={`select-eq-status-${i}`}
                        value={row.eqStatus}
                        onChange={(e) => {
                          const newStatus = e.target.value as "operational" | "partial" | "broken";
                          setEquipment(equipment.map((r) => {
                            if (r.id !== row.id) return r;
                            let tags = r.tags;
                            if (newStatus === "operational") tags = [];
                            else if (newStatus === "broken" && !tags.includes("repair")) tags = ["repair", ...tags];
                            return { ...r, eqStatus: newStatus, tags };
                          }));
                        }}
                        style={{
                          border: `1px solid ${eqCfg.border}`,
                          borderRadius: 7, padding: "7px 28px 7px 10px",
                          fontSize: 13, background: eqCfg.bg, color: eqCfg.color,
                          appearance: "none", width: "100%", cursor: "pointer",
                          fontWeight: 600, outline: "none",
                        }}>
                        <option value="operational">{t.newReportEqOperational}</option>
                        <option value="partial">{t.newReportEqPartial}</option>
                        <option value="broken">{t.newReportEqBroken}</option>
                      </select>
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 11, pointerEvents: "none" }}>▾</span>
                    </div>
                    {!(quickMode && isMobile) && visibleTags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {visibleTags.map((tag) => {
                          const tc = EQ_TAG_CFG[tag];
                          const active = row.tags.includes(tag);
                          return (
                            <button key={tag} type="button"
                              data-testid={`btn-eq-tag-${tag}-${i}`}
                              onClick={() => setEquipment(equipment.map((r) => {
                                if (r.id !== row.id) return r;
                                const tags = r.tags.includes(tag) ? r.tags.filter(t => t !== tag) : [...r.tags, tag];
                                return { ...r, tags };
                              }))}
                              style={{
                                background: active ? tc.bg : "#f5f5f5",
                                border: `1px solid ${active ? tc.border : "#e5e5e5"}`,
                                color: active ? tc.color : "#aaa",
                                borderRadius: 6, padding: "5px 10px",
                                fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                                cursor: "pointer",
                              }}>
                              {eqTagLabel(tag, t)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Row 5: Notes */}
                  {!(quickMode && isMobile) && <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: FT.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontFamily: FT.FONT }}>{t.newReportColNotes}</div>
                    <Input data-testid={`input-eq-notes-${i}`} value={row.notes}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-9 text-sm w-full" placeholder={t.newReportOptional} />
                  </div>}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Desktop: original table ── */
          <div className="overflow-x-auto">
          <table className="text-sm w-full" style={{ tableLayout: "fixed", minWidth: 900 }} data-testid="table-equipment">
            <TH cols={[
              { label: t.newReportSize,        cls: "w-[80px] text-center" },
              { label: t.newReportEqColName,   cls: "w-[200px]" },
              { label: t.newReportBrand,       cls: "w-[100px]" },
              { label: t.newReportEqColQty,    cls: "w-[64px] text-center" },
              { label: t.newReportEqColUnit,   cls: "w-[64px] text-center" },
              { label: t.newReportEqColHours,  cls: "w-[96px] text-center" },
              { label: t.newReportStatus,      cls: "w-[180px]" },
              { label: t.newReportColNotes,    cls: "w-[120px]" },
            ]} />
            <tbody>
              {equipment.length === 0 && (
                <tr><td colSpan={9} className="py-7 text-center text-xs text-slate-300 italic">{t.newReportNoEquipment}</td></tr>
              )}
              {equipment.map((row, i) => {
                const eqCfg = EQ_STATUS_CFG[row.eqStatus] ?? EQ_STATUS_CFG.operational;
                const rowBg = undefined;
                const visibleTags = row.eqStatus === "broken"
                  ? ["repair", "return"]
                  : row.eqStatus === "partial"
                  ? ["repair", "return", "pending"]
                  : [];
                return (
                  <tr key={row.id} className="last:border-0 group" style={{ borderBottom: `1px solid ${FT.RULE}` }}>
                    {/* SIZE */}
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-eq-size-${i}`} value={row.size}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, size: e.target.value } : r))}
                        className="h-8 text-xs text-center w-full" placeholder={t.newReportSizePh} />
                    </td>
                    {/* EQUIPMENT NAME */}
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-eq-name-${i}`} value={row.name}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                        className={cellInputCls} placeholder={t.newReportEqNamePh} />
                    </td>
                    {/* BRAND */}
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-eq-brand-${i}`} value={row.brand}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, brand: e.target.value } : r))}
                        className={cellInputCls} placeholder={t.newReportEqBrandPh} />
                    </td>
                    {/* QTY */}
                    <td className="py-1.5 px-2">
                      <Input data-testid={`input-eq-qty-${i}`} type="number" min={0} value={row.qty}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                        className="h-8 text-xs text-center tabular-nums w-full" />
                    </td>
                    {/* UNIT */}
                    <td className="py-1.5 px-2">
                      <Input data-testid={`input-eq-unit-${i}`} value={row.unit}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                        className="h-8 text-xs text-center w-full" placeholder={t.newReportUnitEAPh} />
                    </td>
                    {/* HOURS USED */}
                    <td className="py-1.5 px-2">
                      <Input data-testid={`input-eq-hours-${i}`} type="number" min={0} step={0.5} value={row.hours}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, hours: Number(e.target.value) } : r))}
                        className="h-8 text-xs text-center tabular-nums w-full" />
                    </td>
                    {/* STATUS */}
                    <td className="py-1.5 px-2.5">
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {/* Operation state dropdown */}
                        <div style={{ position: "relative" }}>
                          <select
                            data-testid={`select-eq-status-${i}`}
                            value={row.eqStatus}
                            onChange={(e) => {
                              const newStatus = e.target.value as "operational" | "partial" | "broken";
                              setEquipment(equipment.map((r) => {
                                if (r.id !== row.id) return r;
                                let tags = r.tags;
                                if (newStatus === "operational") tags = [];
                                else if (newStatus === "broken" && !tags.includes("repair")) tags = ["repair", ...tags];
                                return { ...r, eqStatus: newStatus, tags };
                              }));
                            }}
                            style={{
                              border: `1px solid ${eqCfg.border}`,
                              borderRadius: 7, padding: "5px 28px 5px 9px",
                              fontSize: 12, background: eqCfg.bg, color: eqCfg.color,
                              appearance: "none", width: "100%", cursor: "pointer",
                              fontWeight: 500, outline: "none",
                            }}>
                            <option value="operational">{t.newReportEqOperational}</option>
                            <option value="partial">{t.newReportEqPartial}</option>
                            <option value="broken">{t.newReportEqBroken}</option>
                          </select>
                          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 10, pointerEvents: "none" }}>▾</span>
                        </div>
                        {/* Action tags */}
                        {visibleTags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {visibleTags.map((tag) => {
                              const tc = EQ_TAG_CFG[tag];
                              const active = row.tags.includes(tag);
                              return (
                                <button key={tag} type="button"
                                  data-testid={`btn-eq-tag-${tag}-${i}`}
                                  onClick={() => setEquipment(equipment.map((r) => {
                                    if (r.id !== row.id) return r;
                                    const tags = r.tags.includes(tag) ? r.tags.filter(t => t !== tag) : [...r.tags, tag];
                                    return { ...r, tags };
                                  }))}
                                  style={{
                                    background: active ? tc.bg : "#f5f5f5",
                                    border: `1px solid ${active ? tc.border : "#e5e5e5"}`,
                                    color: active ? tc.color : "#aaa",
                                    borderRadius: 5, padding: "3px 8px",
                                    fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                                    cursor: "pointer",
                                  }}>
                                  {eqTagLabel(tag, t)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* NOTES */}
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-eq-notes-${i}`} value={row.notes}
                        onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                        className={cellInputCls} placeholder={t.newReportOptional} />
                    </td>
                    {/* DELETE */}
                    <td className="py-1.5 px-1 w-[32px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <DelBtn testId={`btn-remove-eq-${i}`} onClick={() => setEquipment(equipment.filter((r) => r.id !== row.id))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        <AddRow testId="btn-add-equipment" label={t.newReportAddCustom}
          onClick={() => setEquipment([...equipment, { id: uid(), name: "", size: "", brand: "", unit: "EA", qty: 1, hours: 0, notes: "", eqStatus: "operational", tags: [] }])} />
      </Section>
      </div>{/* end §5 */}

      {/* ══════════════════════════════════════════════════════
          §6 — Notes / Remarks
      ══════════════════════════════════════════════════════ */}
      <div ref={el => { sectionRefs.current[5] = el; }} style={quickMode && isMobile && quickStep !== 5 ? { display: "none" } : undefined}>
      <Section num={6} title={t.newReportNotesRemarks} icon={<FileText className="w-4 h-4" />}
        summary={generalNotes.trim() ? generalNotes.trim().slice(0, 44) + (generalNotes.length > 44 ? "…" : "") : undefined}
        defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <FL>{t.newReportGeneralNotes}</FL>
            <Textarea data-testid="input-general-notes" value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder={t.newReportGeneralNotesPh}
              className="text-sm min-h-[88px] resize-y" />
          </div>
          <div>
            <FL>{t.newReportSafetyObs}</FL>
            <Textarea data-testid="input-safety-notes" value={safetyNotes}
              onChange={(e) => setSafetyNotes(e.target.value)}
              placeholder={t.newReportSafetyNotesPh}
              className="text-sm min-h-[80px] resize-y" />
          </div>
          <div>
            <FL>{t.newReportInspector}</FL>
            <Input data-testid="input-inspector-visitor" value={inspectorVisitor}
              onChange={(e) => setInspectorVisitor(e.target.value)}
              placeholder={t.newReportInspectorPh}
              className="h-9 text-sm" />
          </div>
          <div>
            <FL>{t.newReportRequestFromClient}</FL>
            <Textarea data-testid="input-request-from-client" value={requestFromClient}
              onChange={(e) => setRequestFromClient(e.target.value)}
              placeholder={t.newReportRequestFromClientPh}
              className="text-sm min-h-[72px] resize-y" />
          </div>
          <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
            <div>
              <FL>{t.newReportDrawingNo}</FL>
              <Input data-testid="input-drawing-no" value={drawingNo}
                onChange={(e) => setDrawingNo(e.target.value)}
                placeholder={t.newReportDrawingNoPh}
                className="h-9 text-sm" />
            </div>
            <div>
              <FL>{t.newReportDrawingDesc}</FL>
              <Input data-testid="input-drawing-description" value={drawingDescription}
                onChange={(e) => setDrawingDescription(e.target.value)}
                placeholder={t.newReportDrawingDescPh}
                className="h-9 text-sm" />
            </div>
          </div>
        </div>
      </Section>
      </div>{/* end §6 */}

      {/* ── Quick mode prev / next navigation ── */}
      {quickMode && isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8 }}>
          <button type="button" disabled={quickStep === 0}
            onClick={() => setQuickStep(s => Math.max(0, s - 1))}
            style={{ flex: 1, height: 46, borderRadius: 10, border: `1.5px solid ${quickStep === 0 ? "#e5e5e5" : FT.RULE}`, background: "transparent", fontSize: 14, fontWeight: 700, color: quickStep === 0 ? "#ccc" : FT.INK, cursor: quickStep === 0 ? "default" : "pointer", fontFamily: FT.FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            ← {t.newReportStepPrev}
          </button>
          {quickStep < QUICK_TOTAL - 1 ? (
            <button type="button"
              onClick={() => setQuickStep(s => Math.min(QUICK_TOTAL - 1, s + 1))}
              style={{ flex: 1, height: 46, borderRadius: 10, border: "none", background: FT.ACCENT, fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: FT.FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {t.newReportStepNext} →
            </button>
          ) : (
            <button type="button" disabled={saveMutation.isPending || isSubmitted}
              onClick={() => saveMutation.mutate("draft")}
              style={{ flex: 1, height: 46, borderRadius: 10, border: "none", background: FT.ACCENT, fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: FT.FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: saveMutation.isPending || isSubmitted ? 0.6 : 1 }}>
              {t.newReportSaveDraft}
            </button>
          )}
        </div>
      )}

      </div>{/* end sections lock wrapper */}

      {/* ── Bottom action bar ── */}
      <div className="rounded-xl px-5 py-3" style={{ background: FT.PAPER_MUTED, border: `1px solid ${FT.RULE}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button data-testid="btn-save-draft-bottom"
              disabled={saveMutation.isPending || isSubmitted}
              onClick={() => saveMutation.mutate("draft")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "0 20px", height: 48, borderRadius: 8, fontSize: 13,
                fontWeight: 700, fontFamily: FT.FONT, letterSpacing: "0.03em",
                textTransform: "uppercase", cursor: (saveMutation.isPending || isSubmitted) ? "not-allowed" : "pointer",
                border: `2px solid ${FT.INK}`, background: "transparent", color: FT.INK,
                transition: "all 0.15s", opacity: (saveMutation.isPending || isSubmitted) ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!saveMutation.isPending && !isSubmitted) { (e.currentTarget as HTMLElement).style.background = FT.INK; (e.currentTarget as HTMLElement).style.color = FT.PAPER; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = FT.INK; }}>
              {saveMutation.isPending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Save style={{ width: 14, height: 14 }} />}
              {t.newReportSaveDraft}
            </button>
            <button data-testid="btn-submit-report-bottom"
              disabled={saveMutation.isPending || isSubmitted || !canSubmit}
              onClick={() => saveMutation.mutate("submitted")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "0 24px", height: 48, borderRadius: 8, fontSize: 14,
                fontWeight: 700, fontFamily: FT.FONT, letterSpacing: "0.03em",
                textTransform: "uppercase", transition: "all 0.15s",
                cursor: (!canSubmit && !isSubmitted) ? "not-allowed" : "pointer",
                border: (isSubmitted || canSubmit) ? `1px solid ${FT.ACCENT}` : `1px solid ${FT.RULE}`,
                background: (isSubmitted || canSubmit) ? FT.ACCENT : FT.RULE,
                color: (isSubmitted || canSubmit) ? "#ffffff" : FT.TEXT_MUTED,
                boxShadow: (canSubmit || isSubmitted) ? `0 2px 8px rgba(232,93,4,0.3)` : "none",
                opacity: 1,
              }}
              onMouseEnter={e => { if (canSubmit || isSubmitted) { (e.currentTarget as HTMLElement).style.background = "#c44e00"; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(232,93,4,0.45)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = (isSubmitted || canSubmit) ? FT.ACCENT : FT.RULE; (e.currentTarget as HTMLElement).style.boxShadow = (canSubmit || isSubmitted) ? `0 2px 8px rgba(232,93,4,0.3)` : "none"; }}
              onMouseDown={e => { if (canSubmit || isSubmitted) (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}>
              {saveMutation.isPending
                ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                : isSubmitted
                ? <CheckCircle2 style={{ width: 14, height: 14 }} />
                : canSubmit
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              }
              {isSubmitted ? t.newReportSubmitted : t.newReportSubmit}
            </button>
            {isManagerOrAbove && reportId && (
              <Button data-testid="btn-delete-report-bottom"
                variant="outline" size="sm"
                className="gap-2 h-9 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                disabled={deleteMutation.isPending}
                onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                {t.newReportDeleteReport}
              </Button>
            )}
          </div>
          {submitHelper && (
            <span className="text-[11px] text-slate-400 italic">{submitHelper}</span>
          )}
        </div>
      </div>

    </div>
  );
}
