import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartAddon = { id: string; name: string; price: number };

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  addons: CartAddon[];
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "key">) => void;
  increase: (key: string) => void;
  decrease: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "qimat-aljabal-cart";

function itemKey(productId: string, addons: CartAddon[]) {
  return `${productId}|${addons
    .map((a) => a.id)
    .sort()
    .join(",")}`;
}

export function itemUnitTotal(item: CartItem) {
  return item.unitPrice + item.addons.reduce((sum, a) => sum + Number(a.price), 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const total = items.reduce((sum, item) => sum + itemUnitTotal(item) * item.quantity, 0);
    return {
      items,
      total,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem: (item) =>
        setItems((prev) => {
          const key = itemKey(item.productId, item.addons);
          const existing = prev.find((p) => p.key === key);
          if (existing) {
            return prev.map((p) =>
              p.key === key ? { ...p, quantity: p.quantity + item.quantity } : p,
            );
          }
          return [...prev, { ...item, key }];
        }),
      increase: (key) =>
        setItems((prev) => prev.map((p) => (p.key === key ? { ...p, quantity: p.quantity + 1 } : p))),
      decrease: (key) =>
        setItems((prev) =>
          prev
            .map((p) => (p.key === key ? { ...p, quantity: p.quantity - 1 } : p))
            .filter((p) => p.quantity > 0),
        ),
      remove: (key) => setItems((prev) => prev.filter((p) => p.key !== key)),
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function formatPrice(value: number) {
  return `${Number(value).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ريال`;
}
