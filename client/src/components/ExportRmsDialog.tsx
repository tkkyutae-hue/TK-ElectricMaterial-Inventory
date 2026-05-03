import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Download, Loader2 } from "lucide-react";

type ProjectLite = {
  id: number;
  code: string;
  name: string;
  poNumber: string | null;
  status: string;
};

export type RmsExportItem = {
  id: number;
  name: string;
  size: string;
  unit: string;
  qty: number;
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
  const [completionDate, setCompletionDate] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [rows, setRows] = useState<RmsExportItem[]>(initialItems);
  const [submitting, setSubmitting] = useState(false);

  // Fetch active projects for the picker. Only enabled while the dialog is open.
  const { data: projects, isLoading: projectsLoading, isError: projectsError, isFetching: projectsFetching, refetch: refetchProjects } = useQuery<ProjectLite[]>({
    queryKey: ["/api/projects"],
    enabled: open,
    refetchOnMount: "always",
    staleTime: 0,
    retry: false,
  });
  const activeProjects = useMemo(
    () => (projects ?? []).filter(p => p.status === "active"),
    [projects],
  );

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setProjectPickerOpen(false);
    const p = activeProjects.find(p => String(p.id) === id);
    if (!p) return;
    setPoNumber(p.poNumber ?? "");
    setProjectName(p.name ?? "");
  };

  const selectedProject = activeProjects.find(p => String(p.id) === projectId);
  const projectLabel = (p: ProjectLite) => {
    const po = (p.poNumber ?? "").trim();
    return po
      ? `${p.name} — ${po} (${p.code})`
      : `${p.name} — ${t.reorderRmsNoPo} (${p.code})`;
  };

  // When dialog opens, refresh row list from incoming selection.
  useEffect(() => {
    if (open) setRows(initialItems);
  }, [open, initialItems]);

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
          items: rows.map(r => ({
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

            {/* Project picker — searchable combobox; auto-fills PO Number + Project Name */}
            <div className="space-y-1 mb-3">
              <Label htmlFor="rms-project-picker" className="text-xs text-slate-600">{t.reorderRmsProject}</Label>
              <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="rms-project-picker"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectPickerOpen}
                    disabled={projectsLoading}
                    className="w-full justify-between font-normal"
                    data-testid="select-rms-project"
                  >
                    <span className={cn("truncate text-left", !selectedProject && "text-slate-400")}>
                      {selectedProject ? projectLabel(selectedProject) : t.reorderRmsProjectPlaceholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  {projectsError ? (
                    <div className="p-3 space-y-2" data-testid="status-rms-project-error">
                      <p className="text-sm text-rose-600">{t.reorderRmsProjectLoadError}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => refetchProjects()}
                        disabled={projectsFetching}
                        className="w-full"
                        data-testid="button-rms-project-retry"
                      >
                        {projectsFetching ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />{t.cmnLoading}</>
                        ) : (
                          t.reorderRmsProjectRetry
                        )}
                      </Button>
                    </div>
                  ) : (
                  <Command>
                    <CommandInput placeholder={t.reorderRmsProjectPlaceholder} data-testid="input-rms-project-search" />
                    <CommandList>
                      <CommandEmpty>
                        {projectsLoading ? t.cmnLoading : t.reorderRmsProjectPlaceholder}
                      </CommandEmpty>
                      <CommandGroup>
                        {activeProjects.map(p => {
                          const label = projectLabel(p);
                          return (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.poNumber ?? ""} ${p.code}`}
                              onSelect={() => handleProjectChange(String(p.id))}
                              data-testid={`select-rms-project-${p.id}`}
                            >
                              <Check className={cn("mr-2 h-4 w-4", projectId === String(p.id) ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  )}
                </PopoverContent>
              </Popover>
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
                <Input id="rms-po" value={poNumber} onChange={e => { setPoNumber(e.target.value); setProjectId(""); }} data-testid="input-rms-po" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-project" className="text-xs text-slate-600">{t.reorderRmsProjectName}</Label>
                <Input id="rms-project" value={projectName} onChange={e => { setProjectName(e.target.value); setProjectId(""); }} data-testid="input-rms-project" />
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
                      <th className="text-left font-medium px-3 py-2">{t.reorderRmsItem}</th>
                      <th className="text-left font-medium px-3 py-2 w-28">{t.reorderRmsSize}</th>
                      <th className="text-left font-medium px-3 py-2 w-20">{t.reorderRmsUnit}</th>
                      <th className="text-right font-medium px-3 py-2 w-28">{t.reorderRmsQty}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className="border-t border-slate-100" data-testid={`row-rms-${r.id}`}>
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-900">{r.name}</td>
                        <td className="px-3 py-2 text-slate-600">{r.size || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{r.unit || "—"}</td>
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
