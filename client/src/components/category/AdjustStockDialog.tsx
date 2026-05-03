import { useState, useEffect, useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/hooks/use-language";
import type { CategoryGroupedItem } from "./types";

type AdjustMode = "absolute" | "delta";

interface AdjustStockDialogProps {
  open: boolean;
  onClose: () => void;
  item: CategoryGroupedItem | null;
  onSaved?: () => void;
}

export function AdjustStockDialog({ open, onClose, item, onSaved }: AdjustStockDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<AdjustMode>("absolute");
  const [absoluteValue, setAbsoluteValue] = useState<string>("");
  const [deltaValue, setDeltaValue] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (open && item) {
      setMode("absolute");
      setAbsoluteValue(String(item.quantityOnHand));
      setDeltaValue("");
      setReason("");
      setNote("");
    }
  }, [open, item?.id]);

  const currentQty = item?.quantityOnHand ?? 0;

  const newQty = useMemo(() => {
    if (mode === "absolute") {
      const n = Number(absoluteValue);
      return isNaN(n) ? null : Math.floor(n);
    }
    const d = Number(deltaValue);
    if (isNaN(d) || !Number.isFinite(d)) return null;
    return currentQty + Math.floor(d);
  }, [mode, absoluteValue, deltaValue, currentQty]);

  const delta = newQty == null ? null : newQty - currentQty;
  const isInvalid = newQty == null || newQty < 0 || !Number.isInteger(newQty);
  const isUnchanged = newQty === currentQty;
  const reasonMissing = reason.trim().length === 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item || newQty == null) throw new Error(t.adjustNoItemSelected);
      const res = await apiRequest("POST", "/api/movements/adjust", {
        itemId: item.id,
        quantity: newQty,
        reason: reason.trim() || null,
        note: note.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t.catAdjustSuccessToast,
        description: item
          ? `${item.sku}: ${currentQty} → ${newQty} ${item.unitOfMeasure}`
          : undefined,
      });
      onSaved?.();
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: t.catAdjustFailedToast,
        description: err?.message ?? t.catAdjustUnable,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (isInvalid || isUnchanged || reasonMissing) return;
    mutation.mutate();
  };

  const stepDelta = (n: number) => {
    if (mode === "delta") {
      const cur = Number(deltaValue) || 0;
      setDeltaValue(String(cur + n));
    } else {
      const cur = Number(absoluteValue);
      const next = (isNaN(cur) ? currentQty : cur) + n;
      setAbsoluteValue(String(Math.max(0, next)));
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-adjust-stock">
        <DialogHeader>
          <DialogTitle>{t.catAdjustTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-slate-900 truncate" data-testid="text-adjust-item-name">
              {item.name}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-0.5" data-testid="text-adjust-item-sku">{item.sku}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-xs text-slate-500 uppercase tracking-wide">{t.catAdjustCurrent}</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums" data-testid="text-adjust-current-qty">
                {currentQty.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">{item.unitOfMeasure}</span>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("absolute")}
              className={`flex-1 text-xs font-medium py-1.5 px-3 rounded transition-colors ${
                mode === "absolute" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
              data-testid="button-adjust-mode-absolute"
            >
              {t.catAdjustSetTo}
            </button>
            <button
              type="button"
              onClick={() => setMode("delta")}
              className={`flex-1 text-xs font-medium py-1.5 px-3 rounded transition-colors ${
                mode === "delta" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
              data-testid="button-adjust-mode-delta"
            >
              {t.catAdjustApplyDelta}
            </button>
          </div>

          {/* Value input */}
          <div>
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {mode === "absolute" ? t.catAdjustNewQty : t.catAdjustDelta}
            </Label>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => stepDelta(-1)}
                data-testid="button-adjust-decrement"
              >
                <Minus className="w-4 h-4" />
              </Button>
              {mode === "absolute" ? (
                <Input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  value={absoluteValue}
                  onChange={(e) => setAbsoluteValue(e.target.value)}
                  className="text-center text-lg font-semibold tabular-nums h-9"
                  data-testid="input-adjust-absolute"
                />
              ) : (
                <Input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={deltaValue}
                  onChange={(e) => setDeltaValue(e.target.value)}
                  placeholder={t.catAdjustDeltaPh}
                  className="text-center text-lg font-semibold tabular-nums h-9"
                  data-testid="input-adjust-delta"
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => stepDelta(1)}
                data-testid="button-adjust-increment"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-brand-50/60 border border-brand-200 rounded-lg p-3 text-sm" data-testid="text-adjust-preview">
            {newQty == null || isInvalid ? (
              <span className="text-red-600">{t.catAdjustValidNumber}</span>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">{t.catAdjustAfterSave}</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {currentQty.toLocaleString()} → {newQty.toLocaleString()} {item.unitOfMeasure}
                  {delta !== 0 && delta != null && (
                    <span className={`ml-2 text-xs font-bold ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      ({delta > 0 ? "+" : ""}{delta})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Reason (required) */}
          <div>
            <Label htmlFor="adjust-reason" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {t.catAdjustReason} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.catAdjustReasonPh}
              className="mt-1.5"
              data-testid="input-adjust-reason"
            />
          </div>

          {/* Optional note */}
          <div>
            <Label htmlFor="adjust-note" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {t.catAdjustNoteOpt}
            </Label>
            <Textarea
              id="adjust-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.catAdjustNotePh}
              className="mt-1.5 min-h-[60px]"
              data-testid="input-adjust-note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending} data-testid="button-adjust-cancel">
            {t.cmnCancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isInvalid || isUnchanged || reasonMissing || mutation.isPending}
            className="bg-brand-700 hover:bg-brand-800"
            data-testid="button-adjust-save"
          >
            {mutation.isPending ? t.cmnSaving : t.catAdjustSaveBtn}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
