import { useState, useEffect } from "react";
import { CheckCircle2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectScopeItem } from "@shared/schema";
import { scopeItemSchema, type ScopeItemFormData, COMMON_UNITS, flexMatch } from "../types";
import { CATEGORY_ORDER } from "../categoryConfig";

export function ScopeItemDialog({
  projectId, item, open, onClose,
}: {
  projectId: number;
  item: ProjectScopeItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const isEdit = !!item;
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allInventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });
  const [invSearch, setInvSearch] = useState("");
  const [invOpen, setInvOpen] = useState(false);
  const [linkedInvId, setLinkedInvId] = useState<number | null>(null);

  const filteredInvItems = allInventoryItems.filter(it => flexMatch(invSearch, it.name)).slice(0, 12);
  const linkedInvName = allInventoryItems.find(it => it.id === linkedInvId)?.name ?? "";

  const form = useForm<ScopeItemFormData>({
    resolver: zodResolver(scopeItemSchema),
    defaultValues: {
      itemName: "", unit: "", estimatedQty: "", category: "", remarks: "",
      isActive: true, linkedInventoryItemId: null,
      scopeType: "primary", progressCountingMode: "exact",
    },
  });

  useEffect(() => {
    if (open) {
      if (isEdit && item) {
        const lid = (item as any)?.linkedInventoryItemId ?? null;
        setLinkedInvId(lid);
        setInvSearch(lid ? (allInventoryItems.find(it => it.id === lid)?.name ?? "") : "");
        form.reset({
          itemName: item.itemName ?? "",
          unit: item.unit ?? "",
          estimatedQty: item.estimatedQty ? String(item.estimatedQty) : "",
          category: item.category ?? "",
          remarks: item.remarks ?? "",
          isActive: item.isActive ?? true,
          linkedInventoryItemId: lid,
          scopeType: ((item as any).scopeType as "primary" | "support") ?? "primary",
          progressCountingMode: ((item as any).progressCountingMode as "exact" | "family" | "manual") ?? "exact",
        });
      } else {
        setLinkedInvId(null);
        setInvSearch("");
        form.reset({
          itemName: "", unit: "", estimatedQty: "", category: "", remarks: "",
          isActive: true, linkedInventoryItemId: null,
          scopeType: "primary", progressCountingMode: "exact",
        });
      }
    }
  }, [open, item?.id]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? apiRequest("PATCH", `/api/scope-items/${item!.id}`, data)
        : apiRequest("POST", `/api/projects/${projectId}/scope-items`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: isEdit ? "Scope item updated" : "Scope item added" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  function onSubmit(data: ScopeItemFormData) {
    saveMutation.mutate({ ...data, estimatedQty: String(data.estimatedQty), linkedInventoryItemId: linkedInvId });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Scope Item" : "Add Scope Item"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="itemName" render={({ field }) => (
              <FormItem>
                <FormLabel>Item Name *</FormLabel>
                <FormControl><Input {...field} data-testid="input-scope-item-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit *</FormLabel>
                  <FormControl><Input {...field} list="dlg-units-list" data-testid="select-scope-unit" /></FormControl>
                  <datalist id="dlg-units-list">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estimatedQty" render={({ field }) => (
                <FormItem>
                  <FormLabel>Est. Qty *</FormLabel>
                  <FormControl><Input type="number" min="0" step="any" placeholder="0" {...field} data-testid="input-scope-qty" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Conduit" {...field} list="dlg-cat-list" data-testid="input-scope-category" /></FormControl>
                  <datalist id="dlg-cat-list">{CATEGORY_ORDER.map(c => <option key={c} value={c} />)}</datalist>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scopeType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-scope-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="progressCountingMode" render={({ field }) => (
              <FormItem>
                <FormLabel>Progress Counting Mode</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger data-testid="select-scope-counting-mode"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="exact">Exact Match Only</SelectItem>
                    <SelectItem value="family">Family Match (same category)</SelectItem>
                    <SelectItem value="manual">Manual Mapping</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Inventory Item Link <span className="text-slate-400 font-normal text-xs">(optional)</span>
              </label>
              <div className="relative">
                <Input
                  placeholder="Search inventory items to link…"
                  value={invSearch}
                  data-testid="input-scope-inv-link"
                  onChange={(e) => { setInvSearch(e.target.value); setInvOpen(true); if (!e.target.value) setLinkedInvId(null); }}
                  onFocus={() => setInvOpen(true)}
                  onBlur={() => setTimeout(() => setInvOpen(false), 150)}
                  className={linkedInvId ? "border-emerald-300 bg-emerald-50" : ""}
                />
                {linkedInvId && (
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => { setLinkedInvId(null); setInvSearch(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {invOpen && filteredInvItems.length > 0 && (
                  <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredInvItems.map(it => (
                      <button key={it.id} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setLinkedInvId(it.id); setInvSearch(it.name); setInvOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-2 ${linkedInvId === it.id ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700"}`}>
                        <span className="truncate">{it.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{it.unitOfMeasure ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {linkedInvId && <p className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Linked: {linkedInvName}</p>}
            </div>
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" placeholder="Any notes…" {...field} data-testid="input-scope-remarks" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {isEdit && (
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "true")} value={String(field.value)}>
                    <FormControl><SelectTrigger data-testid="select-scope-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
              <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={saveMutation.isPending} data-testid="button-save-scope-item">
                <Save className="w-4 h-4 mr-1" />
                {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
