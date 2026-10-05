import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import {
  PRODUCT_BADGES,
  WEEK_DAYS,
  dayLabel,
  productDays,
  productTimeIds,
  useCategories,
  useDeliveryTimes,
  useProductBookingDays,
  useProductDeliveryTimes,
  useProducts,
  type Product,
  type ProductBadge,
} from "@/lib/store-data";
import {
  BUCKET,
  IMAGE_PREFIX,
  ProductImage,
  storagePathFromUrl,
} from "@/lib/product-image";


export function ProductsManager() {
  const products = useProducts();
  const categories = useCategories(true);
  const times = useDeliveryTimes(true);
  const bookingDayRows = useProductBookingDays();
  const timeRows = useProductDeliveryTimes();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [timeIds, setTimeIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product_booking_days"] });
    qc.invalidateQueries({ queryKey: ["product_delivery_times"] });
  };

  function openEditor(product?: Product) {
    if (product) {
      setEditing(product);
      setDays(productDays(bookingDayRows.data, product.id));
      setTimeIds(productTimeIds(timeRows.data, product.id));
    } else {
      setEditing({
        name: "",
        price: 0,
        is_available: true,
        sort_order: 1,
        description: "",
        badge: "none",
        addons_required: false,
        card_stripe_primary: "green",
        card_stripe_secondary: "hidden",
      });
      setDays([]);
      setTimeIds([]);
    }
  }

  async function saveSchedule(productId: string) {
    await supabase.from("product_booking_days").delete().eq("product_id", productId);
    await supabase.from("product_delivery_times").delete().eq("product_id", productId);
    if (days.length > 0) {
      await supabase
        .from("product_booking_days")
        .insert(days.map((d) => ({ product_id: productId, day_of_week: d })));
    }
    if (timeIds.length > 0) {
      await supabase
        .from("product_delivery_times")
        .insert(timeIds.map((t) => ({ product_id: productId, delivery_time_id: t })));
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("الملف المختار ليس صورة");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 10 ميجابايت");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) {
      toast.error("تعذّر رفع الصورة");
      return;
    }
    const oldPath = storagePathFromUrl(editing?.image_url);
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    setEditing((prev) => ({ ...prev, image_url: `${IMAGE_PREFIX}${path}` }));
    toast.success("تم رفع الصورة");
  }

  async function removeImage() {
    const oldPath = storagePathFromUrl(editing?.image_url);
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    setEditing((prev) => ({ ...prev, image_url: null }));
  }


  async function save() {
    if (!editing?.name?.trim()) {
      toast.error("اسم المنتج مطلوب");
      return;
    }
    if (!editing.category_id) {
      toast.error("اختر القسم");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      price: Number(editing.price ?? 0),
      image_url: editing.image_url?.trim() || null,
      category_id: editing.category_id,
      is_available: editing.is_available ?? true,
      sort_order: Number(editing.sort_order ?? 0),
      badge: (editing.badge ?? "none") as ProductBadge,
      addons_required: editing.addons_required ?? false,
      card_stripe_primary: editing.card_stripe_primary ?? "green",
      card_stripe_secondary: editing.card_stripe_secondary ?? "beige",
    };
    const { data, error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("products").insert(payload).select("id").single();
    if (error || !data?.id) {
      toast.error("تعذّر الحفظ");
      return;
    }
    await saveSchedule(data.id);
    toast.success("تم الحفظ");
    setEditing(null);
    refresh();
  }

  async function toggleAvailable(product: Product) {
    const { error } = await supabase
      .from("products")
      .update({ is_available: !product.is_available })
      .eq("id", product.id);
    if (error) toast.error("تعذّر التحديث");
    refresh();
  }

  async function remove(product: Product) {
    if (!confirm("حذف هذا المنتج؟")) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    const path = storagePathFromUrl(product.image_url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    refresh();
  }


  const categoryName = (id: string | null) =>
    categories.data?.find((c) => c.id === id)?.name ?? "بدون قسم";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{products.data?.length ?? 0} منتج</span>
        <Button className="rounded-full" onClick={() => openEditor()}>
          <Plus className="size-4" /> منتج جديد
        </Button>
      </div>

      <ul className="space-y-3">
        {(products.data ?? []).map((product) => (
          <li key={product.id} className="card-soft p-4">
            <div className="flex items-start gap-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                <ProductImage
                  imageUrl={product.image_url}
                  alt={product.name}
                  className="size-full object-cover"
                />

              </div>
              <div className="flex-1">
                <p className="font-bold">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {categoryName(product.category_id)} — {formatPrice(Number(product.price))}
                </p>
                {product.badge && product.badge !== "none" && (
                  <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    {PRODUCT_BADGES.find((b) => b.value === product.badge)?.label}
                  </span>
                )}
                {productDays(bookingDayRows.data, product.id).length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    أيام الحجز:{" "}
                    {productDays(bookingDayRows.data, product.id)
                      .sort((a, b) => a - b)
                      .map((d) => dayLabel(d))
                      .join(" ، ")}
                  </p>
                )}
                {productTimeIds(timeRows.data, product.id).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    أوقات التسليم:{" "}
                    {productTimeIds(timeRows.data, product.id)
                      .map((id) => times.data?.find((t) => t.id === id)?.label)
                      .filter(Boolean)
                      .join(" ، ")}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => toggleAvailable(product)}
              >
                {product.is_available ? "تعطيل التوفر" : "تفعيل التوفر"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openEditor(product)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove(product)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-sm overflow-y-auto">
          <DialogHeader className="text-right">
            <DialogTitle>{editing?.id ? "تعديل المنتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input
                value={editing?.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                value={editing?.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>السعر</Label>
              <Input
                type="number"
                value={editing?.price ?? 0}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select
                value={editing?.category_id ?? ""}
                onValueChange={(v) => setEditing({ ...editing, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>صورة المنتج</Label>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleFile(file);
                }}
              />
              {editing?.image_url ? (
                <div className="relative overflow-hidden rounded-2xl bg-muted">
                  <ProductImage
                    imageUrl={editing.image_url}
                    alt="صورة المنتج"
                    className="h-40 w-full object-cover"
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-2 rounded-full"
                    onClick={removeImage}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-surface text-sm text-muted-foreground">
                  لا توجد صورة
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> جاري الرفع…
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" /> {editing?.image_url ? "تغيير الصورة" : "رفع صورة"}
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>العلامة الخاصة</Label>
              <Select
                value={editing?.badge ?? "none"}
                onValueChange={(v) => setEditing({ ...editing, badge: v as ProductBadge })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="بدون علامة" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_BADGES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-xl bg-surface p-3">
              <div>
                <Label>شريط بطاقة المنتج</Label>
                <p className="text-xs text-muted-foreground">شريط واحد فقط لكل منتج: اختاري لونه أو أخفيه.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm font-semibold">اللون</span>
                <Select
                  value={editing?.card_stripe_primary ?? "green"}
                  onValueChange={(value) => setEditing({ ...editing, card_stripe_primary: value as Product["card_stripe_primary"] })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">أخضر</SelectItem>
                    <SelectItem value="beige">بيج</SelectItem>
                    <SelectItem value="hidden">مخفي</SelectItem>
                  </SelectContent>
                </Select>
                <span
                  aria-hidden="true"
                  className={`h-8 w-2 rounded-full ${
                    editing?.card_stripe_primary === "hidden"
                      ? "bg-muted"
                      : editing?.card_stripe_primary === "beige"
                        ? "bg-schedule-beige"
                        : "bg-schedule-green"
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1 rounded-xl bg-surface p-3">
              <div className="flex items-center justify-between">
                <Label>الإضافات إجبارية</Label>
                <Switch
                  checked={editing?.addons_required ?? false}
                  onCheckedChange={(v) => setEditing({ ...editing, addons_required: v })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                عند التفعيل يجب على العميل اختيار إضافة واحدة على الأقل قبل إضافة المنتج للسلة.
              </p>
            </div>

            <div className="space-y-2 rounded-xl bg-surface p-3">
              <Label>أيام الحجز المتاحة لهذا المنتج</Label>
              <p className="text-xs text-muted-foreground">
                اتركها فارغة ليكون المنتج متاحاً كل الأيام.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {WEEK_DAYS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={days.includes(d.value)}
                      onCheckedChange={(v) =>
                        setDays((prev) =>
                          v ? [...prev, d.value] : prev.filter((x) => x !== d.value),
                        )
                      }
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-surface p-3">
              <Label>أوقات التسليم المتاحة لهذا المنتج</Label>
              <p className="text-xs text-muted-foreground">
                اتركها فارغة ليكون المنتج متاحاً في كل الأوقات.
              </p>
              {(times.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  أضف أوقات التسليم أولاً من تبويب «التسليم».
                </p>
              ) : (
                <div className="space-y-2">
                  {(times.data ?? []).map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={timeIds.includes(t.id)}
                        onCheckedChange={(v) =>
                          setTimeIds((prev) =>
                            v ? [...prev, t.id] : prev.filter((x) => x !== t.id),
                          )
                        }
                      />
                      <span className="flex-1">{t.label}</span>
                      {!t.is_active && (
                        <span className="text-xs text-muted-foreground">معطّل</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={editing?.sort_order ?? 0}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface p-3">
              <Label>متوفر</Label>
              <Switch
                checked={editing?.is_available ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, is_available: v })}
              />
            </div>
            <Button className="w-full rounded-full" disabled={uploading} onClick={save}>
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
