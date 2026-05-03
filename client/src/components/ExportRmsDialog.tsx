import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Download, Loader2, Package } from "lucide-react";
import type { Project } from "@shared/schema";

export type RmsExportItem = {
  id: number;
  name: string;
  size: string;
  unit: string;
  qty: number;
  imageUrl?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialItems: RmsExportItem[];
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ExportRmsDialog({ open, onOpenChange, initialItems }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [date, setDate] = useState(todayIso());
  const [requester, setRequester] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [completionDate, setCompletionDate] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [rows, setRows] = useState<RmsExportItem[]>(initialItems);
  const [submitting, setSubmitting] = useState(false);

  // Load projects for the picker. Only fetched when dialog is open.
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  // Project options sorted by name; label includes PO number when present.
  const projectOptions = useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? "")),
    );
    return sorted.map((p) => ({
      value: String(p.id),
      label: p.poNumber ? `${p.name} (${p.poNumber})` : p.name,
    }));
  }, [projects]);

  // When dialog opens, refresh row list from incoming selection and clear the
  // picker so a new export starts from a clean slate.
  useEffect(() => {
    if (open) {
      setRows(initialItems);
      setSelectedProjectId("");
    }
  }, [open, initialItems]);

  const handleSelectProject = (val: string) => {
    setSelectedProjectId(val);
    const p = projects.find((x) => String(x.id) === val);
    if (p) {
      setPoNumber(p.poNumber ?? "");
      setProjectName(p.name ?? "");
    }
  };

  const truncated = rows.length > 50;

  const updateQty = (id: number, qty: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, qty: Number.isFinite(qty) ? qty : 0 } : r));
  };

  const handleSubmit = async () => {
    if (!poNumber.trim()) {
      toast({ title: t.reorderRmsPoRequired, variant: "destructive" });
      return;
    }
    if (rows.length === 0) {
      toast({ title: t.reorderRmsExportError, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reorder/export-rms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            date,
            requester,
            poNumber,
            projectName,
            completionDate,
            deliveryTo,
          },
          projectId: selectedProjectId ? Number(selectedProjectId) : undefined,
          items: rows.map(r => ({
            itemId: r.id,
            name: r.name,
            size: r.size,
            unit: r.unit,
            qty: Number(r.qty) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] || `${(poNumber || "RMS").replace(/[\\/:*?"<>|]/g, "_")}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: t.reorderRmsExportSuccess });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t.reorderRmsExportError, description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-export-rms">
        <DialogHeader>
          <DialogTitle>{t.reorderRmsTitle}</DialogTitle>
          <DialogDescription>{t.reorderRmsSubtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Header inputs */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">{t.reorderRmsHeaderSection}</h3>
            <div className="space-y-1 mb-3">
              <Label className="text-xs text-slate-600">
                {t.reorderRmsProjectPickerLabel}
              </Label>
              <SearchableSelect
                value={selectedProjectId}
                onChange={handleSelectProject}
                options={projectOptions}
                placeholder={projectsLoading ? t.reorderRmsProjectPickerLoading : t.reorderRmsProjectPickerPlaceholder}
                searchPlaceholder={t.reorderRmsProjectPickerSearch}
                emptyText={projectsLoading ? t.reorderRmsProjectPickerLoading : t.reorderRmsProjectPickerEmpty}
                data-testid="select-rms-project"
              />
              <p className="text-xs text-slate-400">{t.reorderRmsProjectPickerHint}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rms-date" className="text-xs text-slate-600">{t.reorderRmsDate}</Label>
                <Input id="rms-date" type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-rms-date" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-requester" className="text-xs text-slate-600">{t.reorderRmsRequester}</Label>
                <Input id="rms-requester" value={requester} onChange={e => setRequester(e.target.value)} data-testid="input-rms-requester" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-po" className="text-xs text-slate-600">
                  {t.reorderRmsPoNumber} <span className="text-rose-500">*</span>
                </Label>
                <Input id="rms-po" value={poNumber} onChange={e => setPoNumber(e.target.value)} data-testid="input-rms-po" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-project" className="text-xs text-slate-600">{t.reorderRmsProjectName}</Label>
                <Input id="rms-project" value={projectName} onChange={e => setProjectName(e.target.value)} data-testid="input-rms-project" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-comp" className="text-xs text-slate-600">{t.reorderRmsCompletionDate}</Label>
                <Input id="rms-comp" type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} data-testid="input-rms-comp" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-delivery" className="text-xs text-slate-600">{t.reorderRmsDeliveryTo}</Label>
                <Input id="rms-delivery" value={deliveryTo} onChange={e => setDeliveryTo(e.target.value)} data-testid="input-rms-delivery" />
              </div>
            </div>
          </div>

          {/* Item preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">
                {t.reorderRmsItemsSection}{" "}
                <span className="text-slate-400 font-normal">({rows.length})</span>
              </h3>
              {truncated && (
                <span className="text-xs text-amber-600">{t.reorderRmsTruncatedNote}</span>
              )}
            </div>
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 w-10">#</th>
                      <th className="text-left font-medium px-3 py-2 w-14">{t.reorderRmsPhoto}</th>
                      <th className="text-left font-medium px-3 py-2 w-28">{t.reorderRmsSize}</th>
                      <th className="text-left font-medium px-3 py-2">{t.reorderRmsItem}</th>
                      <th className="text-right font-medium px-3 py-2 w-24">{t.reorderRmsQty}</th>
                      <th className="text-left font-medium px-3 py-2 w-20">{t.reorderRmsUnit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className="border-t border-slate-100" data-testid={`row-rms-${r.id}`}>
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          {r.imageUrl ? (
                            <img
                              src={r.imageUrl}
                              alt={r.name}
                              className="w-10 h-10 rounded object-cover border border-slate-200"
                              data-testid={`img-rms-photo-${r.id}`}
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"
                              data-testid={`img-rms-photo-${r.id}`}
                            >
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.size || "—"}</td>
                        <td className="px-3 py-2 text-slate-900">{r.name}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 text-right w-24 ml-auto"
                            value={r.qty}
                            onChange={e => updateQty(r.id, Number(e.target.value))}
                            data-testid={`input-rms-qty-${r.id}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.unit || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} data-testid="button-rms-cancel">
            {t.reorderRmsCancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rows.length === 0} data-testid="button-rms-download">
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.reorderRmsGenerating}</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />{t.reorderRmsDownload}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
