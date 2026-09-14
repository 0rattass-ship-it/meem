import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const publicQueryOptions = { retry: 3, retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000), staleTime: 30_000 };

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type PaymentSettings = {
  account_holder_name: string;
  account_number: string;
  payment_window: string;
};

export function usePaymentSettings() {
  return useQuery({
    ...publicQueryOptions,
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("account_holder_name, account_number, payment_window")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { account_holder_name: "", account_number: "", payment_window: "" }) as PaymentSettings;
    },
  });
}

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
  addons_required: boolean;
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
    ...publicQueryOptions,
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
    ...publicQueryOptions,
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
  day_of_week: number | null;
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

/** أيام التسليم المستخرجة من أوقات التسليم (الوقت بدون يوم يعني كل الأيام) */
export function deliveryDaysFromTimes(times: DeliveryTime[] | undefined) {
  const days = new Set<number>();
  let hasAnyDay = false;
  for (const t of times ?? []) {
    if (t.day_of_week === null || t.day_of_week === undefined) hasAnyDay = true;
    else days.add(t.day_of_week);
  }
  if (hasAnyDay) for (const d of WEEK_DAYS) days.add(d.value);
  return Array.from(days).sort((a, b) => a - b);
}

/** أوقات التسليم المتاحة في يوم معيّن */
export function timesForDay(times: DeliveryTime[] | undefined, day: number | null) {
  if (day === null) return times ?? [];
  return (times ?? []).filter((t) => t.day_of_week === null || t.day_of_week === day);
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

export type ProductBookingDay = { id: string; product_id: string; day_of_week: number };
export type ProductDeliveryTime = { id: string; product_id: string; delivery_time_id: string };

export function useProductBookingDays() {
  return useQuery({
    queryKey: ["product_booking_days"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_booking_days").select("*");
      if (error) throw error;
      return (data ?? []) as ProductBookingDay[];
    },
  });
}

export function useProductDeliveryTimes() {
  return useQuery({
    queryKey: ["product_delivery_times"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_delivery_times").select("*");
      if (error) throw error;
      return (data ?? []) as ProductDeliveryTime[];
    },
  });
}

/** أيام الحجز الخاصة بمنتج (فراغ = بدون قيود) */
export function productDays(rows: ProductBookingDay[] | undefined, productId: string) {
  return (rows ?? []).filter((r) => r.product_id === productId).map((r) => r.day_of_week);
}

export function productTimeIds(rows: ProductDeliveryTime[] | undefined, productId: string) {
  return (rows ?? []).filter((r) => r.product_id === productId).map((r) => r.delivery_time_id);
}

/** هل المنتج متاح للحجز اليوم بحسب أيامه المحددة؟ */
export function isProductAvailableToday(
  rows: ProductBookingDay[] | undefined,
  productId: string,
  today = new Date().getDay(),
) {
  const days = productDays(rows, productId);
  if (days.length === 0) return true;
  return days.includes(today);
}

/** أيام الحجز المسموحة لكل منتجات السلة (تقاطع، والفراغ يعني كل الأيام) */
export function commonBookingDays(
  rows: ProductBookingDay[] | undefined,
  productIds: string[],
) {
  let allowed = WEEK_DAYS.map((d) => d.value as number);
  for (const id of productIds) {
    const own = productDays(rows, id);
    if (own.length > 0) allowed = allowed.filter((d) => own.includes(d));
  }
  return allowed;
}

/** أقرب يوم قادم متاح ومشترك (التسليم لا يكون في نفس اليوم) */
export function nearestCommonDay(
  candidateDays: number[],
  today = new Date().getDay(),
) {
  for (let i = 1; i <= 7; i += 1) {
    const day = (today + i) % 7;
    if (candidateDays.includes(day)) return day;
  }
  return null;
}

/** حالات الطلب التي تظهر للعميل والإدارة.
 * القيم القديمة تبقى مدعومة حتى لا تتعطل الطلبات الموجودة.
 */
export const ORDER_STATUSES = [
  { value: "received", label: "تم استلام الطلب" },
  { value: "reviewing", label: "قيد المراجعة" },
  { value: "accepted", label: "تم قبول الطلب" },
  { value: "preparing", label: "جاري التجهيز" },
  { value: "ready", label: "جاهز" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغي" },
] as const;

export const ORDER_STATUS_STEPS = [
  { value: "received", label: "تم استلام الطلب" },
  { value: "reviewing", label: "قيد المراجعة" },
  { value: "accepted", label: "تم قبول الطلب" },
  { value: "preparing", label: "جاري التجهيز" },
  { value: "ready", label: "جاهز" },
  { value: "delivered", label: "تم التسليم" },
] as const;

const LEGACY_STATUS_MAP: Record<string, string> = {
  new: "received",
  preparing: "preparing",
  ready: "ready",
  completed: "delivered",
  cancelled: "cancelled",
};

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export function normalizedOrderStatus(status: string): string {
  return LEGACY_STATUS_MAP[status] ?? status;
}

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export function statusLabel(status: string) {
  const normalized = normalizedOrderStatus(status);
  return ORDER_STATUSES.find((s) => s.value === normalized)?.label ?? status;
}
