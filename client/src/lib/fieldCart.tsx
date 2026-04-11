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
}

interface FieldCartContextValue {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, "requestedQty">, qty: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  removeFromCart: (itemId: number) => void;
  clearCart: () => void;
  getCartItem: (itemId: number) => CartItem | undefined;
  totalItems: number;
  totalQty: number;
}

const FieldCartContext = createContext<FieldCartContextValue | null>(null);

export function FieldCartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

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
