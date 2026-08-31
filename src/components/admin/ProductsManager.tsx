import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { useCategories, useProducts, type Product } from "@/lib/store-data";

export function ProductsManager() {
  const products = useProducts();
  const categories = useCategories(true);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

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
    };
    const { error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) {
      toast.error("تعذّر الحفظ");
      return;
    }
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

  async function remove(id: string) {
    if (!confirm("حذف هذا المنتج؟")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    refresh();
  }

  const categoryName = (id: string | null) =>
    categories.data?.find((c) => c.id === id)?.name ?? "بدون قسم";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{products.data?.length ?? 0} منتج</span>
        <Button
          className="rounded-full"
          onClick={() =>
            setEditing({ name: "", price: 0, is_available: true, sort_order: 1, description: "" })
          }
        >
          <Plus className="size-4" /> منتج جديد
        </Button>
      </div>

      <ul className="space-y-3">
        {(products.data ?? []).map((product) => (
          <li key={product.id} className="card-soft p-4">
            <div className="flex items-start gap-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="size-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {categoryName(product.category_id)} — {formatPrice(Number(product.price))}
                </p>
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
              <Button variant="ghost" size="icon" onClick={() => setEditing(product)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove(product.id)}
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
                value={editing?.category_id ?? undefined}
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
              <Label>رابط الصورة</Label>
              <Input
                dir="ltr"
                value={editing?.image_url ?? ""}
                onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
              />
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
            <Button className="w-full rounded-full" onClick={save}>
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
