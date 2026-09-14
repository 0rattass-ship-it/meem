import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, Trash2, UserRound } from "lucide-react";
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
import { CustomerLoginDialog } from "@/components/CustomerLoginDialog";
import { formatPrice, itemUnitTotal, useCart } from "@/lib/cart";
import {
  commonBookingDays,
  dayLabel,
  deliveryDaysFromTimes,
  nearestCommonDay,
  productTimeIds,
  timesForDay,
  useDeliveryLocations,
  useDeliveryTimes,
  useProductBookingDays,
  useProductDeliveryTimes,
  usePaymentSettings,
  statusLabel,
  normalizedOrderStatus,
  ORDER_STATUS_STEPS,
} from "@/lib/store-data";


export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب — مِيم | MEEM" },
      { name: "description", content: "أكمل بيانات طلبك من مِيم | MEEM وأرسله مباشرة." },
      { property: "og:title", content: "إتمام الطلب — مِيم | MEEM" },
      { property: "og:description", content: "أكمل بيانات طلبك وأرسله مباشرة." },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
    ],
  }),
  component: CheckoutPage,
});

const schema = z.object({
  customer_name: z.string().trim().min(2, "الاسم مطلوب").max(80),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(300).optional(),
});

type TrackedOrder = {
  order_number: number;
  customer_name: string;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  payment_window: string | null;
  booking_day: number | null;
  delivery_time: string | null;
  created_at: string;
};

