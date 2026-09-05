import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, itemUnitTotal, useCart } from "@/lib/cart";
import {
  dayLabel,
  deliveryDaysFromTimes,
  isProductAvailableToday,
  productTimeIds,
  timesForDay,
  useDeliveryLocations,
  useDeliveryTimes,
  useProductBookingDays,
  useProductDeliveryTimes,
} from "@/lib/store-data";


export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب — مِيم | MEEM" },
      { name: "description", content: "أكمل بيانات طلبك من مِيم | MEEM وأرسله مباشرة." },
      { property: "og:title", content: "إتمام الطلب — مِيم | MEEM" },
      { property: "og:description", content: "أكمل بيانات طلبك وأرسله مباشرة." },
    ],
  }),
  component: CheckoutPage,
});

const schema = z.object({
  customer_name: z.string().trim().min(2, "الاسم مطلوب").max(80),
  customer_phone: z.string().trim().min(6, "رقم الجوال مطلوب").max(20),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(300).optional(),
});

function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", address: "", notes: "" });
  const [deliveryTimeId, setDeliveryTimeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [bookingDay, setBookingDay] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const times = useDeliveryTimes();
  const locations = useDeliveryLocations();
  const productBookingDays = useProductBookingDays();
  const productTimes = useProductDeliveryTimes();

  const locationOptions = locations.data ?? [];
  const productIds = useMemo(
    () => Array.from(new Set(cart.items.map((i) => i.productId))),
    [cart.items],
  );

  // أوقات التسليم المشتركة بين جميع منتجات السلة
  const timeOptions = useMemo(() => {
    let allowed = times.data ?? [];
    for (const id of productIds) {
      const own = productTimeIds(productTimes.data, id);
      if (own.length > 0) allowed = allowed.filter((t) => own.includes(t.id));
    }
    return allowed;
  }, [productIds, productTimes.data, times.data]);

  // أيام التسليم المتاحة تُستخرج من أوقات التسليم المتاحة
  const dayOptions = useMemo(() => deliveryDaysFromTimes(timeOptions), [timeOptions]);

  const dayTimeOptions = useMemo(
    () => (bookingDay === "" ? [] : timesForDay(timeOptions, Number(bookingDay))),
    [timeOptions, bookingDay],
  );

  const hasTimeRestriction = productIds.some(
    (id) => productTimeIds(productTimes.data, id).length > 0,
  );

  // منتج غير متاح للحجز اليوم
  const unavailableToday = useMemo(
    () => productIds.filter((id) => !isProductAvailableToday(productBookingDays.data, id)),
    [productIds, productBookingDays.data],
  );

  const conflict =
    cart.items.length > 0 &&
    ((hasTimeRestriction && timeOptions.length === 0) || unavailableToday.length > 0);

  useEffect(() => {
    if (bookingDay !== "" && !dayOptions.includes(Number(bookingDay))) setBookingDay("");
  }, [dayOptions, bookingDay]);

  useEffect(() => {
    if (deliveryTimeId && !dayTimeOptions.some((t) => t.id === deliveryTimeId))
      setDeliveryTimeId("");
  }, [dayTimeOptions, deliveryTimeId]);


  async function submit() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "تحقق من البيانات");
      return;
    }
    if (cart.items.length === 0) {
      toast.error("السلة فارغة");
      return;
    }
    if (conflict) {
      toast.error("بعض منتجات السلة غير متاحة اليوم أو لا تشترك في نفس أوقات التسليم");
      return;
    }
    if (dayOptions.length > 0 && !bookingDay) {
      toast.error("اختر يوم التسليم");
      return;
    }
    if (dayTimeOptions.length > 0 && !deliveryTimeId) {
      toast.error("اختر وقت التسليم");
      return;
    }
    if (locationOptions.length > 0 && !locationId) {
      toast.error("اختر مكان التسليم");
      return;
    }

    setSending(true);
    const { data, error } = await supabase.rpc("place_order", {
      _customer_name: parsed.data.customer_name,
      _customer_phone: parsed.data.customer_phone,
      _address: parsed.data.address ?? "",
      _notes: parsed.data.notes ?? "",
      _delivery_time_id: deliveryTimeId || undefined,
      _delivery_location_id: locationId || undefined,
      _booking_day: bookingDay === "" ? undefined : Number(bookingDay),

      _items: cart.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        addon_ids: item.addons.map((a) => a.id),
      })),
    });
    setSending(false);

    if (error || typeof data !== "number") {
      toast.error("تعذّر إرسال الطلب، حاول مرة أخرى");
      return;
    }
    cart.clear();
    setDone(data);
  }



  if (done !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-soft max-w-sm p-8 text-center">
          <h1 className="text-2xl font-extrabold text-primary">تم إرسال طلبك</h1>
          <p className="mt-3 text-muted-foreground">
            رقم طلبك: <span className="font-bold text-foreground">{done}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">سيتم تجهيز طلبك في أقرب وقت.</p>
          <Button className="mt-6 w-full rounded-full" onClick={() => navigate({ to: "/" })}>
            العودة للقائمة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="border-b border-border bg-card/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link to="/">
              <ArrowRight className="size-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-extrabold text-primary">إتمام الطلب</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <section className="card-soft p-4">
          <h2 className="mb-3 font-bold text-foreground">سلة الطلبات</h2>
          {cart.items.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">السلة فارغة</p>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li key={item.key} className="rounded-2xl bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      {item.addons.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          إضافات: {item.addons.map((a) => a.name).join(" ، ")}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-primary">
                        {formatPrice(itemUnitTotal(item) * item.quantity)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-destructive"
                      onClick={() => cart.remove(item.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="rounded-full"
                      onClick={() => cart.decrease(item.key)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <Button
                      size="icon"
                      className="rounded-full"
                      onClick={() => cart.increase(item.key)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="font-semibold">الإجمالي</span>
            <span className="text-lg font-bold text-primary">{formatPrice(cart.total)}</span>
          </div>
        </section>

        <section className="card-soft space-y-4 p-4">
          <h2 className="font-bold text-foreground">بيانات العميل</h2>
          <div className="space-y-2">
            <Label htmlFor="name">الاسم</Label>
            <Input
              id="name"
              value={form.customer_name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الجوال</Label>
            <Input
              id="phone"
              inputMode="tel"
              value={form.customer_phone}
              maxLength={20}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">العنوان (اختياري)</Label>
            <Input
              id="address"
              value={form.address}
              maxLength={200}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              maxLength={300}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </section>

        <section className="card-soft space-y-4 p-4">
          <h2 className="font-bold text-foreground">التسليم</h2>

          {conflict && (
            <div className="rounded-2xl bg-destructive/10 p-3 text-sm">
              <p className="font-bold text-destructive">
                {unavailableToday.length > 0
                  ? "بعض منتجات السلة غير متاحة للحجز اليوم"
                  : "منتجات السلة لا تشترك في نفس أوقات التسليم"}
              </p>
              <p className="mt-1 text-muted-foreground">
                يرجى إرسال هذه المنتجات في طلبات منفصلة، أو إزالة أحدها لإكمال الطلب.
              </p>
            </div>
          )}

          {hasTimeRestriction && !conflict && (
            <p className="text-xs text-muted-foreground">
              تظهر لك فقط أيام وأوقات التسليم المتاحة لجميع منتجات سلتك.
            </p>
          )}

          {dayOptions.length > 0 && (
            <div className="space-y-2">
              <Label>يوم التسليم</Label>
              <Select value={bookingDay} onValueChange={setBookingDay}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر يوم التسليم" />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {dayLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {bookingDay !== "" && (
            <div className="space-y-2">
              <Label>وقت التسليم</Label>
              {dayTimeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لا توجد أوقات تسليم في هذا اليوم، اختر يوماً آخر.
                </p>
              ) : (
                <Select value={deliveryTimeId} onValueChange={setDeliveryTimeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر وقت التسليم" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayTimeOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}


          {locationOptions.length > 0 && (
            <div className="space-y-2">
              <Label>مكان التسليم</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مكان التسليم" />
                </SelectTrigger>
                <SelectContent>
                  {locationOptions.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                      {l.note ? ` — ${l.note}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {timeOptions.length === 0 && dayOptions.length === 0 && locationOptions.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد خيارات تسليم متاحة حالياً.</p>
          )}

          <Button
            size="lg"
            className="w-full rounded-full"
            disabled={sending || cart.items.length === 0 || conflict}
            onClick={submit}
          >
            {sending ? "جاري الإرسال…" : "إرسال الطلب"}
          </Button>
        </section>

      </main>
    </div>
  );
}
