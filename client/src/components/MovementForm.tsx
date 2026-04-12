import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects } from "@/hooks/use-reference-data";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, ChevronLeft, ChevronRight, Trash2, AlertTriangle } from "lucide-react";
import { api } from "@shared/routes";
import { SectionCard } from "@/components/shared/SectionCard";
import { PersonPicker, type PersonValue } from "@/components/shared/PersonPicker";
import { MovementTypePillSelector } from "./movement/MovementTypePillSelector";
import { SearchableItemSelect } from "./movement/SearchableItemSelect";
import { SearchableLocationSelect } from "./movement/SearchableLocationSelect";
import { SearchableProjectSelect } from "./movement/SearchableProjectSelect";
import { ItemRowField } from "./movement/ItemRowField";
import type { ItemRow } from "./movement/types";
import type { Worker } from "@shared/schema";

// ── Field Mode dark CSS ────────────────────────────────────────────────────────
const FM_CSS = `
.fm-dark label {
  color: #527856 !important;
  font-family: 'Barlow Condensed', sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  margin-bottom: 5px !important;
  display: block;
}
.fm-dark [data-testid="select-movement-type"] {
  background: #141e17 !important;
  border: 1px solid #203023 !important;
  border-radius: 10px !important;
  color: #c8deca !important;
  font-size: 13px !important;
  min-height: 42px !important;
}
.fm-dark [data-testid="select-movement-type"]:focus-within {
  border-color: #2ddb6f !important;
  box-shadow: 0 0 0 3px rgba(45,219,111,0.12) !important;
}
.fm-dark [data-testid="select-movement-type"] span {
  color: #c8deca !important;
}
.fm-dark textarea {
  background: #141e17 !important;
  border: 1px solid #203023 !important;
  border-radius: 10px !important;
  color: #c8deca !important;
  font-size: 13px !important;
  padding: 10px 14px !important;
  min-height: 72px !important;
}
.fm-dark textarea::placeholder { color: #2b3f2e !important; }
.fm-dark textarea:focus {
  border-color: #2ddb6f !important;
  box-shadow: 0 0 0 3px rgba(45,219,111,0.12) !important;
  outline: none !important;
}
.fm-dark p[id^="form-item-message"] { color: #f87171 !important; font-size: 11px !important; }
.fm-dark-select-content {
  background: #0f1612 !important;
  border: 1px solid #203023 !important;
  border-radius: 10px !important;
}
.fm-dark-select-content [role="option"] {
  color: #c8deca !important;
  font-size: 13px !important;
  cursor: pointer;
}
.fm-dark-select-content [role="option"]:focus,
.fm-dark-select-content [role="option"]:hover {
  background: #141e17 !important;
}
.fm-dark-select-content [role="option"][data-state="checked"] {
  color: #2ddb6f !important;
}
`;

// ── Schema + types ────────────────────────────────────────────────────────────
const sharedSchema = z.object({
  movementType: z.string().min(1, "Movement type is required"),
  sourceLocationId: z.coerce.number().optional(),
  destinationLocationId: z.coerce.number().optional(),
  projectId: z.coerce.number().optional(),
  note: z.string().optional(),
  personName: z.string().optional(),
});

type SharedData = z.infer<typeof sharedSchema>;

type ItemRowError = { itemId?: string; quantity?: string };

function getMovementTypes(t: Record<string, string>) {
  return [
    { value: "receive",  label: t.moveTypeReceiveLabel,  desc: t.moveTypeReceiveDesc },
    { value: "issue",    label: t.moveTypeIssueLabel,    desc: t.moveTypeIssueDesc },
    { value: "return",   label: t.moveTypeReturnLabel,   desc: t.moveTypeReturnDesc },
    { value: "transfer", label: t.moveTypeTransferLabel, desc: t.moveTypeTransferDesc },
  ];
}

function makeRow(): ItemRow {
  return { rowId: crypto.randomUUID(), itemId: null, quantity: 1, errors: {}, reelSelections: {}, reelSnapshots: {} };
}

