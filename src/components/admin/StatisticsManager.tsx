import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CalendarDays, Eye, ShoppingBag, TrendingUp, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";

type TopProduct = [string, { quantity: number; sales: number }];

type Statistics = {
  orderCount: number;
  revenue: number;
  monthOrderCount: number;
  monthRevenue: number;
  uniqueVisitors: number;
  totalVisits: number;
  topProducts: TopProduct[];
  monthTopProducts: TopProduct[];
  monthLabel: string;
};

export function StatisticsManager() {
  const stats = useQuery({
    queryKey: ["admin-statistics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_statistics");
      if (error) throw error;
      const result = data as unknown as Statistics & { monthLabel: string };
      const monthDate = new Date(`${result.monthLabel}-01T00:00:00`);
      return { ...result, monthLabel: monthDate.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }) };
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (stats.isLoading) {
    return <p className="text-center text-muted-foreground">جاري تحميل الإحصائيات…</p>;
  }

  if (stats.isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">تعذّر تحميل الإحصائيات.</p>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-primary underline underline-offset-4"
          onClick={() => stats.refetch()}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const data = stats.data;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-primary">📊 الإحصائيات</h2>
        <p className="mt-1 text-sm text-muted-foreground">ملخص الطلبات والزيارات والمنتجات الأكثر طلبًا.</p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={<Eye className="size-5" />} label="إجمالي الزيارات" value={data.totalVisits.toLocaleString("ar-EG")} />
        <StatCard icon={<Users className="size-5" />} label="الزوار الفريدون" value={data.uniqueVisitors.toLocaleString("ar-EG")} />
        <StatCard icon={<ShoppingBag className="size-5" />} label="إجمالي الطلبات" value={data.orderCount.toLocaleString("ar-EG")} />
        <StatCard icon={<TrendingUp className="size-5" />} label="إجمالي المبيعات" value={formatPrice(data.revenue)} />
      </section>

      <section className="card-soft p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-primary">إحصائيات هذا الشهر</h3>
            <p className="text-xs text-muted-foreground">{data.monthLabel}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground">إجمالي الطلبات هذا الشهر</p>
            <p className="mt-1 text-2xl font-extrabold text-primary">{data.monthOrderCount.toLocaleString("ar-EG")}</p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground">المبيعات هذا الشهر</p>
            <p className="mt-1 text-xl font-extrabold text-primary">{formatPrice(data.monthRevenue)}</p>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-bold text-primary">أكثر 5 منتجات طلبًا هذا الشهر</h4>
          {data.monthTopProducts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">لا توجد طلبات هذا الشهر.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {data.monthTopProducts.map(([name, product], index) => (
                <li key={name} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{index + 1}. {name}</p>
                    <p className="text-xs text-muted-foreground">{product.quantity.toLocaleString("ar-EG")} طلب/قطعة</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary">{formatPrice(product.sales)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="card-soft p-4">
        <h3 className="font-bold text-primary">المنتجات الأكثر طلبًا</h3>
        {data.topProducts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">لا توجد طلبات بعد.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {data.topProducts.map(([name, product], index) => (
              <li key={name} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{index + 1}. {name}</p>
                  <p className="text-xs text-muted-foreground">{product.quantity.toLocaleString("ar-EG")} طلب/قطعة</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-primary">{formatPrice(product.sales)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        يتم احتساب الزائر المميز مرة واحدة لكل جلسة تقريبًا، بدون تسجيل دخول. تحديث الصفحة داخل الجلسة لا ينشئ زائرًا جديدًا.
      </p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="card-soft p-4">
      <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-primary">{value}</p>
    </div>
  );
}
