import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  WEEK_DAYS,
  dayLabel,
  useDeliveryLocations,
  useDeliveryTimes,
  usePaymentSettings,
  type DeliveryLocation,
  type DeliveryTime,
} from "@/lib/store-data";


export function DeliverySettingsManager() {
  const qc = useQueryClient();
  const times = useDeliveryTimes(true);
  const locations = useDeliveryLocations(true);
  const paymentSettings = usePaymentSettings();

  const [editTime, setEditTime] = useState<Partial<DeliveryTime> | null>(null);
  const [editLocation, setEditLocation] = useState<Partial<DeliveryLocation> | null>(null);
  const [paymentForm, setPaymentForm] = useState({ account_holder_name: "", account_number: "", payment_window: "" });

  useEffect(() => {
    if (paymentSettings.data) setPaymentForm(paymentSettings.data);
  }, [paymentSettings.data]);

  const refreshTimes = () => qc.invalidateQueries({ queryKey: ["delivery_times"] });
  const refreshLocations = () => qc.invalidateQueries({ queryKey: ["delivery_locations"] });

  async function savePaymentSettings() {
    const accountHolder = paymentForm.account_holder_name.trim();
    const accountNumber = paymentForm.account_number.trim();
    const paymentWindow = paymentForm.payment_window.trim();
    if (!accountHolder || !accountNumber || !paymentWindow) {
      toast.error("أكمل اسم صاحب الحساب ورقم الحساب ووقت الدفع في المشرب");
      return;
    }
    const { error } = await supabase
      .from("payment_settings")
      .update({
        account_holder_name: accountHolder,
        account_number: accountNumber,
        payment_window: paymentWindow,
      })
      .eq("id", 1);
    if (error) {
      toast.error("تعذّر حفظ إعدادات الدفع");
      return;
    }
    toast.success("تم حفظ إعدادات الدفع");
    qc.invalidateQueries({ queryKey: ["payment-settings"] });
  }

  async function saveTime() {
    const label = editTime?.label?.trim();
    if (!label) {
      toast.error("اكتبي وقت التسليم");
      return;
    }
    const payload = {
      label,
      day_of_week:
        editTime?.day_of_week === null || editTime?.day_of_week === undefined
          ? null
          : Number(editTime.day_of_week),
      sort_order: Number(editTime?.sort_order ?? 0),

      is_active: editTime?.is_active ?? true,
    };
    const { error } = editTime?.id
      ? await supabase.from("delivery_times").update(payload).eq("id", editTime.id)
      : await supabase.from("delivery_times").insert(payload);
    if (error) {
      toast.error("تعذّر الحفظ");
      return;
    }
    toast.success("تم الحفظ");
    setEditTime(null);
    refreshTimes();
  }

  async function toggleTime(item: DeliveryTime) {
    const { error } = await supabase
      .from("delivery_times")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error("تعذّر التحديث");
    refreshTimes();
  }

  async function removeTime(id: string) {
    if (!confirm("حذف هذا الوقت؟")) return;
    const { error } = await supabase.from("delivery_times").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    refreshTimes();
  }

  async function saveLocation() {
    const name = editLocation?.name?.trim();
    if (!name) {
      toast.error("اكتبي مكان التسليم");
      return;
    }
    const payload = {
      name,
      note: editLocation?.note?.trim() || null,
      sort_order: Number(editLocation?.sort_order ?? 0),
      is_active: editLocation?.is_active ?? true,
    };
    const { error } = editLocation?.id
      ? await supabase.from("delivery_locations").update(payload).eq("id", editLocation.id)
      : await supabase.from("delivery_locations").insert(payload);
    if (error) {
      toast.error("تعذّر الحفظ");
      return;
    }
    toast.success("تم الحفظ");
    setEditLocation(null);
    refreshLocations();
  }

  async function toggleLocation(item: DeliveryLocation) {
    const { error } = await supabase
      .from("delivery_locations")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error("تعذّر التحديث");
    refreshLocations();
  }

  async function removeLocation(id: string) {
    if (!confirm("حذف هذا المكان؟")) return;
    const { error } = await supabase.from("delivery_locations").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    refreshLocations();
  }

  return (
    <div className="space-y-6">
      <section className="card-soft space-y-4 p-4">
        <div>
          <h2 className="font-bold text-primary">إعدادات الدفع</h2>
          <p className="mt-1 text-xs text-muted-foreground">بيانات التحويل البنكي ووقت الدفع في المشرب التي تظهر للعميل.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment-account-holder">اسم صاحب الحساب</Label>
          <Input
            id="payment-account-holder"
            value={paymentForm.account_holder_name}
            maxLength={120}
            onChange={(e) => setPaymentForm({ ...paymentForm, account_holder_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment-account-number">رقم الحساب</Label>
          <Input
            id="payment-account-number"
            dir="ltr"
            value={paymentForm.account_number}
            maxLength={80}
            onChange={(e) => setPaymentForm({ ...paymentForm, account_number: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment-window">وقت الدفع في المشرب</Label>
          <Input
            id="payment-window"
            value={paymentForm.payment_window}
            maxLength={100}
            placeholder="مثال: 5:00 م – 8:00 م"
            onChange={(e) => setPaymentForm({ ...paymentForm, payment_window: e.target.value })}
          />
        </div>
        <Button className="w-full rounded-full" onClick={savePaymentSettings} disabled={paymentSettings.isLoading}>
          حفظ إعدادات الدفع
        </Button>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-primary">
            <Clock className="size-4" /> أوقات التسليم
          </h2>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() =>
              setEditTime({ label: "", day_of_week: null, sort_order: 0, is_active: true })
            }

          >
            <Plus className="size-4" /> وقت جديد
          </Button>
        </div>
        {(times.data ?? []).length === 0 && (
          <p className="card-soft p-4 text-center text-sm text-muted-foreground">
            لا توجد أوقات تسليم بعد.
          </p>
        )}
        <ul className="space-y-2">
          {(times.data ?? []).map((item) => (
            <li key={item.id} className="card-soft flex items-center gap-2 p-3">
              <div className="flex-1">
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {item.day_of_week === null || item.day_of_week === undefined
                    ? "كل الأيام"
                    : `يوم ${dayLabel(item.day_of_week)}`}
                  {" — "}
                  {item.is_active ? "يظهر للعميل" : "مخفي"}
                </p>

              </div>
              <Switch checked={item.is_active} onCheckedChange={() => toggleTime(item)} />
              <Button variant="ghost" size="icon" onClick={() => setEditTime(item)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeTime(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-primary">أيام الحجز</h2>
        <p className="card-soft p-3 text-sm text-muted-foreground">
          أيام الحجز وأوقات التسليم تُحدَّد لكل منتج على حدة من تبويب «المنتجات» عند إضافة أو تعديل
          المنتج.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-primary">
            <MapPin className="size-4" /> أماكن التسليم
          </h2>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => setEditLocation({ name: "", note: "", sort_order: 0, is_active: true })}
          >
            <Plus className="size-4" /> مكان جديد
          </Button>
        </div>
        {(locations.data ?? []).length === 0 && (
          <p className="card-soft p-4 text-center text-sm text-muted-foreground">
            لا توجد أماكن تسليم بعد.
          </p>
        )}
        <ul className="space-y-2">
          {(locations.data ?? []).map((item) => (
            <li key={item.id} className="card-soft flex items-center gap-2 p-3">
              <div className="flex-1">
                <p className="font-semibold">{item.name}</p>
                {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
              </div>
              <Switch checked={item.is_active} onCheckedChange={() => toggleLocation(item)} />
              <Button variant="ghost" size="icon" onClick={() => setEditLocation(item)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeLocation(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={editTime !== null} onOpenChange={(v) => !v && setEditTime(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader className="text-right">
            <DialogTitle>{editTime?.id ? "تعديل الوقت" : "وقت تسليم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الوقت كما يظهر للعميل</Label>
              <Input
                placeholder="مثال: 5:00 مساءً"
                value={editTime?.label ?? ""}
                onChange={(e) => setEditTime({ ...editTime, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>يوم التسليم</Label>
              <Select
                value={
                  editTime?.day_of_week === null || editTime?.day_of_week === undefined
                    ? "all"
                    : String(editTime.day_of_week)
                }
                onValueChange={(v) =>
                  setEditTime({ ...editTime, day_of_week: v === "all" ? null : Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختاري اليوم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأيام</SelectItem>
                  {WEEK_DAYS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                يظهر هذا الوقت للعميل بعد اختياره ليوم التسليم.
              </p>
            </div>

            <div className="space-y-2">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={editTime?.sort_order ?? 0}
                onChange={(e) => setEditTime({ ...editTime, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface p-3">
              <Label>مفعّل</Label>
              <Switch
                checked={editTime?.is_active ?? true}
                onCheckedChange={(v) => setEditTime({ ...editTime, is_active: v })}
              />
            </div>
            <Button className="w-full rounded-full" onClick={saveTime}>
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editLocation !== null} onOpenChange={(v) => !v && setEditLocation(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader className="text-right">
            <DialogTitle>{editLocation?.id ? "تعديل المكان" : "مكان تسليم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المكان</Label>
              <Input
                placeholder="مثال: أمام المسجد الكبير"
                value={editLocation?.name ?? ""}
                onChange={(e) => setEditLocation({ ...editLocation, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Input
                value={editLocation?.note ?? ""}
                onChange={(e) => setEditLocation({ ...editLocation, note: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={editLocation?.sort_order ?? 0}
                onChange={(e) =>
                  setEditLocation({ ...editLocation, sort_order: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface p-3">
              <Label>مفعّل</Label>
              <Switch
                checked={editLocation?.is_active ?? true}
                onCheckedChange={(v) => setEditLocation({ ...editLocation, is_active: v })}
              />
            </div>
            <Button className="w-full rounded-full" onClick={saveLocation}>
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