// ── Admin item row (light mode) ───────────────────────────────────────────────
function AdminItemRow({
  row, idx, itemCount, items, onUpdate, onRemove, isLoading = false, errorMessage = null,
}: {
  row: ItemRow;
  idx: number;
  itemCount: number;
  items: any[];
  onUpdate: (rowId: string, patch: Partial<ItemRow>) => void;
  onRemove: (rowId: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  const selectedItem = items?.find((i: any) => i.id === row.itemId);
  return (
    <div
      style={{ position: "relative", zIndex: itemCount - idx }}
      className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 hover:border-brand-200 transition-colors"
      data-testid={`item-row-${idx}`}
    >
      <div className="flex-[3] min-w-0">
        <SearchableItemSelect
          value={row.itemId}
          onChange={(id) => onUpdate(row.rowId, { itemId: id })}
          items={items || []}
          dark={false}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />
        {row.errors.itemId && (
          <p className="text-[10px] text-red-500 mt-1 ml-1" data-testid={`error-item-${idx}`}>{row.errors.itemId}</p>
        )}
      </div>
      <div className="shrink-0">
        <div className="flex items-center">
          <button type="button" onClick={() => onUpdate(row.rowId, { quantity: Math.max(0, row.quantity - 1) })} className="w-9 h-9 flex items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600" data-testid={`btn-qty-dec-${idx}`} title="Decrease">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={row.quantity} onChange={(e) => { const val = parseInt(e.target.value.replace(/\D/g, ""), 10); onUpdate(row.rowId, { quantity: isNaN(val) || val < 0 ? 0 : val }); }} onBlur={(e) => { const val = parseInt(e.target.value, 10); if (isNaN(val) || val < 0) onUpdate(row.rowId, { quantity: 0 }); }} style={{ textAlign: "center", paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }} className="h-9 w-16 text-sm font-semibold border-y border-slate-200 bg-white focus:outline-none focus:border-brand-300" data-testid={`input-quantity-${idx}`} />
          <button type="button" onClick={() => onUpdate(row.rowId, { quantity: row.quantity + 1 })} className="w-9 h-9 flex items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600" data-testid={`btn-qty-inc-${idx}`} title="Increase">
            <ChevronRight className="w-4 h-4" />
          </button>
          {selectedItem && (
            <span className="ml-2 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap min-w-[28px] text-center">{selectedItem.unitOfMeasure}</span>
          )}
        </div>
        {row.errors.quantity && (
          <p className="text-[10px] text-red-500 mt-1 text-center" data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
        )}
      </div>
      <div className="shrink-0">
        <button type="button" onClick={() => onRemove(row.rowId)} disabled={itemCount === 1} className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-0 transition-all" data-testid={`btn-remove-row-${idx}`} title="Remove item">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
interface MovementFormProps {
  defaultType?: string;
  defaultItemId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  readOnly?: boolean;
  allowedTypes?: string[];
  fieldMode?: boolean;
  draftId?: number;
}

export function MovementForm({
  defaultType = "receive",
  defaultItemId,
  onSuccess,
  onCancel,
  readOnly = false,
  allowedTypes,
  fieldMode = false,
  draftId,
}: MovementFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const movementTypes = getMovementTypes(t as unknown as Record<string, string>);
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: itemsRaw, isLoading: itemsLoading, isError: itemsIsError } = useItems();
  // Normalize: /api/items may return Item[] OR { items: Item[], total: number }
  const items: any[] = Array.isArray(itemsRaw)
    ? itemsRaw
    : Array.isArray((itemsRaw as any)?.items)
      ? (itemsRaw as any).items
      : [];
  const itemsErrorMessage = itemsIsError ? "Failed to load items" : null;
  const { data: locations } = useLocations();
  const { data: projects } = useProjects();
  const { data: workers } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const initialRow = makeRow();
  if (defaultItemId) initialRow.itemId = defaultItemId;

  const [itemRows, setItemRows] = useState<ItemRow[]>([initialRow]);
  const [resumingDraftId, setResumingDraftId] = useState<number | undefined>(draftId);

  const { data: draftData } = useQuery<any>({
    queryKey: ["/api/drafts", draftId],
    enabled: !!draftId,
  });

  const form = useForm<SharedData>({
    resolver: zodResolver(sharedSchema),
    defaultValues: { movementType: defaultType },
  });

  useEffect(() => {
    if (!draftData || itemsLoading) return;
    form.setValue("movementType", draftData.movementType);
    if (draftData.sourceLocationId) form.setValue("sourceLocationId", draftData.sourceLocationId);
    if (draftData.destinationLocationId) form.setValue("destinationLocationId", draftData.destinationLocationId);
    if (draftData.projectId) form.setValue("projectId", draftData.projectId);
    if (draftData.note) form.setValue("note", draftData.note);
    try {
      const draftItems = JSON.parse(draftData.itemsJson || "[]");
      if (Array.isArray(draftItems) && draftItems.length > 0) {
        setItemRows(draftItems.map((di: any) => ({
          rowId: crypto.randomUUID(),
          itemId: di.itemId,
          quantity: di.qty,
          errors: {},
          reelSelections: di.reelSelections
            ? Object.fromEntries(Object.entries(di.reelSelections).map(([k, v]) => [Number(k), v as number]))
            : {},
          reelSnapshots: {},
        })));
      }
    } catch (_) {}
  }, [draftData, items]);

  const movType    = form.watch("movementType");
  const projectId  = form.watch("projectId");
  const projectName = (projects ?? []).find((p: any) => p.id === projectId)?.name ?? null;

  const needsSource      = ["receive", "return", "transfer"].includes(movType);
  const needsDestination = ["issue", "transfer"].includes(movType);
  const needsProject     = ["receive", "issue", "return"].includes(movType);
  const sourceLabel      = movType === "receive" ? t.receiveFrom : movType === "return" ? t.returnFrom : t.fromLocation;
  const destLabel        = movType === "issue" ? t.issueTo : t.toLocation;

  const addRow = useCallback(() => setItemRows(prev => [...prev, makeRow()]), []);

  const removeRow = useCallback((rowId: string) => {
    setItemRows(prev => prev.length > 1 ? prev.filter(r => r.rowId !== rowId) : prev);
  }, []);

  const updateRow = useCallback((rowId: string, patch: Partial<ItemRow>) => {
    setItemRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch, errors: {} } : r));
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────────
  function validateRows(): boolean {
    let valid = true;
    setGlobalError(null);

    // Guard: must have a movement type
    const shared = form.getValues();
    if (!shared.movementType) {
      form.setError("movementType", { message: "Movement type is required" });
      valid = false;
    }

    // Per-row validation
    setItemRows(prev => prev.map(r => {
      const errors: ItemRowError = {};
      if (!r.itemId) {
        errors.itemId = "Item is required";
        valid = false;
      }
      // Quantity must be ≥ 1 unless it's a reel-mode row
      const hasReelSelections = Object.keys(r.reelSelections ?? {}).length > 0;
      const hasNewReels = (r.newReels ?? []).length > 0;
      const isReelManaged = hasReelSelections || hasNewReels;
      if (!isReelManaged && (!r.quantity || r.quantity < 1)) {
        errors.quantity = "Must be ≥ 1";
        valid = false;
      }
      return { ...r, errors };
    }));

    // Transfer: source ≠ destination
    if (movType === "transfer" && shared.sourceLocationId && shared.destinationLocationId &&
        Number(shared.sourceLocationId) === Number(shared.destinationLocationId)) {
      form.setError("destinationLocationId", { message: "Source and destination must be different locations" });
      valid = false;
    }

    // Global guard: at least one real item row
    const hasAnyItem = itemRows.some(r => r.itemId);
    if (!hasAnyItem) {
      setGlobalError("Add at least one item before submitting.");
      valid = false;
    }

    return valid;
  }

  // ── Save draft ────────────────────────────────────────────────────────────────
  async function onSaveDraft() {
    const shared = form.getValues();
    if (!shared.movementType) {
      form.setError("movementType", { message: "Movement type is required" });
      return;
    }
    const validRows = itemRows.filter(r => r.itemId && r.quantity >= 1);
    if (validRows.length === 0) {
      toast({ title: "Add at least one item before saving", variant: "destructive" });
      return;
    }

    setDraftSaving(true);
    try {
      const itemsList = validRows.map(row => {
        const item = items.find(i => i.id === row.itemId);
        return {
          itemId: row.itemId,
          itemName: item?.name ?? "",
          sku: item?.sku ?? "",
          qty: row.quantity,
          unit: item?.unitOfMeasure ?? "",
          reelIds: Object.entries(row.reelSelections ?? {}).filter(([, v]) => v > 0).map(([k]) => Number(k)),
          reelSelections: row.reelSelections ?? {},
        };
      });

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          movementType: shared.movementType,
          sourceLocationId: shared.sourceLocationId || null,
          destinationLocationId: shared.destinationLocationId || null,
          projectId: shared.projectId || null,
          note: shared.note || null,
          itemsJson: JSON.stringify(itemsList),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Failed to save draft");
      }

      await qc.invalidateQueries({ queryKey: ["/api/drafts"] });

      const txPath = fieldMode ? "/field/transactions?tab=drafts" : "/transactions?tab=drafts";
      const { dismiss } = toast({
        title: "Draft saved",
        description: (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Draft saved — view in Transactions &gt; Draft Movements</span>
            <button
              type="button"
              style={{ textAlign: "left", textDecoration: "underline", fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}
              onClick={() => { navigate(txPath); dismiss(); }}
            >
              View Draft Movements →
            </button>
          </div>
        ) as any,
        duration: 4000,
      });
    } catch (err: any) {
      toast({ title: "Failed to save draft", description: err.message, variant: "destructive" });
    } finally {
      setDraftSaving(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function onSubmit(shared: SharedData) {
    if (!validateRows()) return;

    const validRows = itemRows.filter(r => r.itemId && r.quantity >= 1);
    setSubmitting(true);

    try {
      const results = await Promise.all(
        validRows.map(row =>
          fetch(api.movements.create.path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              movementType: shared.movementType,
              itemId: row.itemId,
              quantity: row.quantity,
              sourceLocationId: shared.sourceLocationId || null,
              destinationLocationId: shared.destinationLocationId || null,
              projectId: shared.projectId || null,
              note: shared.note || null,
              reason: shared.personName || null,
            }),
          }).then(async res => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({ message: `Failed for item #${row.itemId}` }));
              const e: any = new Error(body.message || `Failed for item #${row.itemId}`);
              e.validationErrors = body.errors;
              e.rowId = row.rowId;
              throw e;
            }
            return res.json();
          })
        )
      );

      const reelOps: Promise<any>[] = [];
      for (const row of validRows) {
        for (const [reelIdStr, ftUsed] of Object.entries(row.reelSelections ?? {})) {
          if (!ftUsed) continue;
          const reelId = Number(reelIdStr);
          const snapshot = row.reelSnapshots?.[reelId];
          if (!snapshot) continue;
          const newLength = snapshot.lengthFt - ftUsed;
          if (newLength <= 0) {
            reelOps.push(fetch(`/api/wire-reels/${reelId}`, { method: "DELETE", credentials: "include" }));
          } else {
            reelOps.push(fetch(`/api/wire-reels/${reelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ lengthFt: newLength, status: "used" }) }));
          }
        }
        if (shared.movementType === "receive") {
          for (const nr of (row.newReels ?? [])) {
            await fetch("/api/wire-reels", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                itemId: row.itemId,
                reelId: nr.reelId,
                lengthFt: nr.lengthFt,
                brand: nr.brand || null,
                locationId: nr.locationId ?? shared.destinationLocationId ?? null,
                status: nr.status ?? "full",
              }),
            });
          }
        }
      }
      if (reelOps.length > 0) await Promise.all(reelOps);

      await qc.invalidateQueries({ queryKey: [api.movements.list.path] });
      await qc.invalidateQueries({ queryKey: [api.items.list.path] });
      await qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      await qc.invalidateQueries({ queryKey: [api.projects.list.path] });
      await qc.invalidateQueries({ queryKey: ["/api/wire-reels"] });
      await qc.invalidateQueries({ queryKey: ["/api/inventory/category"] });
      await qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      await qc.invalidateQueries({ queryKey: ["/api/field/items"] });
      for (const row of validRows) {
        if (row.itemId) {
          await qc.invalidateQueries({ queryKey: [api.items.get.path, row.itemId] });
          await qc.invalidateQueries({ queryKey: ["/api/wire-reels", row.itemId] });
        }
      }

      const count = validRows.length;
      const createdIds: number[] = results.map((r: any) => r.id).filter(Boolean);
      const txPath = fieldMode ? "/field/transactions" : "/transactions";
      const dismissRef = { fn: () => {} };

      const { dismiss } = toast({
        title: count === 1 ? "Movement logged" : `${count} movements logged`,
        description: (
          <div>
            <p>{count} item{count > 1 ? "s" : ""} recorded as {shared.movementType}.</p>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:text-brand-900 underline underline-offset-2"
                onClick={() => { navigate(txPath); dismissRef.fn(); }}
              >
                View Transactions
              </button>
              {createdIds.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2"
                  onClick={async () => {
                    dismissRef.fn();
                    try {
                      await fetch("/api/movements/bulk-delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ ids: createdIds }),
                      });
                      await qc.invalidateQueries({ queryKey: [api.movements.list.path] });
                      await qc.invalidateQueries({ queryKey: [api.items.list.path] });
                      await qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
                      toast({ title: "Undone", description: `${count} movement${count > 1 ? "s" : ""} removed.` });
                    } catch (err: any) {
                      toast({ title: "Undo failed", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        ) as any,
      });
      dismissRef.fn = dismiss;

      if (resumingDraftId) {
        try {
          await fetch(`/api/drafts/${resumingDraftId}`, { method: "DELETE", credentials: "include" });
          await qc.invalidateQueries({ queryKey: ["/api/drafts"] });
          setResumingDraftId(undefined);
        } catch (_) {}
      }

      setItemRows([makeRow()]);
      form.reset({ movementType: shared.movementType });
      onSuccess?.();
    } catch (err: any) {
      // ── Surface server validation errors ──────────────────────────────────────
      if (err.validationErrors && Array.isArray(err.validationErrors)) {
        const rowErrors: ItemRowError = {};
        const nonFieldMsgs: string[] = [];
        for (const ve of err.validationErrors as { field: string; message: string }[]) {
          if (ve.field === "itemId")   rowErrors.itemId   = ve.message;
          else if (ve.field === "quantity") rowErrors.quantity = ve.message;
          else nonFieldMsgs.push(ve.message);
        }
        if (Object.keys(rowErrors).length > 0 && err.rowId) {
          setItemRows(prev => prev.map(r => r.rowId === err.rowId ? { ...r, errors: rowErrors } : r));
        }
        const summary = nonFieldMsgs.join("; ") || (Object.keys(rowErrors).length === 0 ? err.message : null);
        if (summary) setGlobalError(summary);
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      {fieldMode && <style>{FM_CSS}</style>}
      <div className={fieldMode ? "fm-dark" : undefined}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">

          {/* ── Global error banner ── */}
          {globalError && (
            <div className={fieldMode
              ? "flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs font-semibold"
              : "flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700"}
              style={fieldMode ? { background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", color: "#ff5050", borderRadius: 8 } : undefined}
              data-testid="global-error-banner"
            >
              <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
              {globalError}
            </div>
          )}

          {/* ── Section A: Movement Details ── */}
          {fieldMode ? (
            <div className="space-y-4 pb-4">
              <MovementTypeSection form={form} movementTypes={movementTypes} allowedTypes={allowedTypes} fieldMode={true} t={t} />
              <LocationProjectSection form={form} locations={locations} projects={projects} movType={movType} needsSource={needsSource} needsDestination={needsDestination} needsProject={needsProject} sourceLabel={sourceLabel} destLabel={destLabel} fieldMode={true} t={t} workers={workers} projectName={projectName} />
            </div>
          ) : (
            <SectionCard title="Movement Details" bodyClassName="space-y-4">
              <MovementTypeSection form={form} movementTypes={movementTypes} allowedTypes={allowedTypes} fieldMode={false} t={t} />
              <LocationProjectSection form={form} locations={locations} projects={projects} movType={movType} needsSource={needsSource} needsDestination={needsDestination} needsProject={needsProject} sourceLabel={sourceLabel} destLabel={destLabel} fieldMode={false} t={t} workers={workers} projectName={projectName} />
            </SectionCard>
          )}

          {/* ── Section B: Items ── */}
          {fieldMode ? (
            <div style={{ borderTop: "1px solid #203023", paddingTop: 20 }}>
              <ItemsSection form={form} itemRows={itemRows} items={items} locations={locations} addRow={addRow} updateRow={updateRow} removeRow={removeRow} fieldMode={true} movType={movType} t={t} isLoading={itemsLoading} errorMessage={itemsErrorMessage} />
            </div>
          ) : (
            <SectionCard
              title={t.items}
              className="mt-3"
              action={
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded-md transition-all"
                  data-testid="btn-add-item"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.addAnotherItem}
                </button>
              }
            >
              <AdminItemsSection itemRows={itemRows} items={items} updateRow={updateRow} removeRow={removeRow} isLoading={itemsLoading} errorMessage={itemsErrorMessage} />
            </SectionCard>
          )}

          {/* ── Note ── */}
          {fieldMode ? (
            <div style={{ flexShrink: 0, paddingTop: 20, borderTop: "1px solid #203023", marginTop: 4 }}>
              <NoteField form={form} fieldMode={true} t={t} />
            </div>
          ) : (
            <SectionCard className="mt-3" bodyClassName="pt-3 pb-3">
              <NoteField form={form} fieldMode={false} t={t} />
            </SectionCard>
          )}

          {/* ── Submit footer ── */}
          <div
            style={fieldMode ? { position: "sticky", bottom: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 8, paddingTop: 12, paddingBottom: 12, marginTop: 16, background: "#0d1410", borderTop: "1px solid #203023" } : undefined}
            className={fieldMode ? "-mx-4 sm:-mx-6 px-4 sm:px-6" : "sticky bottom-0 z-10 flex items-center justify-end gap-2 py-3 mt-4 -mx-4 md:-mx-6 px-4 md:px-6"}
          >
            <div className={fieldMode ? "w-full flex items-center gap-2" : "flex items-center gap-2"}>
              {readOnly ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        type="button"
                        disabled
                        style={fieldMode ? { background: "#1a2a1d", border: "1px solid #203023", color: "#2b3f2e", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, height: 40, padding: "0 20px", cursor: "not-allowed" } : undefined}
                        className={fieldMode ? undefined : "bg-slate-300 text-slate-500 min-w-[100px] cursor-not-allowed"}
                        data-testid="button-submit-movement"
                      >
                        Confirm
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Viewer role is read-only</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <Button
                    type="button"
                    disabled={draftSaving || submitting}
                    variant={fieldMode ? undefined : "outline"}
                    style={fieldMode ? { flex: 1, background: "#141e17", border: "1px solid #203023", color: "#527856", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, height: 40, padding: "0 12px", minWidth: 0 } : undefined}
                    className={fieldMode ? undefined : "min-w-[110px]"}
                    data-testid="button-save-draft"
                    onClick={onSaveDraft}
                  >
                    {draftSaving ? t.saving : t.saveAsDraft}
                  </Button>
                  {onCancel && (
                    <Button
                      type="button"
                      variant={fieldMode ? undefined : "destructive"}
                      onClick={onCancel}
                      disabled={submitting}
                      style={fieldMode ? { flex: 1, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.30)", color: "#ff5050", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, height: 40, padding: "0 12px", minWidth: 0 } : undefined}
                      data-testid="button-cancel-movement"
                    >
                      {t.cancel}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={submitting}
                    style={fieldMode ? { flex: 1, background: "#2ddb6f", color: "#07090a", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, height: 40, padding: "0 12px", minWidth: 0, border: "none", letterSpacing: "0.03em" } : undefined}
                    className={fieldMode ? undefined : "bg-brand-700 hover:bg-brand-800 min-w-[100px]"}
                    data-testid="button-submit-movement"
                  >
                    {submitting ? t.saving : `${t.confirm}${itemRows.length > 1 ? ` (${itemRows.length})` : ""}`}
                  </Button>
                </>
              )}
            </div>
          </div>

        </form>
      </div>
    </Form>
  );
}

// ── Section sub-components ────────────────────────────────────────────────────

function MovementTypeSection({
  form, movementTypes, allowedTypes, fieldMode, t,
}: {
  form: any;
  movementTypes: { value: string; label: string; desc: string }[];
  allowedTypes?: string[];
  fieldMode: boolean;
  t: any;
}) {
  return (
    <FormField control={form.control} name="movementType" render={({ field }: { field: any }) => (
      <FormItem>
        <FormLabel>{t.movementType}</FormLabel>
        {fieldMode ? (
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger data-testid="select-movement-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="fm-dark-select-content">
              {movementTypes.filter(mt => !allowedTypes || allowedTypes.includes(mt.value)).map(mt => (
                <SelectItem key={mt.value} value={mt.value}>
                  <span className="font-medium">{mt.label}</span>
                  <span style={{ color: "#527856", fontSize: 11, marginLeft: 6 }}>— {mt.desc}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <FormControl>
            <MovementTypePillSelector
              value={field.value}
              onChange={field.onChange}
              movementTypes={movementTypes.filter(mt => !allowedTypes || allowedTypes.includes(mt.value))}
            />
          </FormControl>
        )}
        <FormMessage />
      </FormItem>
    )} />
  );
}

function LocationProjectSection({
  form, locations, projects, movType, needsSource, needsDestination, needsProject,
  sourceLabel, destLabel, fieldMode, t, workers, projectName,
}: {
  form: any;
  locations: any[] | undefined;
  projects: any[] | undefined;
  movType: string;
  needsSource: boolean;
  needsDestination: boolean;
  needsProject: boolean;
  sourceLabel: string;
  destLabel: string;
  fieldMode: boolean;
  t: any;
  workers?: Worker[];
  projectName?: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Row 1: primary location + project (or both locations for transfer) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {needsSource && (
          <FormField control={form.control} name="sourceLocationId" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{sourceLabel}</FormLabel>
              <FormControl>
                <SearchableLocationSelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id)}
                  locations={locations || []}
                  placeholder={(t as any).searchOrTypeToCreate ?? "Search or type to create…"}
                  testId="select-source-location"
                  dark={fieldMode}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {!needsSource && needsDestination && (
          <FormField control={form.control} name="destinationLocationId" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{destLabel}</FormLabel>
              <FormControl>
                <SearchableLocationSelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id)}
                  locations={locations || []}
                  placeholder={(t as any).selectDestination ?? "Select destination…"}
                  testId="select-dest-location"
                  dark={fieldMode}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        {needsProject && (
          <FormField control={form.control} name="projectId" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{t.projectOptional}</FormLabel>
              <FormControl>
                <SearchableProjectSelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id)}
                  projects={projects || []}
                  hideCreate={fieldMode}
                  dark={fieldMode}
                  placeholder={(t as any).selectProject ?? "Select project…"}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {needsSource && needsDestination && (
          <FormField control={form.control} name="destinationLocationId" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{destLabel}</FormLabel>
              <FormControl>
                <SearchableLocationSelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id)}
                  locations={locations || []}
                  placeholder={(t as any).selectDestination ?? "Select destination…"}
                  testId="select-dest-location"
                  dark={fieldMode}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
      </div>

      {/* Row 2: secondary location + person */}
      {(movType === "receive" || movType === "return") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="destinationLocationId" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{t.receivingLocation}</FormLabel>
              <FormControl>
                <SearchableLocationSelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id)}
                  locations={locations || []}
                  placeholder={(t as any).searchOrTypeToCreate ?? "Search or type to create…"}
                  testId="select-dest-location"
                  dark={fieldMode}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="personName" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{t.receivedBy}</FormLabel>
              <FormControl>
                <PersonPicker
                  value={field.value ? { name: field.value } : null}
                  onChange={(v) => field.onChange(v?.name ?? "")}
                  workers={workers ?? []}
                  projectName={projectName}
                  placeholder={t.receiverNamePlaceholder}
                  dark={fieldMode}
                  testId="input-person-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      )}
      {movType === "issue" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="sourceLocationId" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{t.sendingLocation}</FormLabel>
              <FormControl>
                <SearchableLocationSelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id)}
                  locations={locations || []}
                  placeholder={(t as any).searchOrTypeToCreate ?? "Search or type to create…"}
                  testId="select-source-location"
                  dark={fieldMode}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="personName" render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>{t.requestedBy}</FormLabel>
              <FormControl>
                <PersonPicker
                  value={field.value ? { name: field.value } : null}
                  onChange={(v) => field.onChange(v?.name ?? "")}
                  workers={workers ?? []}
                  projectName={projectName}
                  placeholder={t.requesterNamePlaceholder}
                  dark={fieldMode}
                  testId="input-person-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      )}
    </div>
  );
}

function ItemsSection({
  form, itemRows, items, locations, addRow, updateRow, removeRow, fieldMode, movType, t,
  isLoading = false, errorMessage = null,
}: {
  form: any;
  itemRows: ItemRow[];
  items: any[] | undefined;
  locations: any[] | undefined;
  addRow: () => void;
  updateRow: (rowId: string, patch: Partial<ItemRow>) => void;
  removeRow: (rowId: string) => void;
  fieldMode: boolean;
  movType: string;
  t: any;
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <p style={fieldMode ? { fontSize: 13, fontWeight: 600, color: "#527856", margin: 0 } : undefined} className={fieldMode ? undefined : "text-sm font-semibold text-slate-700"}>{t.items}</p>
        <span style={fieldMode ? { fontSize: 11, color: "#2ddb6f", background: "#0b1a0f", borderRadius: 12, padding: "1px 8px", fontWeight: 600 } : undefined} className={fieldMode ? undefined : "text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium"}>
          {itemRows.length}
        </span>
        <div style={fieldMode ? { height: 1, flex: 1, background: "#203023" } : undefined} className={fieldMode ? undefined : "h-px flex-1 bg-slate-100"} />
        <button
          type="button"
          onClick={addRow}
          style={fieldMode ? { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#2ddb6f", background: "rgba(45,219,111,0.06)", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", flexShrink: 0 } : undefined}
          className={fieldMode ? undefined : "flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded-md transition-all shrink-0"}
          data-testid="btn-add-item"
        >
          <Plus style={{ width: 13, height: 13 }} className={fieldMode ? undefined : "w-3.5 h-3.5"} />
          {t.addAnotherItem}
        </button>
      </div>
      <div className="space-y-2">
        {itemRows.map((row, idx) => (
          <ItemRowField
            key={row.rowId}
            row={row}
            idx={idx}
            itemCount={itemRows.length}
            items={items || []}
            locations={locations || []}
            onUpdate={updateRow}
            onRemove={removeRow}
            movementType={movType}
            isLoading={isLoading}
            errorMessage={errorMessage}
            searchPlaceholder={(t as any).itemSearchPlaceholder ?? "Search by name, SKU, or size…"}
            closeText={(t as any).itemPickerClose ?? "Done"}
          />
        ))}
      </div>
    </>
  );
}

function AdminItemsSection({
  itemRows, items, updateRow, removeRow, isLoading = false, errorMessage = null,
}: {
  itemRows: ItemRow[];
  items: any[] | undefined;
  updateRow: (rowId: string, patch: Partial<ItemRow>) => void;
  removeRow: (rowId: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  return (
    <div className="space-y-2">
      {itemRows.map((row, idx) => (
        <AdminItemRow
          key={row.rowId}
          row={row}
          idx={idx}
          itemCount={itemRows.length}
          items={items || []}
          onUpdate={updateRow}
          onRemove={removeRow}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />
      ))}
    </div>
  );
}

function NoteField({ form, fieldMode, t }: { form: any; fieldMode: boolean; t: any }) {
  return (
    <FormField control={form.control} name="note" render={({ field }: { field: any }) => (
      <FormItem>
        <FormLabel>{t.noteOptional}</FormLabel>
        <FormControl>
          <Textarea
            placeholder="Reference number, PO, reason…"
            style={fieldMode ? { background: "#141e17", border: "1px solid #203023", borderRadius: 10, color: "#c8deca", fontSize: 13, resize: "none" } : undefined}
            className="resize-none"
            rows={2}
            {...field}
            data-testid="input-note"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

// Re-export for callers that import directly from this file
export { SearchableItemSelect } from "./movement/SearchableItemSelect";
