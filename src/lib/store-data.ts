import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type ProductBadge = "none" | "always" | "reservation";

export const PRODUCT_BADGES: { value: ProductBadge; label: string }[] = [
  { value: "none", label: "بدون علامة" },
  { value: "always", label: "متوفر دائماً" },
  { value: "reservation", label: "بالحجز" },
];

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  badge: ProductBadge;
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

export type DeliveryTime = {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type DeliveryLocation = {
  id: string;
  name: string;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

export type BookingDay = { id: string; day_of_week: number; is_active: boolean };

export const WEEK_DAYS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الإثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
] as const;

export function dayLabel(day: number | null | undefined) {
  return WEEK_DAYS.find((d) => d.value === day)?.label ?? "";
}

export function useDeliveryTimes(includeInactive = false) {
  return useQuery({
    queryKey: ["delivery_times", includeInactive],
    queryFn: async () => {
      let query = supabase.from("delivery_times").select("*").order("sort_order").order("created_at");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DeliveryTime[];
    },
  });
}

export function useDeliveryLocations(includeInactive = false) {
  return useQuery({
    queryKey: ["delivery_locations", includeInactive],
    queryFn: async () => {
      let query = supabase
        .from("delivery_locations")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DeliveryLocation[];
    },
  });
}

export function useBookingDays(includeInactive = false) {
  return useQuery({
    queryKey: ["booking_days", includeInactive],
    queryFn: async () => {
      let query = supabase.from("booking_days").select("*").order("day_of_week");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BookingDay[];
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
