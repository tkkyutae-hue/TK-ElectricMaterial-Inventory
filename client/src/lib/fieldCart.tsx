/**
 * client/src/lib/fieldCart.tsx
 *
 * Lightweight client-side cart for field mode request preparation.
 * No API calls are made here — adding items to the cart does NOT
 * create movements or change inventory quantities.
 * Actual transaction creation happens in a separate pickup/complete flow.
 */
import { createContext, useContext, useState, useCallback } from "react";

export interface CartItem {
  itemId: number;
  itemName: string;
  sizeLabel: string | null;
  sku: string;
  requestedQty: number;
  unit: string;
  locationName: string | null;
  imageUrl?: string | null;
}

export interface EditingRequestMeta {
  requestType: "issue" | "transfer";
  projectId: number | null;
  notes: string;
  requesterName: string;
  requesterRole: string;
}

interface FieldCartContextValue {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, "requestedQty">, qty: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  removeFromCart: (itemId: number) => void;
  clearCart: () => void;
  restoreCart: (items: CartItem[]) => void;
  getCartItem: (itemId: number) => CartItem | undefined;
  totalItems: number;
  totalQty: number;
  // ── Edit-request session ─────────────────────────────────────────────────
  editingRequestId: number | null;
  editingRequestNumber: string | null;
  editingMeta: EditingRequestMeta | null;
  setEditingRequest: (id: number, requestNumber: string, meta: EditingRequestMeta) => void;
  clearEditingRequest: () => void;
}

const FieldCartContext = createContext<FieldCartContextValue | null>(null);

export function FieldCartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // ── Edit-request session state ──────────────────────────────────────────
  const [editingRequestId,     setEditingRequestId]     = useState<number | null>(null);
  const [editingRequestNumber, setEditingRequestNumber] = useState<string | null>(null);
  const [editingMeta,          setEditingMeta]          = useState<EditingRequestMeta | null>(null);

  const addToCart = useCallback((item: Omit<CartItem, "requestedQty">, qty: number) => {
    setCartItems(prev => {
      const existing = prev.find(c => c.itemId === item.itemId);
      if (existing) {
        return prev.map(c =>
          c.itemId === item.itemId ? { ...c, requestedQty: qty } : c
        );
      }
      return [...prev, { ...item, requestedQty: qty }];
    });
  }, []);

  const updateQty = useCallback((itemId: number, qty: number) => {
    setCartItems(prev =>
      prev.map(c => c.itemId === itemId ? { ...c, requestedQty: qty } : c)
    );
  }, []);

  const removeFromCart = useCallback((itemId: number) => {
    setCartItems(prev => prev.filter(c => c.itemId !== itemId));
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const restoreCart = useCallback((items: CartItem[]) => setCartItems([...items]), []);

  const getCartItem = useCallback(
    (itemId: number) => cartItems.find(c => c.itemId === itemId),
    [cartItems]
  );

  const setEditingRequest = useCallback((id: number, requestNumber: string, meta: EditingRequestMeta) => {
    setEditingRequestId(id);
    setEditingRequestNumber(requestNumber);
    setEditingMeta(meta);
  }, []);

  const clearEditingRequest = useCallback(() => {
    setEditingRequestId(null);
    setEditingRequestNumber(null);
    setEditingMeta(null);
  }, []);

  const totalItems = cartItems.length;
  const totalQty = cartItems.reduce((sum, c) => sum + c.requestedQty, 0);

  return (
    <FieldCartContext.Provider value={{
      cartItems, addToCart, updateQty, removeFromCart,
      clearCart, restoreCart, getCartItem, totalItems, totalQty,
      editingRequestId, editingRequestNumber, editingMeta,
      setEditingRequest, clearEditingRequest,
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
