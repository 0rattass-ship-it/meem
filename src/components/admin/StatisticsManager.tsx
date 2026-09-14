import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Eye,
  ShoppingBag,
  TrendingUp,
  Users,
  Trophy,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";

type TopProduct = [
  string,
  {
    quantity: number;
    sales: number;
  },
];

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
      const { data, error } = await supabase.rpc(
        "get_admin_statistics_v2",
        {
          p_request: "statistics",
        },
      );

      if (error) throw error;

      const result = data as unknown as Statistics;

      const monthDate = new Date(
        `${result.monthLabel}-01T00:00:00`,
      );

      return {
        ...result,
        monthLabel: monthDate.toLocaleDateString("ar-YE", {
          month: "long",
          year: "numeric",
        }),
      };
    },
    retry: 3,
    retryDelay: (attempt) =>
      Math.min(1000 * 2 ** attempt, 5000),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (stats.isLoading) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        جاري تحميل الإحصائيات…
      </p>
    );
  }

  if (stats.isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">
          تعذّر تحميل الإحصائيات.
        </p>

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
        <h2 className="text-xl font-extrabold text-primary">
          📊 الإحصائيات
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          متابعة المبيعات والطلبات والزوار والمنتجات الأكثر طلبًا.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="مبيعات هذا الشهر"
          value={formatPrice(data.monthRevenue)}
        />

        <StatCard
          icon={<Users className="size-5" />}
          label="الزوار"
          value={data.uniqueVisitors.toLocaleString("ar-YE")}
        />

        <StatCard
          icon={<ShoppingBag className="size-5" />}
          label="طلبات هذا الشهر"
          value={data.monthOrderCount.toLocaleString("ar-YE")}
        />

        <StatCard
          icon={<Eye className="size-5" />}
          label="إجمالي الزيارات"
          value={data.totalVisits.toLocaleString("ar-YE")}
        />
      </section>

      <section className="card-soft p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CalendarDays className="size-5" />
          </div>

          <div>
            <h3 className="font-bold text-primary">
              إحصائيات الشهر الحالي
            </h3>

            <p className="text-xs text-muted-foreground">
              {data.monthLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-surface p-4">
          <p className="text-sm text-muted-foreground">
            إجمالي المبيعات
          </p>

          <p className="mt-1 text-3xl font-extrabold text-primary">
            {formatPrice(data.monthRevenue)}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground">
              عدد الطلبات
            </p>

            <p className="mt-1 text-2xl font-extrabold text-primary">
              {data.monthOrderCount.toLocaleString("ar-YE")}
            </p>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground">
              الزوار
            </p>

            <p className="mt-1 text-2xl font-extrabold text-primary">
              {data.uniqueVisitors.toLocaleString("ar-YE")}
            </p>
          </div>
        </div>
      </section>

      <section className="card-soft p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Trophy className="size-5" />
          </div>

          <div>
            <h3 className="font-bold text-primary">
              أكثر 5 منتجات طلبًا
            </h3>

            <p className="text-xs text-muted-foreground">
              خلال {data.monthLabel}
            </p>
          </div>
        </div>

        {data.monthTopProducts.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-surface p-4 text-center text-sm text-muted-foreground">
            لا توجد طلبات هذا الشهر حتى الآن.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {data.monthTopProducts.slice(0, 5).map(
              ([name, product], index) => (
                <li
                  key={`${name}-${index}`}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {name}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.quantity.toLocaleString("ar-YE")} قطعة
                    </p>
                  </div>

                  <div className="shrink-0 text-left">
                    <p className="text-sm font-bold text-primary">
                      {formatPrice(product.sales)}
                    </p>

                    <p className="text-[11px] text-muted-foreground">
                      مبيعات
                    </p>
                  </div>
                </li>
              ),
            )}
          </ol>
        )}
      </section>

      <section className="card-soft p-4">
        <h3 className="font-bold text-primary">
          الإجمالي منذ بداية المشروع
        </h3>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground">
              إجمالي المبيعات
            </p>

            <p className="mt-1 text-lg font-extrabold text-primary">
              {formatPrice(data.revenue)}
            </p>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground">
              إجمالي الطلبات
            </p>

            <p className="mt-1 text-2xl font-extrabold text-primary">
              {data.orderCount.toLocaleString("ar-YE")}
            </p>
          </div>
        </div>
      </section>

      <p className="text-xs leading-5 text-muted-foreground">
        يتم احتساب الزائر الفريد حسب جلسة الزيارة، بينما يتم تحديث
        الإحصائيات تلقائيًا كل دقيقة تقريبًا.
      </p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card-soft p-4">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {icon}
      </div>

      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-xl font-extrabold text-primary">
        {value}
      </p>
    </div>
  );
}
