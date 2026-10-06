import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { CategoriesManager } from "@/features/admin/CategoriesManager";
import { ProductsManager } from "@/features/admin/ProductsManager";
import { AddonsManager } from "@/features/admin/AddonsManager";
import { OrdersManager } from "@/features/admin/OrdersManager";
import { DeliverySettingsManager } from "@/features/admin/DeliverySettingsManager";
import { StatisticsManager } from "@/features/admin/StatisticsManager";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — مِيم | MEEM" },
      { name: "description", content: "إدارة الأقسام والمنتجات والإضافات والطلبات." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "لوحة التحكم — مِيم | MEEM" },
      { property: "og:description", content: "إدارة الأقسام والمنتجات والإضافات والطلبات." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const access = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return { isAdmin: false, email: "" };
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) throw error;
      return { isAdmin: data === true, email: user.email ?? "" };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (access.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }

  if (!access.data?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-soft max-w-sm p-8 text-center">
          <h1 className="text-xl font-bold text-primary">غير مصرّح بالدخول</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            هذا الحساب لا يملك صلاحية الوصول إلى لوحة التحكم.
          </p>
          <Button className="mt-6 w-full rounded-full" onClick={signOut}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-primary">لوحة التحكم</h1>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {access.data.email}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate({ to: "/" })}
          >
            <Store className="size-4" /> المتجر
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={signOut}>
            <LogOut className="size-4" /> خروج
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Tabs defaultValue="orders">
          <TabsList className="mb-6 w-full justify-between rounded-full bg-surface p-1">
            <TabsTrigger className="flex-1 rounded-full text-xs sm:text-sm" value="orders">
              الطلبات
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full text-xs sm:text-sm" value="statistics">
              📊 الإحصائيات
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full text-xs sm:text-sm" value="delivery">
              التسليم
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full text-xs sm:text-sm" value="addons">
              الإضافات
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full text-xs sm:text-sm" value="products">
              المنتجات
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full text-xs sm:text-sm" value="categories">
              الأقسام
            </TabsTrigger>
          </TabsList>
          <TabsContent value="orders">
            <OrdersManager />
          </TabsContent>
          <TabsContent value="statistics">
            <StatisticsManager />
          </TabsContent>
          <TabsContent value="delivery">
            <DeliverySettingsManager />
          </TabsContent>
          <TabsContent value="addons">
            <AddonsManager />
          </TabsContent>
          <TabsContent value="products">
            <ProductsManager />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesManager />
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}
