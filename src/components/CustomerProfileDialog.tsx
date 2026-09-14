import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function CustomerProfileDialog({
  open,
  onOpenChange,
  initialName,
  email,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  email: string;
  onSaved?: (profile: { name: string; email: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("الاسم مطلوب");
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      toast.error("سجّل الدخول أولًا");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { name: trimmed } });
    setBusy(false);
    if (error) {
      toast.error("تعذر حفظ الاسم");
      return;
    }
    onSaved?.({ name: trimmed, email });
    onOpenChange(false);
    toast.success("تم حفظ بياناتك");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>بياناتي</DialogTitle>
          <DialogDescription>عدّل اسمك من هنا. البريد الإلكتروني مرتبط بحسابك.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-profile-name">الاسم</Label>
            <Input id="customer-profile-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-profile-email">البريد الإلكتروني</Label>
            <Input id="customer-profile-email" type="email" dir="ltr" value={email} disabled />
          </div>
          <Button className="w-full rounded-full" disabled={busy} onClick={save}>{busy ? "جاري الحفظ…" : "حفظ البيانات"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
