import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProjectScopeItem } from "@shared/schema";

export function ScopeDeleteDialog({
  target, isPending, onClose, onConfirm,
}: {
  target: ProjectScopeItem | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (id: number) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>Delete Scope Item?</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-600 py-2">
          Remove <span className="font-semibold">"{target?.itemName}"</span> from this project's scope? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => target && onConfirm(target.id)}
            disabled={isPending} data-testid="button-confirm-delete-scope">
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UndoSnackbar({
  message, onUndo, onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl"
      data-testid="undo-snackbar">
      <span className="font-medium">{message}</span>
      <button onClick={onUndo} className="font-bold text-brand-400 hover:text-brand-300 transition-colors"
        data-testid="button-undo-delete">
        Undo
      </button>
      <button onClick={onDismiss} className="text-slate-500 hover:text-white transition-colors ml-1"
        data-testid="button-dismiss-snackbar">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Re-export Trash2 icon used in the snackbar dismiss for convenience
export { Trash2 };
