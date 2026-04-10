import { useState } from "react";
import { Layers, Plus, Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocations, useSuppliers } from "@/hooks/use-reference-data";
import { apiRequest } from "@/lib/queryClient";
import type { CategoryGroupedItem } from "./types";

// ── Local types ───────────────────────────────────────────────────────────────

type WireReelLocal = {
  id: number;
  itemId: number;
  reelId: string;
  lengthFt: number;
  brand: string | null;
  status: string | null;
  notes: string | null;
  supplier: { id: number; name: string } | null;
  location: { id: number; name: string } | null;
  supplierId: number | null;
  locationId: number | null;
};

type AddReelDraft = {
  reelId: string;
  lengthFt: string;
  brand: string;
  supplierId: string;
  locationId: string;
  status: "new" | "used";
  notes: string;
};

type EditReelDraft = {
  reelId: string;
  lengthFt: string;
  brand: string;
  supplierId: string;
  locationId: string;
  status: string;
  notes: string;
};

const REEL_STATUS_COLORS: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700",
  used: "bg-amber-100 text-amber-700",
};
const REEL_STATUS_LABELS: Record<string, string> = {
  new: "New", used: "Used",
};

const BLANK_REEL_DRAFT: AddReelDraft = {
  reelId: "", lengthFt: "", brand: "", supplierId: "", locationId: "", status: "new", notes: ""
};

