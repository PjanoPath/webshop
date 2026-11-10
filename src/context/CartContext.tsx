'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = {
  // Two lines can share a productId (two different variants, or a bulk item alongside itself
  // is impossible but a variant + its parent isn't) - lineId is what's actually unique per row.
  lineId: string;
  productId: number;
  variantId: number | null;
  variantLabel: string | null;
  unitLabel: 'g' | 'ml' | null; // set for bulk items only - quantity is a step count, not pieces
  slug: string;
  name: string;
  price: number;
  photoFilename: string | null;
  stock: number;
  quantity: number;
  pickupOnly: boolean;
};

export function cartLineId(productId: number, variantId?: number | null): string {
  return variantId ? `v${variantId}` : `p${productId}`;
}

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineId' | 'quantity'>, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  itemCount: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'vazimsi_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // corrupted/unavailable storage — start with an empty cart
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem: CartContextValue['addItem'] = (item, quantity = 1) => {
    const lineId = cartLineId(item.productId, item.variantId);
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, item.stock);
        return prev.map((i) => (i.lineId === lineId ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { ...item, lineId, quantity: Math.min(quantity, item.stock) }];
    });
  };

  const removeItem = (lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.lineId === lineId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const clear = () => setItems([]);

  const { itemCount, subtotal } = useMemo(
    () => ({
      // A bulk line's quantity is a count of 25 g/ml steps, not pieces - counting it toward the
      // badge the same way a piece/variant quantity is counted would turn "1 kg" into "40" in
      // the header. It's one purchase decision, so it counts as 1 regardless of how many steps.
      itemCount: items.reduce((sum, i) => sum + (i.unitLabel ? 1 : i.quantity), 0),
      subtotal: items.reduce((sum, i) => sum + i.quantity * i.price, 0),
    }),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clear, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart musí byť použitý vnútri CartProvider');
  return ctx;
}
