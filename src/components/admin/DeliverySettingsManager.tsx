import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  type DeliveryLocation,
  type DeliveryTime,
} from "@/lib/store-data";


export function DeliverySettingsManager() {
  const qc = useQueryClient();
  const times = useDeliveryTimes(true);
  const locations = useDeliveryLocations(true);

  const [editTime, setEditTime] = useState<Partial<DeliveryTime> | null>(null);
  const [editLocation, setEditLocation] = useState<Partial<DeliveryLocation> | null>(null);

  const refreshTimes = () => qc.invalidateQueries({ queryKey: ["delivery_times"] });
  const refreshLocations = () => qc.invalidateQueries({ queryKey: ["delivery_locations"] });

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
