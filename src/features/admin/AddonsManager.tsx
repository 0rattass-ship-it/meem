import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/features/store/cart";
import { useAddons, useProductAddons, useProducts, type Addon } from "@/data/store-data";

export function AddonsManager() {
  const addons = useAddons();
  const products = useProducts();
  const links = useProductAddons();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Addon> | null>(null);
  const [linkedProducts, setLinkedProducts] = useState<string[]>([]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["addons"] });
    qc.invalidateQueries({ queryKey: ["product_addons"] });
  };

  function openEditor(addon?: Addon) {
    if (addon) {
      setEditing(addon);
      setLinkedProducts(
        (links.data ?? []).filter((l) => l.addon_id === addon.id).map((l) => l.product_id),
      );
    } else {
      setEditing({ name: "", price: 0, is_active: true });
      setLinkedProducts([]);
    }
  }

  async function save() {
    if (!editing?.name?.trim()) {
      toast.error("اسم الإضافة مطلوب");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      price: Number(editing.price ?? 0),
      is_active: editing.is_active ?? true,
    };

    let addonId = editing.id;
    if (addonId) {
      const { error } = await supabase.from("addons").update(payload).eq("id", addonId);
      if (error) {
        toast.error("تعذّر الحفظ");
        return;
      }
    } else {
      const { data, error } = await supabase.from("addons").insert(payload).select("id").single();
      if (error || !data) {
        toast.error("تعذّر الحفظ");
        return;
      }
      addonId = data.id;
    }

    await supabase.from("product_addons").delete().eq("addon_id", addonId);
    if (linkedProducts.length > 0) {
      const { error } = await supabase
        .from("product_addons")
        .insert(linkedProducts.map((pid) => ({ addon_id: addonId, product_id: pid })));
      if (error) {
        toast.error("تعذّر ربط الإضافة بالمنتجات");
        return;
      }
    }

    toast.success("تم الحفظ");
    setEditing(null);
    refresh();
  }

  async function toggleActive(addon: Addon) {
    const { error } = await supabase
      .from("addons")
      .update({ is_active: !addon.is_active })
      .eq("id", addon.id);
    if (error) toast.error("تعذّر التحديث");
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه الإضافة؟")) return;
    const { error } = await supabase.from("addons").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    refresh();
  }

  const linkedCount = (addonId: string) =>
    (links.data ?? []).filter((l) => l.addon_id === addonId).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{addons.data?.length ?? 0} إضافة</span>
        <Button className="rounded-full" onClick={() => openEditor()}>
          <Plus className="size-4" /> إضافة جديدة
        </Button>
      </div>

      <ul className="space-y-3">
        {(addons.data ?? []).map((addon) => (
          <li key={addon.id} className="card-soft p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold">{addon.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(Number(addon.price))} — مرتبطة بـ {linkedCount(addon.id)} منتج
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  addon.is_active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {addon.is_active ? "مفعّلة" : "معطّلة"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => toggleActive(addon)}
              >
                {addon.is_active ? "تعطيل" : "تفعيل"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openEditor(addon)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove(addon.id)}
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
            <DialogTitle>{editing?.id ? "تعديل الإضافة" : "إضافة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الإضافة</Label>
              <Input
                value={editing?.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>سعر الإضافة</Label>
              <Input
                type="number"
                value={editing?.price ?? 0}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface p-3">
              <Label>مفعّلة</Label>
              <Switch
                checked={editing?.is_active ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>المنتجات المرتبطة</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                {(products.data ?? []).map((product) => (
                  <label key={product.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <Checkbox
                      checked={linkedProducts.includes(product.id)}
                      onCheckedChange={(v) =>
                        setLinkedProducts((prev) =>
                          v ? [...prev, product.id] : prev.filter((id) => id !== product.id),
                        )
                      }
                    />
                    <span>{product.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full rounded-full" onClick={save}>
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