function ReelStatusBadge({ status }: { status: string | null }) {
  const s = status || "new";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${REEL_STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}`}>
      {REEL_STATUS_LABELS[s] ?? s}
    </span>
  );
}

// ── WireItemReelSection ───────────────────────────────────────────────────────

interface WireItemReelSectionProps {
  item: CategoryGroupedItem;
}

export function WireItemReelSection({ item }: WireItemReelSectionProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: locationList = [] } = useLocations();
  const { data: supplierList = [] } = useSuppliers();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<AddReelDraft>(BLANK_REEL_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditReelDraft>({ reelId: "", lengthFt: "", brand: "", supplierId: "", locationId: "", status: "new", notes: "" });

  const { data: reels = [], isLoading } = useQuery<WireReelLocal[]>({
    queryKey: ["/api/wire-reels", item.id],
    queryFn: async () => {
      const res = await fetch(`/api/wire-reels/${item.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reels");
      return res.json();
    },
  });

  const totalFt = reels.reduce((s, r) => s + r.lengthFt, 0);

  const invalidateReelData = () => {
    qc.invalidateQueries({ queryKey: ["/api/wire-reels", item.id] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/category"] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
  };

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/wire-reels", {
      itemId: item.id,
      reelId: draft.reelId.trim(),
      lengthFt: parseInt(draft.lengthFt) || 0,
      brand: draft.brand.trim() || null,
      supplierId: draft.supplierId ? parseInt(draft.supplierId) : null,
      locationId: draft.locationId ? parseInt(draft.locationId) : null,
      status: draft.status,
      notes: draft.notes.trim() || null,
    }),
    onSuccess: () => {
      invalidateReelData();
      setShowAdd(false);
      setDraft(BLANK_REEL_DRAFT);
      toast({ title: "Reel added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (reel: WireReelLocal) => apiRequest("DELETE", `/api/wire-reels/${reel.id}`),
    onSuccess: (_data, deletedReel) => {
      invalidateReelData();
      const dismissRef = { fn: () => {} };
      const { dismiss } = toast({
        title: "Reel removed",
        description: (
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">{deletedReel.reelId} · {deletedReel.lengthFt.toLocaleString()} FT</span>
            <button
              type="button"
              className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
              onClick={async () => {
                dismissRef.fn();
                try {
                  await apiRequest("POST", `/api/wire-reels/${deletedReel.id}/restore`);
                  invalidateReelData();
                  toast({ title: "Undo successful", description: `${deletedReel.reelId} restored.` });
                } catch (err: any) {
                  toast({ title: "Undo failed", description: err.message, variant: "destructive" });
                }
              }}
            >
              Undo
            </button>
          </div>
        ),
      });
      dismissRef.fn = dismiss;
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/wire-reels/${id}`, {
      reelId: editDraft.reelId.trim(),
      lengthFt: parseInt(editDraft.lengthFt) || 0,
      brand: editDraft.brand.trim() || null,
      supplierId: editDraft.supplierId ? parseInt(editDraft.supplierId) : null,
      locationId: editDraft.locationId ? parseInt(editDraft.locationId) : null,
      status: editDraft.status || null,
      notes: editDraft.notes.trim() || null,
    }),
    onSuccess: () => {
      invalidateReelData();
      setEditingId(null);
      toast({ title: "Reel updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const startEdit = (reel: WireReelLocal) => {
    setEditingId(reel.id);
    setEditDraft({
      reelId: reel.reelId,
      lengthFt: String(reel.lengthFt),
      brand: reel.brand || "",
      supplierId: reel.supplierId ? String(reel.supplierId) : "",
      locationId: reel.locationId ? String(reel.locationId) : "",
      status: reel.status || "new",
      notes: reel.notes || "",
    });
  };

  return (
    <div className="border-t border-[#D9E7DD] bg-[#F7FAF8] px-5 py-4" data-testid={`wire-reel-section-${item.id}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-brand-500" />
          <span className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">
            Reel Inventory — {item.sizeLabel || item.name}
          </span>
          {!isLoading && reels.length > 0 && (
            <span className="text-[11px] text-slate-500">
              {reels.length} reel{reels.length !== 1 ? "s" : ""} · {totalFt.toLocaleString()} FT
            </span>
          )}
        </div>
        <button
          className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-800 transition-colors"
          onClick={() => { setShowAdd(v => !v); setDraft(BLANK_REEL_DRAFT); }}
          data-testid={`button-add-reel-${item.id}`}
        >
          <Plus className="w-3 h-3" />{showAdd ? "Cancel" : "Add Reel"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Reel ID <span className="text-red-400">*</span></label>
              <Input value={draft.reelId} onChange={e => setDraft(d => ({ ...d, reelId: e.target.value }))}
                placeholder="e.g. R-001" className="h-8 text-sm" data-testid={`input-reel-id-${item.id}`} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Length (FT) <span className="text-red-400">*</span></label>
              <Input type="number" min={0} value={draft.lengthFt} onChange={e => setDraft(d => ({ ...d, lengthFt: e.target.value }))}
                placeholder="500" className="h-8 text-sm" data-testid={`input-reel-length-${item.id}`} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Brand</label>
              <Input value={draft.brand} onChange={e => setDraft(d => ({ ...d, brand: e.target.value }))}
                placeholder="Southwire" className="h-8 text-sm" data-testid={`input-reel-brand-${item.id}`} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Status</label>
              <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as AddReelDraft["status"] }))}>
                <SelectTrigger className="h-8 text-sm" data-testid={`select-reel-status-${item.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Supplier</label>
              <Select value={draft.supplierId || "__none__"} onValueChange={v => setDraft(d => ({ ...d, supplierId: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm" data-testid={`select-reel-supplier-${item.id}`}><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {(supplierList as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Location</label>
              <Select value={draft.locationId || "__none__"} onValueChange={v => setDraft(d => ({ ...d, locationId: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm" data-testid={`select-reel-location-${item.id}`}><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {(locationList as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Notes</label>
              <Input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                placeholder="Optional note…" className="h-8 text-sm" data-testid={`input-reel-notes-${item.id}`} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white"
              disabled={!draft.reelId.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              data-testid={`button-save-reel-${item.id}`}
            >
              {addMutation.isPending ? "Saving…" : "Add Reel"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-slate-400 py-1">Loading reels…</div>
      ) : reels.length === 0 ? (
        <div className="text-xs text-slate-400 italic py-1">No reels recorded yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#D9E7DD]">
          <table className="w-full text-xs" style={{ tableLayout: "auto" }}>
            <thead>
              <tr className="bg-white border-b border-slate-100">
                {["Reel ID", "Length (FT)", "Brand", "Supplier", "Location", "Status", "Notes", ""].map(h => (
                  <th key={h} className={`px-3 py-2 font-semibold text-slate-400 uppercase tracking-wide text-[10px] ${h === "Length (FT)" ? "text-right" : h === "Status" ? "text-center" : h === "" ? "" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {reels.map(reel => {
                const isEditing = editingId === reel.id;
                return (
                  <tr key={reel.id} className={`transition-colors ${isEditing ? "bg-slate-50" : "hover:bg-slate-50"}`} data-testid={`row-reel-${reel.id}`}>
                    {isEditing ? (
                      <>
                        <td className="px-2 py-1">
                          <Input value={editDraft.reelId} onChange={e => setEditDraft(d => ({ ...d, reelId: e.target.value }))} className="h-7 text-xs font-mono w-24" data-testid={`input-edit-reel-id-${reel.id}`} />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" min={0} value={editDraft.lengthFt} onChange={e => setEditDraft(d => ({ ...d, lengthFt: e.target.value }))} className="h-7 text-xs text-right w-16" data-testid={`input-edit-reel-length-${reel.id}`} />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={editDraft.brand} onChange={e => setEditDraft(d => ({ ...d, brand: e.target.value }))} placeholder="Brand" className="h-7 text-xs w-20" data-testid={`input-edit-reel-brand-${reel.id}`} />
                        </td>
                        <td className="px-2 py-1">
                          <Select value={editDraft.supplierId || "__none__"} onValueChange={v => setEditDraft(d => ({ ...d, supplierId: v === "__none__" ? "" : v }))}>
                            <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-edit-reel-supplier-${reel.id}`}><SelectValue placeholder="— None —" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— None —</SelectItem>
                              {(supplierList as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Select value={editDraft.locationId || "__none__"} onValueChange={v => setEditDraft(d => ({ ...d, locationId: v === "__none__" ? "" : v }))}>
                            <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-edit-reel-location-${reel.id}`}><SelectValue placeholder="— None —" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— None —</SelectItem>
                              {(locationList as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Select value={editDraft.status} onValueChange={v => setEditDraft(d => ({ ...d, status: v }))}>
                            <SelectTrigger className="h-7 text-xs w-20" data-testid={`select-edit-reel-status-${reel.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="used">Used</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Input value={editDraft.notes} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Notes…" className="h-7 text-xs w-28" data-testid={`input-edit-reel-notes-${reel.id}`} />
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateMutation.mutate(reel.id)} disabled={!editDraft.reelId.trim() || updateMutation.isPending} className="text-emerald-500 hover:text-emerald-700 transition-colors disabled:opacity-40" title="Save" data-testid={`button-save-edit-reel-${reel.id}`}>
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Cancel" data-testid={`button-cancel-edit-reel-${reel.id}`}>
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-700 whitespace-nowrap">{reel.reelId}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">{reel.lengthFt.toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{reel.brand || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{reel.supplier?.name || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{reel.location?.name || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-center"><ReelStatusBadge status={reel.status} /></td>
                        <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{reel.notes || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => startEdit(reel)} className="text-slate-300 hover:text-brand-600 transition-colors" title="Edit reel" data-testid={`button-edit-reel-${reel.id}`}>
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteMutation.mutate(reel)} disabled={deleteMutation.isPending} className="text-slate-300 hover:text-red-500 transition-colors" title="Remove reel" data-testid={`button-delete-reel-${reel.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#EAF7EE] border-t border-[#D9E7DD]">
                <td className="px-3 py-2 font-semibold text-brand-700 text-[11px]">{reels.length} reel{reels.length !== 1 ? "s" : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-brand-800">{totalFt.toLocaleString()} FT</td>
                <td colSpan={6} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
