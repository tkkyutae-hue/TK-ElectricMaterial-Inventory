import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Upload, X, Loader2, CheckSquare, Square,
  AlertCircle, Sparkles, Link2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { resolveScopeReportTarget, type ScopeReportTarget } from "@shared/scopeReportTarget";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExtractedItem {
  itemName: string;
  qty: number;
  unit: string;
  category: string;
  remarks: string | null;
  section: string | null;
  sortOrder: number | null;
  inventoryItemId: number | null;
  inventoryItemName: string | null;
}

interface InventoryOption {
  id: number;
  name: string;
}

interface RowState extends ExtractedItem {
  localId: string;
  selected: boolean;
  reportTarget: ScopeReportTarget;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.xlsx";
const MAX_SIZE_MB = 20;
const PDF_PAGE_CAP = 8; // must match server constant

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── DropZone ────────────────────────────────────────────────────────────────
function DropZone({
  file,
  onFile,
  onClear,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  if (file) {
    return (
      <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <FileText className="w-8 h-8 text-brand-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm truncate">{file.name}</p>
          <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
        </div>
        <button
          onClick={onClear}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors
        ${drag ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"}`}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Upload className="w-5 h-5 text-slate-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">
          파일을 끌어다 놓거나 <span className="text-brand-600">클릭하여 선택</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">PDF · PNG/JPG · Excel (.xlsx만 지원) — 최대 {MAX_SIZE_MB}MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

// ─── PageRangePicker ──────────────────────────────────────────────────────────
function PageRangePicker({
  totalPages,
  fromPage,
  toPage,
  onChange,
}: {
  totalPages: number;
  fromPage: number;
  toPage: number;
  onChange: (from: number, to: number) => void;
}) {
  const maxTo = Math.min(totalPages, fromPage + PDF_PAGE_CAP - 1);

  function setFrom(v: number) {
    const clamped = Math.max(1, Math.min(v, totalPages));
    const newTo = Math.min(toPage, clamped + PDF_PAGE_CAP - 1, totalPages);
    onChange(clamped, Math.max(clamped, newTo));
  }
  function setTo(v: number) {
    const clamped = Math.max(fromPage, Math.min(v, maxTo));
    onChange(fromPage, clamped);
  }

  const pageCount = toPage - fromPage + 1;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
        <FileText className="w-4 h-4 text-amber-600" />
        PDF {totalPages}페이지 — BOQ가 있는 페이지 범위를 선택하세요
      </div>

      <div className="flex items-center gap-3">
        {/* From page */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">시작 페이지</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFrom(fromPage - 1)}
              disabled={fromPage <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={fromPage}
              onChange={(e) => setFrom(parseInt(e.target.value) || 1)}
              className="w-14 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-brand-400 bg-white"
            />
            <button
              onClick={() => setFrom(fromPage + 1)}
              disabled={fromPage >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <span className="text-slate-400 mt-5">~</span>

        {/* To page */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">끝 페이지</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTo(toPage - 1)}
              disabled={toPage <= fromPage}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={fromPage}
              max={maxTo}
              value={toPage}
              onChange={(e) => setTo(parseInt(e.target.value) || fromPage)}
              className="w-14 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-brand-400 bg-white"
            />
            <button
              onClick={() => setTo(toPage + 1)}
              disabled={toPage >= maxTo}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-5 text-xs text-slate-500">
          ({pageCount}페이지 처리{pageCount >= PDF_PAGE_CAP ? ` — 최대 ${PDF_PAGE_CAP}페이지` : ""})
        </div>
      </div>

      {totalPages > PDF_PAGE_CAP && (
        <p className="text-xs text-amber-700">
          한 번에 최대 {PDF_PAGE_CAP}페이지까지 처리할 수 있습니다. 나머지 페이지는 범위를 바꿔 다시 추출하세요.
        </p>
      )}
    </div>
  );
}

// ─── InventoryCell ────────────────────────────────────────────────────────────
function InventoryCell({
  row,
  inventoryItems,
  onChange,
}: {
  row: RowState;
  inventoryItems: InventoryOption[];
  onChange: (id: number | null, name: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = inventoryItems
    .filter((it) => !search || it.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 30);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-[120px]">
      {/* Display badge */}
      <div className="flex items-center gap-1">
        {row.inventoryItemId ? (
          <>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 text-[11px] max-w-[130px] truncate">
              <Link2 className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{row.inventoryItemName}</span>
            </span>
            <button
              onClick={() => onChange(null, null)}
              className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
              title="연결 해제"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="text-slate-300 hover:text-slate-500 text-xs transition-colors"
          >
            —
          </button>
        )}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="text-slate-300 hover:text-brand-500 transition-colors ml-0.5"
            title="인벤토리 연결"
          >
            <Link2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dropdown picker */}
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-xl">
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름으로 검색…"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-brand-400"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            <button
              className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 border-b border-slate-50"
              onClick={() => { onChange(null, null); setOpen(false); setSearch(""); }}
            >
              — 연결 해제
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">검색 결과 없음</p>
            )}
            {filtered.map((it) => (
              <button
                key={it.id}
                className={`w-full text-left px-3 py-2 text-xs truncate transition-colors
                  ${row.inventoryItemId === it.id
                    ? "bg-emerald-50 text-emerald-800 font-medium"
                    : "text-slate-700 hover:bg-slate-50"}`}
                onClick={() => { onChange(it.id, it.name); setOpen(false); setSearch(""); }}
              >
                {it.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ResultTable ─────────────────────────────────────────────────────────────
function ResultTable({
  rows,
  inventoryItems,
  onToggle,
  onToggleAll,
  onEdit,
  onEditInventory,
}: {
  rows: RowState[];
  inventoryItems: InventoryOption[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (id: string, field: keyof ExtractedItem | "reportTarget", value: string) => void;
  onEditInventory: (id: string, invId: number | null, invName: string | null) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 w-8">
                <button onClick={onToggleAll} className="text-slate-500 hover:text-slate-800 transition-colors">
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-brand-600" />
                  ) : someSelected ? (
                    <div className="w-4 h-4 border-2 border-brand-400 rounded flex items-center justify-center">
                      <div className="w-2 h-0.5 bg-brand-400 rounded" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-32">섹션</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">품목명</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">규격 / Spec</th>
              <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-20">수량</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-16">단위</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-28">카테고리</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-24">보고서 탭</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> 인벤토리</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.localId}
                className={`transition-colors ${row.selected ? "bg-white" : "bg-slate-50/60 opacity-60"}`}
              >
                <td className="px-3 py-2">
                  <button onClick={() => onToggle(row.localId)} className="text-slate-400 hover:text-brand-600 transition-colors">
                    {row.selected ? (
                      <CheckSquare className="w-4 h-4 text-brand-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </td>
                <td className="px-3 py-2 w-32">
                  {row.section ? (
                    <span className="inline-block max-w-[120px] truncate text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5" title={row.section}>
                      {row.section}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <textarea
                    value={row.itemName}
                    onChange={(e) => onEdit(row.localId, "itemName", e.target.value)}
                    rows={2}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-800 text-sm py-0.5 resize-none leading-snug"
                  />
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <textarea
                    value={row.remarks ?? ""}
                    onChange={(e) => onEdit(row.localId, "remarks", e.target.value)}
                    rows={2}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-600 text-xs py-0.5 resize-none leading-snug"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-2 w-20 text-right">
                  <input
                    type="number"
                    value={row.qty}
                    onChange={(e) => onEdit(row.localId, "qty", e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-800 text-sm py-0.5 text-right"
                  />
                </td>
                <td className="px-3 py-2 w-16">
                  <input
                    value={row.unit}
                    onChange={(e) => onEdit(row.localId, "unit", e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-800 text-sm py-0.5"
                  />
                </td>
                <td className="px-3 py-2 w-28">
                  <select
                    value={row.category}
                    onChange={(e) => onEdit(row.localId, "category", e.target.value)}
                    className="w-full bg-transparent text-slate-700 text-xs outline-none cursor-pointer"
                  >
                    {["Conduit", "Fittings & Connectors", "Cable Tray", "Cable / Wire", "Grounding", "Boxes", "Devices", "Equipment"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 w-24">
                  <select
                    value={row.reportTarget}
                    onChange={(e) => onEdit(row.localId, "reportTarget", e.target.value)}
                    className="w-full bg-transparent text-slate-700 text-xs outline-none cursor-pointer"
                    data-testid={`extract-row-report-target-${row.localId}`}
                  >
                    <option value="material">자재</option>
                    <option value="equipment">장비</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <InventoryCell
                    row={row}
                    inventoryItems={inventoryItems}
                    onChange={(id, name) => onEditInventory(row.localId, id, name)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>{rows.filter((r) => r.selected).length} / {rows.length}개 선택됨</span>
        {rows.some((r) => r.selected && r.inventoryItemId) && (
          <span className="text-emerald-600">
            {rows.filter((r) => r.selected && r.inventoryItemId).length}개 인벤토리 연결됨
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main dialog ─────────────────────────────────────────────────────────────
export function ScopeExtractDialog({
  projectId,
  open,
  onClose,
  onAdded,
}: {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);
  const [step, setStep] = useState<"upload" | "result">("upload");
  const [error, setError] = useState<string | null>(null);

  // Page range state (only relevant for PDFs with >1 page)
  const [totalPages, setTotalPages] = useState<number>(1);
  const [checkingPages, setCheckingPages] = useState(false);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);

  function reset() {
    setFile(null);
    setRows([]);
    setInventoryItems([]);
    setStep("upload");
    setError(null);
    setTotalPages(1);
    setCheckingPages(false);
    setFromPage(1);
    setToPage(1);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(f: File) {
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기가 ${MAX_SIZE_MB}MB를 초과합니다.`);
      return;
    }
    setError(null);
    setFile(f);
    setTotalPages(1);
    setFromPage(1);
    setToPage(1);

    // For PDFs, fetch page count so we can show the range picker
    if (f.type === "application/pdf") {
      setCheckingPages(true);
      try {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch(`/api/projects/${projectId}/scope-items/pdf-page-count`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (r.ok) {
          const data = await r.json();
          const count = data.pageCount ?? 1;
          setTotalPages(count);
          setFromPage(1);
          setToPage(Math.min(count, PDF_PAGE_CAP));
        }
      } catch {
        // fail-safe: treat as 1 page
      } finally {
        setCheckingPages(false);
      }
    }
  }

  // ── Extract mutation ──────────────────────────────────────────────────────
  const [pageCappedInfo, setPageCappedInfo] = useState<{ processed: number; total: number } | null>(null);

  const extractMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append("file", f);
      // Pass page range for PDFs
      if (f.type === "application/pdf" && totalPages > 1) {
        fd.append("fromPage", String(fromPage));
        fd.append("toPage", String(toPage));
      }
      const r = await fetch(`/api/projects/${projectId}/scope-items/extract-from-file`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ message: "추출 실패" }));
        throw new Error(body.message ?? "추출 실패");
      }
      return r.json() as Promise<{
        items: ExtractedItem[];
        pagesProcessed: number | null;
        totalPages: number | null;
        pageCapped: boolean;
        inventoryItems: InventoryOption[];
      }>;
    },
    onSuccess: ({ items, pagesProcessed, totalPages: respTotal, pageCapped, inventoryItems: inv }) => {
      if (items.length === 0) {
        setError("품목을 찾을 수 없었습니다. BOQ/견적서 페이지가 맞는지 확인하고 다시 시도해 주세요.");
        return;
      }
      if (pageCapped && pagesProcessed && respTotal) {
        setPageCappedInfo({ processed: pagesProcessed, total: respTotal });
      } else {
        setPageCappedInfo(null);
      }
      setInventoryItems(inv ?? []);
      setRows(
        items.map((it, i) => ({
          ...it,
          qty: isNaN(Number(it.qty)) ? 0 : Number(it.qty),
          inventoryItemId: it.inventoryItemId ?? null,
          inventoryItemName: it.inventoryItemName ?? null,
          localId: `${Date.now()}-${i}`,
          selected: true,
          reportTarget: resolveScopeReportTarget(it),
        })),
      );
      setStep("result");
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message ?? "추출 중 오류가 발생했습니다.");
    },
  });

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (selected: RowState[]) => {
      const results = await Promise.allSettled(
        selected.map((row) =>
          fetch(`/api/projects/${projectId}/scope-items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              itemName: row.itemName.trim(),
              unit: row.unit.trim() || "EA",
              estimatedQty: String(row.qty ?? 0),
              category: row.category || "Other",
              remarks: row.remarks || null,
              section: row.section || null,
              sortOrder: row.sortOrder ?? null,
              linkedInventoryItemId: row.inventoryItemId ?? null,
              reportTarget: row.reportTarget,
            }),
          }).then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              if (r.status === 409) return { skipped: true };
              throw new Error(body.message ?? "저장 실패");
            }
            return r.json();
          }),
        ),
      );
      const saved          = results.filter((r) => r.status === "fulfilled" && !(r.value as any)?.skipped && !(r.value as any)?.sectionUpdated).length;
      const sectionUpdated = results.filter((r) => r.status === "fulfilled" && !!(r.value as any)?.sectionUpdated).length;
      const skipped        = results.filter((r) => r.status === "fulfilled" && !!(r.value as any)?.skipped).length;
      const failed         = results.filter((r) => r.status === "rejected").length;
      return { saved, sectionUpdated, skipped, failed };
    },
    onSuccess: ({ saved, sectionUpdated, skipped, failed }) => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      const parts: string[] = [];
      if (saved > 0) parts.push(`${saved}개 추가됨`);
      if (sectionUpdated > 0) parts.push(`${sectionUpdated}개 섹션 업데이트됨`);
      if (skipped > 0) parts.push(`${skipped}개 중복 건너뜀`);
      if (failed > 0) parts.push(`${failed}개 실패`);
      toast({
        title: "Scope Items 추가 완료",
        description: parts.join(" · "),
        variant: failed > 0 && saved === 0 ? "destructive" : "default",
      });
      onAdded();
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    },
  });

  // ── Row manipulation ──────────────────────────────────────────────────────
  function toggleRow(id: string) {
    setRows((prev) => prev.map((r) => (r.localId === id ? { ...r, selected: !r.selected } : r)));
  }
  function toggleAll() {
    const allSel = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSel })));
  }
  function editRow(id: string, field: keyof ExtractedItem | "reportTarget", value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localId === id
          ? { ...r, [field]: field === "qty" ? (isNaN(parseFloat(value)) ? 0 : parseFloat(value)) : value }
          : r,
      ),
    );
  }
  function editInventory(id: string, invId: number | null, invName: string | null) {
    setRows((prev) =>
      prev.map((r) =>
        r.localId === id ? { ...r, inventoryItemId: invId, inventoryItemName: invName } : r,
      ),
    );
  }

  const selectedRows = rows.filter((r) => r.selected);
  const isExtracting = extractMutation.isPending;
  const isSaving = saveMutation.isPending;
  const matchedCount = rows.filter((r) => r.inventoryItemId !== null).length;
  const isPdf = file?.type === "application/pdf";
  const isExcel = file?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const showPagePicker = isPdf && totalPages > 1 && !checkingPages;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand-600" />
            </div>
            견적서에서 Scope Items 가져오기
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* ── Upload step ── */}
          {step === "upload" && (
            <>
              <DropZone file={file} onFile={handleFile} onClear={() => { setFile(null); setError(null); setTotalPages(1); }} />

              {/* Page count loading indicator */}
              {checkingPages && (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  PDF 페이지 수 확인 중…
                </div>
              )}

              {/* Page range picker (multi-page PDFs only) */}
              {showPagePicker && (
                <PageRangePicker
                  totalPages={totalPages}
                  fromPage={fromPage}
                  toPage={toPage}
                  onChange={(f, t) => { setFromPage(f); setToPage(t); }}
                />
              )}

              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={handleClose} disabled={isExtracting}>
                  취소
                </Button>
                <Button
                  className="bg-brand-700 hover:bg-brand-800 text-white min-w-[120px]"
                  disabled={!file || isExtracting || checkingPages}
                  onClick={() => file && extractMutation.mutate(file)}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isExcel ? "가져오는 중…" : "AI 분석 중…"}
                    </>
                  ) : (
                    <>
                      {!isExcel && <Sparkles className="w-4 h-4 mr-2" />}
                      {isExcel
                        ? "가져오기"
                        : showPagePicker ? `${fromPage}~${toPage}p AI 추출` : "AI 추출"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* ── Result step ── */}
          {step === "result" && (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {isExcel
                    ? <>{rows.length}개 항목을 가져왔습니다.</>
                    : <>AI가 {rows.length}개 항목을 추출했습니다.</>}
                  {matchedCount > 0 && (
                    <> · <span className="text-emerald-600 font-medium">{matchedCount}개</span>가 인벤토리와 자동 매칭됐습니다. 인벤토리 열에서 수정할 수 있습니다.</>
                  )}
                  {matchedCount === 0 && <> 인벤토리 열에서 직접 연결할 수 있습니다.</>}
                </span>
              </div>
              {pageCappedInfo && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    PDF가 {pageCappedInfo.total}페이지이므로 처음 {pageCappedInfo.processed}페이지만 처리했습니다.
                    나머지 페이지는 파일을 분할하여 다시 업로드해 주세요.
                  </span>
                </div>
              )}

              <ResultTable
                rows={rows}
                inventoryItems={inventoryItems}
                onToggle={toggleRow}
                onToggleAll={toggleAll}
                onEdit={editRow}
                onEditInventory={editInventory}
              />

              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { setStep("upload"); setRows([]); setError(null); }}
                  className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={isSaving}
                >
                  ← 다른 파일 업로드
                </button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
                    취소
                  </Button>
                  <Button
                    className="bg-brand-700 hover:bg-brand-800 text-white min-w-[180px]"
                    disabled={selectedRows.length === 0 || isSaving}
                    onClick={() => saveMutation.mutate(selectedRows)}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 저장 중…
                      </>
                    ) : (
                      `선택 항목 ${selectedRows.length}개 추가`
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
