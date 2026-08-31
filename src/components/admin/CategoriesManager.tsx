import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, type Category } from "@/lib/store-data";

export function CategoriesManager() {
  const { data = [], isLoading } = useCategories(true);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });

  async function save() {
    if (!editing?.name?.trim()) {
      toast.error("اسم القسم مطلوب");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      sort_order: Number(editing.sort_order ?? 0),
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (error) {
      toast.error("تعذّر الحفظ");
      return;
    }
    toast.success("تم الحفظ");
    setEditing(null);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا القسم؟")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر الحذف");
      return;
    }
    refresh();
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{data.length} قسم</span>
        <Button
          className="rounded-full"
          onClick={() => setEditing({ name: "", sort_order: data.length + 1, is_active: true })}
        >
          <Plus className="size-4" /> قسم جديد
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground">جاري التحميل…</p>
      ) : (
        <ul className="space-y-3">
          {data.map((category) => (
            <li key={category.id} className="card-soft flex items-center gap-3 p-4">
              <div className="flex-1">
                <p className="font-bold">{category.name}</p>
                <p className="text-xs text-muted-foreground">
                  الترتيب {category.sort_order} — {category.is_active ? "مفعّل" : "معطّل"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(category)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove(category.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader className="text-right">
            <DialogTitle>{editing?.id ? "تعديل القسم" : "قسم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم القسم</Label>
              <Input
                value={editing?.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
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
              <Label>مفعّل</Label>
              <Switch
                checked={editing?.is_active ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
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
