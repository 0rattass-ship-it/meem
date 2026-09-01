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
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { useCategories, useProducts, type Product } from "@/lib/store-data";
import {
  BUCKET,
  IMAGE_PREFIX,
  ProductImage,
  storagePathFromUrl,
} from "@/lib/product-image";


export function ProductsManager() {
  const products = useProducts();
  const categories = useCategories(true);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

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
                  <img
                    src={editing.image_url}
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
