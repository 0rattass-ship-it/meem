import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Store,
  UtensilsCrossed,
  ShoppingCart,
  Plus,
  Minus,
  BadgeCheck,
  CalendarClock,
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
import { useCart, formatPrice, type CartAddon } from "@/lib/cart";
import { ProductImage } from "@/lib/product-image";

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
} from "@/lib/store-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مِيم | MEEM — اطلب وجبتك الآن" },
      {
        name: "description",
        content: "قائمة مِيم | MEEM: وجبات سريعة، ساندويتشات، عصائر وحلويات. اختر طلبك وأرسله مباشرة.",
      },
      { property: "og:title", content: "مِيم | MEEM — اطلب وجبتك الآن" },
      {
        property: "og:description",
        content: "قائمة مِيم | MEEM: وجبات سريعة، ساندويتشات، عصائر وحلويات.",
      },
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

  const availableToday = (productId: string) =>
    isProductAvailableToday(bookingDays.data, productId);
  const daysText = (productId: string) =>
    productDays(bookingDays.data, productId)
      .sort((a, b) => a - b)
      .map((d) => dayLabel(d))
      .join(" ، ");


  const visibleCategories = useMemo(() => {
    const list = categories.data ?? [];
    return activeCategory ? list.filter((c) => c.id === activeCategory) : list;
  }, [categories.data, activeCategory]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products.data ?? []) {
      if (!p.category_id) continue;
      map.set(p.category_id, [...(map.get(p.category_id) ?? []), p]);
    }
    return map;
  }, [products.data]);

  const addonsForProduct = (productId: string): CartAddon[] => {
    const ids = (productAddons.data ?? [])
      .filter((pa) => pa.product_id === productId)
      .map((pa) => pa.addon_id);
    return (addons.data ?? [])
      .filter((a) => a.is_active && ids.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) }));
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
            <Store className="size-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-primary">مِيم | MEEM</h1>
            <p className="text-sm text-muted-foreground">اختر طلبك وأرسله مباشرة</p>
          </div>
          <InstallAppButton />
        </div>
      </header>

      <nav className="border-b border-border bg-surface">
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
          <p className="py-16 text-center text-muted-foreground">جاري تحميل القائمة…</p>
        ) : visibleCategories.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">لا توجد أقسام بعد.</p>
        ) : (
          visibleCategories.map((category) => {
            const list = productsByCategory.get(category.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={category.id} className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-primary">
                  <UtensilsCrossed className="size-5" />
                  {category.name}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {list.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      hasAddons={addonsForProduct(product.id).length > 0}
                      onOpen={() => setSelected(product)}

                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">إجمالي السلة ({cart.count} عنصر)</p>
              <p className="text-lg font-bold text-primary">{formatPrice(cart.total)}</p>
            </div>
            <Button asChild size="lg" className="rounded-full">
              <Link to="/checkout">
                <ShoppingCart className="size-4" />
                إتمام الطلب
              </Link>
            </Button>
          </div>
        </div>
      )}

      <ProductDialog
        product={selected}
        addons={selected ? addonsForProduct(selected.id) : []}
        bookingAvailable={selected ? availableToday(selected.id) : true}
        bookingDaysText={selected ? daysText(selected.id) : ""}
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
      {always ? <BadgeCheck className="size-3.5" /> : <CalendarClock className="size-3.5" />}
      {always ? "متوفر دائماً" : "بالحجز"}
    </span>
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
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-secondary-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
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
    <div className="card-soft flex flex-col overflow-hidden p-3">
      <button
        onClick={onOpen}
        className="relative mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-muted"
      >
        <ProductBadgeTag badge={product.badge} className="absolute right-2 top-2" />
        <ProductImage
          imageUrl={product.image_url}
          alt={product.name}
          loading="eager"
          className="size-full object-cover"
          fallback={<UtensilsCrossed className="size-10 text-brand-soft" />}
        />

      </button>
      <button onClick={onOpen} className="text-center">
        <h3 className="font-bold text-foreground">{product.name}</h3>
        <p className="text-sm text-muted-foreground">{formatPrice(Number(product.price))}</p>
      </button>
      {!product.is_available ? (
        <p className="mt-3 rounded-full bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">
          غير متوفر حالياً
        </p>
      ) : (

        <div className="mt-3">
          <Button onClick={onOpen} className="w-full rounded-full" size="sm">
            <Plus className="size-4" />
            {hasAddons ? "اختيار الإضافات" : "إضافة للسلة"}
            {inCart > 0 ? ` (${inCart})` : ""}
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

  const chosenAddons = addons.filter((a) => chosen.includes(a.id));
  const unit = Number(product.price) + chosenAddons.reduce((s, a) => s + a.price, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-primary">{product.name}</DialogTitle>
          <DialogDescription>{product.description || "اختر الكمية والإضافات"}</DialogDescription>
        </DialogHeader>

        <ProductImage
          imageUrl={product.image_url}
          alt={product.name}
          className="h-40 w-full rounded-2xl object-cover"
        />
        <ProductBadgeTag badge={product.badge} />

        {!bookingAvailable && (
          <div className="rounded-2xl bg-destructive/10 p-3 text-center">
            <p className="font-bold text-destructive">غير متاح للحجز اليوم</p>
            {bookingDaysText && (
              <p className="mt-1 text-xs text-muted-foreground">
                أيام الحجز المتاحة: {bookingDaysText}
              </p>
            )}
          </div>
        )}




        {addons.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold text-foreground">الإضافات</p>
            {addons.map((addon) => (
              <label
                key={addon.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
              >
                <Checkbox
                  checked={chosen.includes(addon.id)}
                  onCheckedChange={(v) =>
                    setChosen((prev) =>
                      v ? [...prev, addon.id] : prev.filter((id) => id !== addon.id),
                    )
                  }
                />
                <span className="flex-1 text-sm font-medium">{addon.name}</span>
                <span className="text-sm text-muted-foreground">+{formatPrice(addon.price)}</span>
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
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-8 text-center font-bold">{quantity}</span>
            <Button
              size="icon"
              className="rounded-full"
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <p className="font-bold text-primary">{formatPrice(unit * quantity)}</p>
        </div>

        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={!bookingAvailable}
          onClick={() => {
            cart.addItem({
              productId: product.id,
              name: product.name,
              unitPrice: Number(product.price),
              addons: chosenAddons,
              quantity,
            });
            toast.success("تمت الإضافة إلى السلة");
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