function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customer_name: "", address: "", notes: "" });
  const [customerProfile, setCustomerProfile] = useState<{ name: string; email: string } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [deliveryTimeId, setDeliveryTimeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [sending, setSending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "pay_at_store">("bank_transfer");
  const [done, setDone] = useState<{ orderNumber: number; total: number; trackingToken: string; paymentMethod: string } | null>(null);
  const [tracking, setTracking] = useState<{ loading: boolean; data: TrackedOrder | null; error: boolean }>({ loading: false, data: null, error: false });

  const times = useDeliveryTimes();
  const locations = useDeliveryLocations();
  const productBookingDays = useProductBookingDays();
  const productTimes = useProductDeliveryTimes();
  const paymentSettings = usePaymentSettings();

  async function loadCustomerProfile() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setCustomerProfile(null);
      return;
    }
    const fallbackName = (user.user_metadata?.name as string | undefined)?.trim() || user.email?.split("@")[0] || "عميل";
    const profile = { name: fallbackName, email: user.email ?? "" };
    setCustomerProfile(profile);
    setForm((prev) => ({ ...prev, customer_name: profile.name }));
  }

  useEffect(() => {
    void loadCustomerProfile();
  }, []);

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
  const deliveryDays = useMemo(() => deliveryDaysFromTimes(timeOptions), [timeOptions]);

  // الأيام المسموحة لجميع منتجات السلة (تقاطع أيام الحجز مع أيام التسليم)
  const candidateDays = useMemo(() => {
    const booking = commonBookingDays(productBookingDays.data, productIds);
    return deliveryDays.filter((d) => booking.includes(d));
  }, [deliveryDays, productBookingDays.data, productIds]);

  // أقرب يوم قادم مشترك (يُحدد تلقائياً)
  const autoDay = useMemo(() => nearestCommonDay(candidateDays), [candidateDays]);

  const dayTimeOptions = useMemo(
    () => (autoDay === null ? [] : timesForDay(timeOptions, autoDay)),
    [timeOptions, autoDay],
  );

  const hasTimeRestriction = productIds.some(
    (id) => productTimeIds(productTimes.data, id).length > 0,
  );

  const conflict = cart.items.length > 0 && autoDay === null;

  useEffect(() => {
    if (deliveryTimeId && !dayTimeOptions.some((t) => t.id === deliveryTimeId))
      setDeliveryTimeId("");
  }, [dayTimeOptions, deliveryTimeId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNumber = Number(params.get("order"));
    const token = params.get("token") ?? "";
    const mine = params.get("mine") === "1";
    if (!Number.isInteger(orderNumber) || orderNumber <= 0 || (!mine && token.length < 32)) return;

    let cancelled = false;
    setTracking({ loading: true, data: null, error: false });
    const request = mine
      ? supabase.rpc("get_my_order_tracking", { _order_number: orderNumber })
      : supabase.rpc("get_order_tracking", { _order_number: orderNumber, _tracking_token: token });
    request.then(({ data, error }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : data;
        setTracking({ loading: false, data: error || !row ? null : (row as TrackedOrder), error: Boolean(error || !row) });
      });
    return () => { cancelled = true; };
  }, []);

  function createTrackingToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function submit() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      setLoginOpen(true);
      toast.error("سجّل الدخول بحسابك أولًا");
      return;
    }
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
      toast.error("لا يوجد يوم تسليم مشترك بين منتجات السلة");
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
    const settings = paymentSettings.data;
    if (paymentMethod === "bank_transfer" && (!settings?.account_holder_name || !settings?.account_number)) {
      toast.error("لم يتم إعداد بيانات الحساب البنكي من لوحة الإدارة بعد");
      return;
    }
    if (paymentMethod === "pay_at_store" && !settings?.payment_window) {
      toast.error("لم يتم تحديد وقت الدفع في المشرب من لوحة الإدارة بعد");
      return;
    }

    const trackingToken = createTrackingToken();
    setSending(true);
    const { data, error } = await supabase.rpc("place_order_with_payment", {
      _customer_name: parsed.data.customer_name,
      _address: parsed.data.address ?? "",
      _notes: parsed.data.notes ?? "",
      _payment_method: paymentMethod,
      _tracking_token: trackingToken,
      ...(deliveryTimeId ? { _delivery_time_id: deliveryTimeId } : {}),
      ...(locationId ? { _delivery_location_id: locationId } : {}),
      ...(autoDay === null ? {} : { _booking_day: autoDay }),
      _items: cart.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        addon_ids: item.addons.map((a) => a.id),
      })),
    });

    setSending(false);

    if (error || !data || typeof data !== "object" || !("order_number" in data)) {
      toast.error("تعذّر إرسال الطلب، حاول مرة أخرى");
      return;
    }
    const result = data as { order_number: number; total: number; payment_method: string };
    setCustomerProfile({ name: parsed.data.customer_name, email: (await supabase.auth.getUser()).data.user?.email ?? "" });
    cart.clear();
    setDone({ orderNumber: result.order_number, total: Number(result.total), trackingToken, paymentMethod: result.payment_method });
  }



  if (tracking.loading || tracking.data || tracking.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-soft max-w-sm p-8 text-center">
          {tracking.loading ? (
            <p className="text-muted-foreground">جاري تحميل حالة الطلب…</p>
          ) : tracking.data ? (
            <>
              <h1 className="text-2xl font-extrabold text-primary">متابعة طلبك</h1>
              <p className="mt-3 text-muted-foreground">
                رقم الطلب: <span className="font-bold text-foreground">{tracking.data.order_number}</span>
              </p>
              {tracking.data.status === "cancelled" ? (
                <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                  <p className="font-bold text-destructive">تم إلغاء الطلب</p>
                  <p className="mt-1 text-sm text-muted-foreground">للاستفسار، تواصل مع إدارة المشرب.</p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-surface p-4 text-right">
                  <p className="mb-4 text-sm font-bold text-primary">حالة الطلب</p>
                  <div className="space-y-3">
                    {ORDER_STATUS_STEPS.map((step, index) => {
                      const current = normalizedOrderStatus(tracking.data!.status);
                      const currentIndex = ORDER_STATUS_STEPS.findIndex((item) => item.value === current);
                      const active = index <= currentIndex;
                      const isCurrent = step.value === current;
                      return (
                        <div key={step.value} className="flex items-center gap-3">
                          <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {index + 1}
                          </div>
                          <div className={`text-sm ${isCurrent ? "font-extrabold text-primary" : active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {step.label}
                            {isCurrent && <span className="mr-2 text-xs font-normal">(الحالة الحالية)</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="mt-3 text-center text-sm font-semibold text-primary">
                الحالة الحالية: {statusLabel(tracking.data.status)}
              </p>
              <div className="mt-4 rounded-2xl bg-surface p-4 text-center text-sm">
                <p className="font-bold text-primary">📅 موعد الاستلام</p>
                <p className="mt-1 font-semibold">{dayLabel(tracking.data.booking_day) || "غير محدد"}</p>
                {tracking.data.delivery_time && (
                  <p className="mt-1 text-muted-foreground">وقت الاستلام: {tracking.data.delivery_time}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">يرجى الحضور في يوم ووقت الاستلام المحددين أعلاه.</p>
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                المبلغ: {formatPrice(Number(tracking.data.total))}
              </p>
              <Button className="mt-6 w-full rounded-full" onClick={() => navigate({ to: "/" })}>
                العودة للقائمة
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold text-primary">تعذر العثور على الطلب</h1>
              <p className="mt-2 text-sm text-muted-foreground">تأكد من استخدام رابط المتابعة الخاص بطلبك.</p>
              <Button className="mt-6 w-full rounded-full" onClick={() => navigate({ to: "/" })}>
                العودة للقائمة
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (done !== null) {
    const trackingUrl = `/checkout?order=${encodeURIComponent(done.orderNumber)}&token=${encodeURIComponent(done.trackingToken)}`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-soft max-w-sm p-8 text-center">
          <h1 className="text-2xl font-extrabold text-primary">تم إرسال طلبك</h1>
          <p className="mt-3 text-muted-foreground">
            رقم طلبك: <span className="font-bold text-foreground">{done.orderNumber}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            المبلغ: {formatPrice(done.total)}
          </p>
          {done.paymentMethod === "bank_transfer" ? (
            <div className="mt-4 rounded-2xl bg-surface p-4 text-sm">
              <p className="font-bold text-primary">تحويل بنكي</p>
              <p className="mt-1">حوّل المبلغ الموضح أعلاه إلى الحساب التالي:</p>
              <p className="mt-2 font-semibold">{paymentSettings.data?.account_holder_name}</p>
              <p dir="ltr" className="mt-1 font-bold">{paymentSettings.data?.account_number}</p>
              <p className="mt-2 text-xs text-muted-foreground">بعد التحويل يبقى الطلب بانتظار التحقق اليدوي.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-surface p-4 text-sm">
              <p className="font-bold text-primary">الدفع في المشرب</p>
              <p className="mt-1">وقت الدفع: {paymentSettings.data?.payment_window}</p>
              <p className="mt-2 text-xs text-muted-foreground">يتم الدفع في نفس يوم الحجز، خلال الأوقات الموضحة أعلاه، عند حضورك للمشرب.</p>
            </div>
          )}
          <a
            href={trackingUrl}
            className="mt-4 block rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            متابعة حالة الطلب
          </a>
          <Button variant="outline" className="mt-3 w-full rounded-full" onClick={() => navigate({ to: "/" })}>
            العودة للقائمة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CustomerLoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLoggedIn={() => void loadCustomerProfile()}
      />
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
          {customerProfile ? (
            <div className="rounded-2xl bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground">{customerProfile.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground" dir="ltr">{customerProfile.email}</p>
                </div>
                <Link to="/" className="text-sm font-semibold text-primary underline underline-offset-4">
                  تعديل
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">بيانات حسابك محفوظة، ولن تحتاج لكتابتها مرة أخرى.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-surface p-3 text-sm text-muted-foreground">
                سجّل الدخول أولًا، وسيتم استخدام اسمك المحفوظ في حسابك للطلب.
              </div>
            </>
          )}
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
          <h2 className="font-bold text-foreground">طريقة الدفع</h2>
          <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "bank_transfer" | "pay_at_store")}>
            <SelectTrigger>
              <SelectValue placeholder="اختر طريقة الدفع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
              <SelectItem value="pay_at_store">الدفع في المشرب</SelectItem>
            </SelectContent>
          </Select>

          {paymentMethod === "bank_transfer" ? (
            <div className="rounded-2xl bg-surface p-4 text-sm">
              <p className="font-bold text-primary">بيانات التحويل البنكي</p>
              {paymentSettings.isLoading ? (
                <p className="mt-2 text-muted-foreground">جاري تحميل بيانات الحساب…</p>
              ) : paymentSettings.isError ? (
                <p className="mt-2 text-muted-foreground">تعذّر تحميل بيانات الحساب حاليًا. حاول مرة أخرى.</p>
              ) : (
                <>
                  <p className="mt-2">اسم صاحب الحساب: <span className="font-semibold">{paymentSettings.data?.account_holder_name || "غير محدد"}</span></p>
                  <p className="mt-1">رقم الحساب: <span dir="ltr" className="font-semibold">{paymentSettings.data?.account_number || "غير محدد"}</span></p>
                  <p className="mt-2 font-bold text-primary">المبلغ المطلوب تحويله: {formatPrice(cart.total)}</p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface p-4 text-sm">
              <p className="font-bold text-primary">الدفع في المشرب</p>
              {paymentSettings.isLoading ? (
                <p className="mt-2 text-muted-foreground">جاري تحميل وقت الدفع…</p>
              ) : (
                <p className="mt-2">وقت الدفع: <span className="font-semibold">{paymentSettings.data?.payment_window || "غير محدد"}</span></p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">يتم الدفع في نفس يوم الحجز، خلال أوقات الدفع الموضحة أعلاه، عند حضورك للمشرب.</p>
            </div>
          )}
        </section>

        <section className="card-soft space-y-4 p-4">
          <h2 className="font-bold text-foreground">التسليم</h2>

          {conflict && (
            <div className="rounded-2xl bg-destructive/10 p-3 text-sm">
              <p className="font-bold text-destructive">
                لا يوجد يوم تسليم مشترك بين منتجات السلة
              </p>
              <p className="mt-1 text-muted-foreground">
                يرجى إرسال هذه المنتجات في طلبات منفصلة، أو إزالة أحدها لإكمال الطلب.
              </p>
            </div>
          )}

          {autoDay !== null && (
            <div className="rounded-2xl bg-surface p-3">
              <p className="font-bold text-primary">📅 موعد التسليم: {dayLabel(autoDay)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasTimeRestriction
                  ? "تم تحديد أقرب يوم متاح لجميع منتجات سلتك تلقائياً."
                  : "تم تحديد أقرب يوم تسليم متاح تلقائياً."}
              </p>
            </div>
          )}

          {autoDay !== null && (
            <div className="space-y-2">
              <Label>اختر وقت التسليم</Label>
              {dayTimeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لا توجد أوقات تسليم متاحة في هذا اليوم.
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

          {timeOptions.length === 0 && locationOptions.length === 0 && (
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
    </>
  );
}
