/**
 * client/src/lib/fieldCart.tsx
 *
 * Lightweight client-side cart for field mode request preparation.
 * No API calls are made here — adding items to the cart does NOT
 * create movements or change inventory quantities.
 * Actual transaction creation happens in a separate pickup/complete flow.
 */
import { createContext, useContext, useState, useCallback, useSyncExternalStore } from "react";
import { createFieldDraftStore, hasFieldDraft } from "./fieldCartDraft";
import type { CartItem, EditingRequestMeta, FieldCartDraft } from "./fieldCartDraft";
export type { CartItem, EditingRequestMeta, FieldCartDraft } from "./fieldCartDraft";

interface FieldCartContextValue {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, "requestedQty">, qty: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  removeFromCart: (itemId: number) => void;
  clearCart: () => void;
  draft: FieldCartDraft;
  hasDraft: boolean;
  updateMeta: (patch: Partial<EditingRequestMeta>) => void;
  getDraft: () => FieldCartDraft;
  replaceDraft: (draft: FieldCartDraft, confirmDiscard: () => boolean) => boolean;
  resetDraft: () => void;
  clearSubmittedDraft: (draft: FieldCartDraft) => boolean;
  getCartItem: (itemId: number) => CartItem | undefined;
  totalItems: number;
  totalQty: number;
  // ── Edit-request session ─────────────────────────────────────────────────
  editingRequestId: number | null;
  editingRequestNumber: string | null;
}

const FieldCartContext = createContext<FieldCartContextValue | null>(null);

export function FieldCartProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createFieldDraftStore);
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const cartItems = draft.items;
  const { editingRequestId, editingRequestNumber } = draft;

  const addToCart = useCallback((item: Omit<CartItem, "requestedQty">, qty: number) => {
    store.updateItems(prev => {
      const existing = prev.find(c => c.itemId === item.itemId);
      if (existing) {
        return prev.map(c =>
          c.itemId === item.itemId ? { ...c, requestedQty: qty } : c
        );
      }
      return [...prev, { ...item, requestedQty: qty }];
    });
  }, [store]);

  const updateQty = useCallback((itemId: number, qty: number) => {
    store.updateItems(prev =>
      prev.map(c => c.itemId === itemId ? { ...c, requestedQty: qty } : c)
    );
  }, [store]);

  const removeFromCart = useCallback((itemId: number) => {
    store.updateItems(prev => prev.filter(c => c.itemId !== itemId));
  }, [store]);

  const clearCart = useCallback(() => store.updateItems(() => []), [store]);

  const getCartItem = useCallback(
    (itemId: number) => cartItems.find(c => c.itemId === itemId),
    [cartItems]
  );

  const totalItems = cartItems.length;
  const totalQty = cartItems.reduce((sum, c) => sum + c.requestedQty, 0);

  return (
    <FieldCartContext.Provider value={{
      cartItems, addToCart, updateQty, removeFromCart,
      clearCart, getCartItem, totalItems, totalQty,
      editingRequestId, editingRequestNumber,
      draft, hasDraft: hasFieldDraft(draft), updateMeta: store.patchMeta,
      getDraft: store.getSnapshot, replaceDraft: store.replace,
      resetDraft: store.reset, clearSubmittedDraft: store.clearIfCurrent,
    }}>
      {children}
    </FieldCartContext.Provider>
  );
}

export function useFieldCart(): FieldCartContextValue {
  const ctx = useContext(FieldCartContext);
  if (!ctx) throw new Error("useFieldCart must be used inside FieldCartProvider");
  return ctx;
}
