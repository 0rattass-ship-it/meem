import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, type CartAddon } from "@/features/store/cart";
import { ORDER_STATUSES, dayLabel, normalizedOrderStatus, statusLabel } from "@/data/store-data";
import { ReceiptDetails } from "./ReceiptDetails";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  addons: CartAddon[];
};

type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  address: string | null;
  notes: string | null;
  total: number;
  status: string;
  created_at: string;
  delivery_time: string | null;
  delivery_location: string | null;
  booking_day: number | null;
  payment_method: string;
  payment_status: string;
  payment_window: string | null;
  payment_receipt_path: string | null;
  order_items: OrderItem[];
};


export function OrdersManager() {
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  async function confirmPayment(id: string) {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", id);
    if (error) {
      toast.error("تعذّر تأكيد الدفع");
      return;
    }
    toast.success("تم تأكيد الدفع والطلب");
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["admin-statistics"] });
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as never })
      .eq("id", id);
    if (error) {
      toast.error("تعذّر تحديث حالة الطلب");
      return;
    }
    toast.success("تم تحديث الحالة");
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الطلب؟")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  if (orders.isLoading) return <p className="text-center text-muted-foreground">جاري التحميل…</p>;

  const list = orders.data ?? [];
  if (list.length === 0)
    return <p className="py-10 text-center text-muted-foreground">لا توجد طلبات بعد.</p>;

  return (
    <div className="space-y-4">
      <span className="text-sm text-muted-foreground">{list.length} طلب</span>
      <ul className="space-y-3">
        {list.map((order) => (
          <li key={order.id} className="card-soft p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-primary">طلب #{order.order_number}</p>
                <p className="text-sm">{order.customer_name}</p>
                {order.address && (
                  <p className="text-xs text-muted-foreground">العنوان: {order.address}</p>
                )}
                {order.delivery_time && (
                  <p className="text-xs text-muted-foreground">
                    وقت التسليم: {order.delivery_time}
                  </p>
                )}
                {order.booking_day !== null && (
                  <p className="text-xs text-muted-foreground">
                    يوم الحجز: {dayLabel(order.booking_day)}
                  </p>
                )}
                {order.delivery_location && (
                  <p className="text-xs text-muted-foreground">
                    مكان التسليم: {order.delivery_location}
                  </p>
                )}
                {order.notes && (
                  <p className="text-xs text-muted-foreground">ملاحظات: {order.notes}</p>
                )}

                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleString("ar-EG")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  طريقة الدفع: {order.payment_method === "bank_transfer" ? "تحويل بنكي" : order.payment_method === "pay_at_store" ? "الدفع في المشرب" : "غير محددة"}
                </p>
                {order.payment_window && (
                  <p className="text-xs text-muted-foreground">وقت الدفع في المشرب: {order.payment_window}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  حالة الدفع: {order.payment_status === "paid" ? "تم الدفع" : order.payment_status === "pending_bank_transfer" ? "بانتظار التحقق من التحويل" : order.payment_status === "pending_store_payment" ? "بانتظار الدفع في المشرب" : "غير مؤكد"}
                </p>
                {order.payment_receipt_path && <ReceiptDetails path={order.payment_receipt_path} />}
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                {statusLabel(order.status)}
              </span>
            </div>

            <ul className="mt-3 space-y-2 rounded-2xl bg-surface p-3 text-sm">
              {order.order_items.map((item) => (
                <li key={item.id}>
                  <div className="flex justify-between">
                    <span>
                      {item.product_name} × {item.quantity}
                    </span>
                    <span>{formatPrice(Number(item.line_total))}</span>
                  </div>
                  {item.addons?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      إضافات: {item.addons.map((a) => a.name).join(" ، ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="font-bold text-primary">{formatPrice(Number(order.total))}</p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {order.payment_status !== "paid" && (order.payment_method === "bank_transfer" || order.payment_method === "pay_at_store") && (
                  <Button size="sm" className="rounded-full" onClick={() => confirmPayment(order.id)}>
                    تأكيد الدفع / تأكيد الطلب
                  </Button>
                )}
                <Select value={normalizedOrderStatus(order.status)} onValueChange={(v) => updateStatus(order.id, v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(order.id)}
                >
                  حذف
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
