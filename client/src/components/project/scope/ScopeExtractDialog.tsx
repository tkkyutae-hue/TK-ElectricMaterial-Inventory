import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Upload, X, Loader2, CheckSquare, Square, ChevronDown,
  AlertCircle, Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExtractedItem {
  itemName: string;
  qty: number;
  unit: string;
  category: string;
  remarks: string | null;
}

interface RowState extends ExtractedItem {
  localId: string;
  selected: boolean;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.xlsx";
const MAX_SIZE_MB = 20;

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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

function ResultTable({
  rows,
  onToggle,
  onToggleAll,
  onEdit,
}: {
  rows: RowState[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (id: string, field: keyof ExtractedItem, value: string) => void;
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
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">품목명</th>
              <th className="text-right px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-20">수량</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-20">단위</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide w-28">카테고리</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">비고</th>
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
                <td className="px-3 py-2">
                  <input
                    value={row.itemName}
                    onChange={(e) => onEdit(row.localId, "itemName", e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-800 text-sm py-0.5 min-w-[140px]"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={row.qty}
                    onChange={(e) => onEdit(row.localId, "qty", e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-800 text-sm py-0.5 text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.unit}
                    onChange={(e) => onEdit(row.localId, "unit", e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-800 text-sm py-0.5"
                  />
                </td>
                <td className="px-3 py-2">
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
                <td className="px-3 py-2">
                  <input
                    value={row.remarks ?? ""}
                    onChange={(e) => onEdit(row.localId, "remarks", e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-400 outline-none text-slate-500 text-sm py-0.5"
                    placeholder="—"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
        {rows.filter((r) => r.selected).length} / {rows.length}개 선택됨
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
  const [step, setStep] = useState<"upload" | "result">("upload");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setRows([]);
    setStep("upload");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(f: File) {
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`파일 크기가 ${MAX_SIZE_MB}MB를 초과합니다.`);
      return;
    }
    setError(null);
    setFile(f);
  }

  // ── Extract mutation ──────────────────────────────────────────────────────
  const [pageCappedInfo, setPageCappedInfo] = useState<{ processed: number; total: number } | null>(null);

  const extractMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append("file", f);
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
      }>;
    },
    onSuccess: ({ items, pagesProcessed, totalPages, pageCapped }) => {
      if (items.length === 0) {
        setError("품목을 찾을 수 없었습니다. 파일을 확인하고 다시 시도하세요.");
        return;
      }
      if (pageCapped && pagesProcessed && totalPages) {
        setPageCappedInfo({ processed: pagesProcessed, total: totalPages });
      } else {
        setPageCappedInfo(null);
      }
      setRows(
        items.map((it, i) => ({
          ...it,
          qty: isNaN(Number(it.qty)) ? 0 : Number(it.qty),
          localId: `${Date.now()}-${i}`,
          selected: true,
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
            }),
          }).then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              // 409 duplicate → skip silently
              if (r.status === 409) return { skipped: true };
              throw new Error(body.message ?? "저장 실패");
            }
            return r.json();
          }),
        ),
      );
      const saved = results.filter((r) => r.status === "fulfilled" && !(r.value as any)?.skipped).length;
      const skipped = results.filter((r) => r.status === "fulfilled" && (r.value as any)?.skipped).length;
      const failed = results.filter((r) => r.status === "rejected").length;
      return { saved, skipped, failed };
    },
    onSuccess: ({ saved, skipped, failed }) => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      const parts: string[] = [];
      if (saved > 0) parts.push(`${saved}개 추가됨`);
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
  function editRow(id: string, field: keyof ExtractedItem, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localId === id
          ? { ...r, [field]: field === "qty" ? (isNaN(parseFloat(value)) ? 0 : parseFloat(value)) : value }
          : r,
      ),
    );
  }

  const selectedRows = rows.filter((r) => r.selected);
  const isExtracting = extractMutation.isPending;
  const isSaving = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl w-full">
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
              <DropZone file={file} onFile={handleFile} onClear={() => { setFile(null); setError(null); }} />

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
                  disabled={!file || isExtracting}
                  onClick={() => file && extractMutation.mutate(file)}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI 분석 중…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> AI 추출
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* ── Result step ── */}
          {step === "result" && (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                AI가 {rows.length}개 항목을 추출했습니다. 수량·단위를 확인하고 추가할 항목을 선택하세요.
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
                onToggle={toggleRow}
                onToggleAll={toggleAll}
                onEdit={editRow}
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
