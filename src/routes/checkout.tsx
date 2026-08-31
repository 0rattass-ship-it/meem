import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, itemUnitTotal, useCart } from "@/lib/cart";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب — بوفيه قمة الجبل" },
      { name: "description", content: "أكمل بيانات طلبك من بوفيه قمة الجبل وأرسله مباشرة." },
      { property: "og:title", content: "إتمام الطلب — بوفيه قمة الجبل" },
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
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<number | null>(null);

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
    setSending(true);
    const { data, error } = await supabase.rpc("place_order", {
      _customer_name: parsed.data.customer_name,
      _customer_phone: parsed.data.customer_phone,
      _address: parsed.data.address ?? null,
      _notes: parsed.data.notes ?? null,
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
          <Button
            size="lg"
            className="w-full rounded-full"
            disabled={sending || cart.items.length === 0}
            onClick={submit}
          >
            {sending ? "جاري الإرسال…" : "إرسال الطلب"}
          </Button>
        </section>
      </main>
    </div>
  );
}
