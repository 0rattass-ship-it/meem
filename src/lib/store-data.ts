import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

export type Addon = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
};

export type ProductAddon = { id: string; product_id: string; addon_id: string };

export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: ["categories", includeInactive],
    queryFn: async () => {
      let query = supabase.from("categories").select("*").order("sort_order");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

export function useAddons() {
  return useQuery({
    queryKey: ["addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("addons").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Addon[];
    },
  });
}

export function useProductAddons() {
  return useQuery({
    queryKey: ["product_addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_addons").select("*");
      if (error) throw error;
      return (data ?? []) as ProductAddon[];
    },
  });
}

export const ORDER_STATUSES = [
  { value: "new", label: "جديد" },
  { value: "preparing", label: "قيد التجهيز" },
  { value: "ready", label: "جاهز" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export function statusLabel(status: string) {
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}
