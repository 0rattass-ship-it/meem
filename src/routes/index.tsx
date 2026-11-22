import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Home,
  Store,
  UtensilsCrossed,
  ShoppingCart,
  Plus,
  Minus,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  UserRound,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart, formatPrice, type CartAddon } from "@/features/store/cart";
import { ProductImage } from "@/features/store/product-image";
import { InstallAppButton } from "@/features/customer/InstallAppButton";
import { supabase } from "@/integrations/supabase/client";
import { CustomerLoginDialog } from "@/features/customer/CustomerLoginDialog";
import { CustomerProfileDialog } from "@/features/customer/CustomerProfileDialog";

import {
  dayLabel,
  isProductAvailableToday,
  productDays,
  useAddons,
  useCategories,
  useProductAddons,
  useProductBookingDays,
  useProducts,
  type Product,
  type ProductBadge,
  useStoreInformation,
} from "@/data/store-data";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مِيم | MEEM — اطلب وجبتك الآن" },
      {
        name: "description",
        content:
          "قائمة مِيم | MEEM: وجبات سريعة، ساندويتشات، عصائر وحلويات. اختر طلبك وأرسله مباشرة.",
      },
      {
        property: "og:title",
        content: "مِيم | MEEM — اطلب وجبتك الآن",
      },
      {
        property: "og:description",
        content:
          "قائمة مِيم | MEEM: وجبات سريعة، ساندويتشات، عصائر وحلويات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const categories = useCategories();
  const products = useProducts();
  const addons = useAddons();
  const productAddons = useProductAddons();
  const bookingDays = useProductBookingDays();
  const cart = useCart();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const [savedOrders, setSavedOrders] = useState<
    Array<{
      orderNumber: number;
      createdAt: string;
      status: string;
      bookingDay: number | null;
      deliveryTime: string | null;
    }>
  >([]);
  const [ordersLoadError, setOrdersLoadError] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const storeInfo = useStoreInformation();

  async function loadCustomerData() {
    setAuthLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setProfile(null);
      setSavedOrders([]);
      setOrdersLoadError(false);
      setAuthLoading(false);
      return;
    }

    const fallbackName =
      (user.user_metadata?.["name"] as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "عميل";

    setProfile({
      name: fallbackName,
      email: user.email ?? "",
    });

    // Only show orders linked to the signed-in customer account.
    setOrdersLoadError(false);
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "order_number, created_at, status, booking_day, delivery_time",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Loading customer orders failed:", error);
      setSavedOrders([]);
      setOrdersLoadError(true);
      setAuthLoading(false);
      return;
    }


    setSavedOrders(
      (orders ?? []).map((order) => ({
        orderNumber: order.order_number,
        createdAt: order.created_at,
        status: order.status,
        bookingDay: order.booking_day,
        deliveryTime: order.delivery_time,
      })),
    );

    setAuthLoading(false);
  }

  useEffect(() => {
    void loadCustomerData();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        void loadCustomerData();
      }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const storageKey = "meem-visitor-session";
    const sessionWindowMs = 30 * 60 * 1000;
    const now = Date.now();

    try {
      const stored = localStorage.getItem(storageKey);

      let sessionId = "";
      let lastSeen = 0;

      if (stored) {
        const parsed = JSON.parse(stored) as {
          id?: string;
          lastSeen?: number;
        };

        sessionId = typeof parsed.id === "string" ? parsed.id : "";
        lastSeen =
          typeof parsed.lastSeen === "number" ? parsed.lastSeen : 0;
      }

      if (!sessionId || now - lastSeen >= sessionWindowMs) {
        sessionId =
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          id: sessionId,
          lastSeen: now,
        }),
      );

      void (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<unknown>)("record_visitor_session", {
        _session_id: sessionId,
      });
    } catch {
      // Visitor analytics must never interrupt or block the store.
    }
  }, []);

  const availableToday = (productId: string) =>
    isProductAvailableToday(bookingDays.data, productId);

  const daysText = (productId: string) =>
    productDays(bookingDays.data, productId)
      .sort((a, b) => a - b)
      .map((d) => dayLabel(d))
      .join(" ، ");

  const visibleCategories = useMemo(() => {
    const list = categories.data ?? [];

    return activeCategory
      ? list.filter((c) => c.id === activeCategory)
      : list;
  }, [categories.data, activeCategory]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();

    for (const p of products.data ?? []) {
      if (!p.category_id) continue;

      map.set(p.category_id, [
        ...(map.get(p.category_id) ?? []),
        p,
      ]);
    }

    return map;
  }, [products.data]);

  const addonsForProduct = (productId: string): CartAddon[] => {
    const ids = (productAddons.data ?? [])
      .filter((pa) => pa.product_id === productId)
      .map((pa) => pa.addon_id);

    return (addons.data ?? [])
      .filter((a) => a.is_active && ids.includes(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        price: Number(a.price),
      }));
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-background">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-5">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
            <Home className="size-7" />
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-primary">
              مِيم | MEEM
            </h1>
            <p className="text-sm text-muted-foreground">
              اختر طلبك وأرسله مباشرة
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-2 rounded-full px-5"
              onClick={() => setInfoOpen(true)}
            >
              <Info className="size-4" />
              التعليمات
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full"
              onClick={() =>
                profile
                  ? setProfileOpen(true)
                  : setLoginOpen(true)
              }
            >
              <UserRound className="size-4" />
              {profile ? "بياناتي" : "تسجيل الدخول"}
            </Button>
          </div>

          <InstallAppButton />
        </div>
      </header>

      <nav className="bg-background">
        <div className="mx-auto max-w-3xl overflow-x-auto px-4 py-3">
          <div className="flex gap-2">
            <CategoryChip
              active={activeCategory === null}
              label="الكل"
              onClick={() => setActiveCategory(null)}
            />

            {(categories.data ?? []).map((c) => (
              <CategoryChip
                key={c.id}
                active={activeCategory === c.id}
                label={c.name}
                onClick={() => setActiveCategory(c.id)}
              />
            ))}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {categories.isLoading || products.isLoading ? (
          <p className="py-16 text-center text-muted-foreground">
            جاري تحميل القائمة…
          </p>
        ) : categories.isError &&
          categories.data === undefined ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">
              تعذّر تحميل الأقسام. قد يكون الاتصال بقاعدة البيانات مؤقتًا.
            </p>

            <button
              type="button"
              className="mt-3 text-sm font-semibold text-primary underline underline-offset-4"
              onClick={() => categories.refetch()}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : products.isError &&
          products.data === undefined ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">
              تعذّر تحميل المنتجات. قد يكون الاتصال مؤقتًا.
            </p>

            <button
              type="button"
              className="mt-3 text-sm font-semibold text-primary underline underline-offset-4"
              onClick={() => products.refetch()}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : visibleCategories.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            لا توجد أقسام بعد.
          </p>
        ) : (
          visibleCategories.map((category) => {
            const list =
              productsByCategory.get(category.id) ?? [];

            if (list.length === 0) return null;

            return (
              <section
                key={category.id}
                className="mb-8"
              >
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-primary">
                  <UtensilsCrossed className="size-5" />
                  {category.name}
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  {list.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      hasAddons={
                        addonsForProduct(product.id).length > 0
                      }
                      onOpen={() => setSelected(product)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
        <nav className="mx-auto flex max-w-3xl items-stretch justify-around gap-1 rounded-full bg-brand-dark px-2 py-2 text-primary-foreground shadow-[var(--shadow-soft)]">
          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }
            className="flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Home className="size-5" />
            القائمة الرئيسية
          </button>

          <button
            type="button"
            onClick={() => {
              if (profile) {
                void loadCustomerData();
                setOrdersOpen(true);
              } else {
                setLoginOpen(true);
              }
            }}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-xs font-semibold text-primary-foreground/80 transition-colors hover:text-primary-foreground"
          >
            <ClipboardList className="size-5" />
            طلباتي
          </button>

          {cart.count > 0 && (
            <Link
              to="/checkout"
              className="flex flex-1 flex-col items-center gap-0.5 rounded-full bg-primary-foreground/15 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <ShoppingCart className="size-5" />
              السلة ({cart.count}) — {formatPrice(cart.total)}
            </Link>
          )}
        </nav>
      </div>

      <CustomerLoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLoggedIn={() => void loadCustomerData()}
      />

      {profile && (
        <CustomerProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          initialName={profile.name}
          email={profile.email}
          onSaved={(saved) => setProfile(saved)}
        />
      )}

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>التعليمات</DialogTitle>
            <DialogDescription>مواعيد الحجز والتسليم المعتمدة من المتجر.</DialogDescription>
          </DialogHeader>
          {storeInfo.isLoading ? (
            <p className="py-6 text-center text-muted-foreground">جاري التحميل…</p>
          ) : storeInfo.data ? (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              <InstructionRow
                color="green"
                bookingText={storeInfo.data.green_booking_instruction}
                deliveryText={storeInfo.data.green_delivery_instruction}
              />
              <InstructionRow
                color="beige"
                bookingText={storeInfo.data.beige_booking_instruction}
                deliveryText={storeInfo.data.beige_delivery_instruction}
              />
              {storeInfo.data.content?.trim() && (
                <div className="whitespace-pre-line border-t border-border pt-4 text-sm leading-7 text-muted-foreground">
                  {storeInfo.data.content}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface p-5 text-center text-sm text-muted-foreground">
              لا توجد تعليمات حالياً.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={ordersOpen}
        onOpenChange={setOrdersOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>طلباتي</DialogTitle>

            <DialogDescription>
              جميع الطلبات المرتبطة بحسابك.
            </DialogDescription>
          </DialogHeader>

          {authLoading ? (
            <p className="py-6 text-center text-muted-foreground">
              جاري تحميل الطلبات…
            </p>
          ) : ordersLoadError ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                تعذّر تحميل طلباتك. تحقق من اتصال الإنترنت وحاول مجددًا.
              </p>
              <Button variant="outline" onClick={() => void loadCustomerData()}>
                إعادة المحاولة
              </Button>
            </div>
          ) : savedOrders.length === 0 ? (
            <div className="rounded-2xl bg-surface p-5 text-center text-sm text-muted-foreground">
              لا توجد طلبات في حسابك بعد.
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {savedOrders.map((order) => (
                <div
                  key={order.orderNumber}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-primary">
                        طلب رقم {order.orderNumber}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(
                          order.createdAt,
                        ).toLocaleString("ar-YE")}
                      </p>

                      {order.bookingDay !== null && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          موعد الاستلام:{" "}
                          {dayLabel(order.bookingDay)}
                        </p>
                      )}

                      {order.deliveryTime && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          وقت الاستلام:{" "}
                          {order.deliveryTime}
                        </p>
                      )}
                    </div>

                    <Button
                      asChild
                      size="sm"
                      className="rounded-full"
                    >
                      <a
                        href={`/checkout?order=${encodeURIComponent(
                          order.orderNumber,
                        )}&mine=1`}
                      >
                        متابعة الطلب
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ProductDialog
        product={selected}
        addons={
          selected
            ? addonsForProduct(selected.id)
            : []
        }
        bookingAvailable={
          selected
            ? availableToday(selected.id)
            : true
        }
        bookingDaysText={
          selected
            ? daysText(selected.id)
            : ""
        }
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function ProductBadgeTag({
  badge,
  className = "",
}: {
  badge: ProductBadge | null | undefined;
  className?: string;
}) {
  if (!badge || badge === "none") return null;

  const always = badge === "always";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-[var(--shadow-soft)] ${
        always
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      } ${className}`}
    >
      {always ? (
        <BadgeCheck className="size-3.5" />
      ) : (
        <CalendarClock className="size-3.5" />
      )}

      {always ? "متوفر دائماً" : "بالحجز"}
    </span>
  );
}

function InstructionRow({
  color,
  bookingText,
  deliveryText,
}: {
  color: "green" | "beige";
  bookingText?: string | null;
  deliveryText?: string | null;
}) {
  return (
    <div className="flex min-h-20 items-stretch gap-4 rounded-xl bg-surface p-4">
      <span
        aria-hidden="true"
        className={`w-2 shrink-0 rounded-full ${color === "green" ? "bg-schedule-green" : "bg-schedule-beige"}`}
      />
      <div className="self-center space-y-2 text-sm leading-7 text-foreground">
        <p className="whitespace-pre-line"><span className="font-bold">الحجز:</span>{" "}{bookingText?.trim() || "لم يُحدد الموعد بعد"}</p>
        <p className="whitespace-pre-line"><span className="font-bold">التسليم:</span>{" "}{deliveryText?.trim() || "لم يُحدد الموعد بعد"}</p>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      className={`h-10 shrink-0 rounded-full px-5 text-sm font-bold transition-colors ${
        active
          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          : "bg-card text-secondary-foreground hover:bg-accent"
      }`}
    >
      {label}
    </Button>
  );
}

function ProductCard({
  product,
  hasAddons,
  onOpen,
}: {
  product: Product;
  hasAddons: boolean;
  onOpen: () => void;
}) {
  const cart = useCart();

  const inCart = cart.items
    .filter((i) => i.productId === product.id)
    .reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border-[6px] border-border bg-card p-2 shadow-[var(--shadow-soft)]">
      <Button
        variant="ghost"
        onClick={onOpen}
        className="relative mb-2 flex h-auto aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-2xl bg-muted p-0"
      >
        <ProductBadgeTag
          badge={product.badge}
          className="absolute right-2 top-2"
        />

        <ProductImage
          imageUrl={product.image_url}
          alt={product.name}
          loading="eager"
          className="size-full object-cover"
          fallback={
            <UtensilsCrossed className="size-10 text-brand-soft" />
          }
        />
      </Button>

      <Button
        variant="ghost"
        onClick={onOpen}
        className="relative flex h-auto min-h-14 flex-col items-start gap-0 whitespace-normal rounded-none py-0 pr-4 pl-1 text-right hover:bg-transparent"
      >
        {product.card_stripe_primary !== "hidden" && (
          <span aria-hidden="true" className={`absolute right-0 top-1 bottom-1 block w-2 rounded-full ${product.card_stripe_primary === "beige" ? "bg-schedule-beige" : "bg-schedule-green"}`} />
        )}
        <h3 className="w-full break-words text-base font-bold leading-6 text-foreground">
          {product.name}
        </h3>

        <p className="w-full text-sm leading-6 text-muted-foreground">
          {formatPrice(Number(product.price))}
        </p>
      </Button>

      {!product.is_available ? (
        <p className="mt-3 rounded-full bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">
          غير متوفر حالياً
        </p>
      ) : (
        <div className="mt-2">
          <Button
            onClick={onOpen}
            className="w-full rounded-full"
            size="sm"
          >
            <Plus className="size-4" />

            {hasAddons
              ? "اختيار الإضافات"
              : "إضافة للسلة"}

            {inCart > 0
              ? ` (${inCart})`
              : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

function ProductDialog({
  product,
  addons,
  bookingAvailable,
  bookingDaysText,
  onClose,
}: {
  product: Product | null;
  addons: CartAddon[];
  bookingAvailable: boolean;
  bookingDaysText: string;
  onClose: () => void;
}) {
  const cart = useCart();

  const [chosen, setChosen] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const open = product !== null;
  const key = product?.id ?? "";

  useMemo(() => {
    setChosen([]);
    setQuantity(1);
  }, [key]);

  if (!product) return null;

  const chosenAddons = addons.filter((a) =>
    chosen.includes(a.id),
  );

  const unit =
    Number(product.price) +
    chosenAddons.reduce(
      (s, a) => s + a.price,
      0,
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent
        className="max-w-md"
        dir="rtl"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="text-primary">
            {product.name}
          </DialogTitle>

          <DialogDescription>
            {product.description ||
              "اختر الكمية والإضافات"}
          </DialogDescription>
        </DialogHeader>

        <ProductImage
          imageUrl={product.image_url}
          alt={product.name}
          className="h-40 w-full rounded-2xl object-cover"
        />

        <ProductBadgeTag badge={product.badge} />

        {!bookingAvailable && (
          <div className="rounded-2xl bg-destructive/10 p-3 text-center">
            <p className="font-bold text-destructive">
              غير متاح للحجز اليوم
            </p>

            {bookingDaysText && (
              <p className="mt-1 text-xs text-muted-foreground">
                أيام الحجز المتاحة:{" "}
                {bookingDaysText}
              </p>
            )}
          </div>
        )}

        {addons.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold text-foreground">
              الإضافات

              {product.addons_required && (
                <span className="ms-2 text-xs font-bold text-destructive">
                  (اختر إضافة واحدة على الأقل)
                </span>
              )}
            </p>

            {addons.map((addon) => (
              <label
                key={addon.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
              >
                <Checkbox
                  checked={chosen.includes(
                    addon.id,
                  )}
                  onCheckedChange={(v) =>
                    setChosen((prev) =>
                      v
                        ? [
                            ...prev,
                            addon.id,
                          ]
                        : prev.filter(
                            (id) =>
                              id !== addon.id,
                          ),
                    )
                  }
                />

                <span className="flex-1 text-sm font-medium">
                  {addon.name}
                </span>

                <span className="text-sm text-muted-foreground">
                  +{formatPrice(addon.price)}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between rounded-2xl bg-surface p-3">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full"
              onClick={() =>
                setQuantity((q) =>
                  Math.max(1, q - 1),
                )
              }
            >
              <Minus className="size-4" />
            </Button>

            <span className="w-8 text-center font-bold">
              {quantity}
            </span>

            <Button
              size="icon"
              className="rounded-full"
              onClick={() =>
                setQuantity((q) => q + 1)
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <p className="font-bold text-primary">
            {formatPrice(unit * quantity)}
          </p>
        </div>

        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={
            !bookingAvailable ||
            (product.addons_required &&
              addons.length > 0 &&
              chosenAddons.length === 0)
          }
          onClick={() => {
            if (
              product.addons_required &&
              addons.length > 0 &&
              chosenAddons.length === 0
            ) {
              toast.error(
                "اختر إضافة واحدة على الأقل",
              );
              return;
            }

            cart.addItem({
              productId: product.id,
              name: product.name,
              unitPrice: Number(
                product.price,
              ),
              addons: chosenAddons,
              quantity,
            });

            toast.success(
              "تمت الإضافة إلى السلة",
            );

            onClose();
          }}
        >
          <ShoppingCart className="size-4" />
          أضف إلى السلة
        </Button>
      </DialogContent>
    </Dialog>
  );
}
