import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function CustomerLoginDialog({
  open,
  onOpenChange,
  onLoggedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoggedIn?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("login");
      setEmail("");
      setPassword("");
      setName("");
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("أدخل بريدًا إلكترونيًا صحيحًا");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (mode === "signup" && cleanName.length < 2) {
      toast.error("الاسم مطلوب");
      return;
    }

    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        setBusy(false);
        toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        return;
      }
      // The Supabase Auth session is the source of truth. Do not block login on a separate profile table.
      if (name.trim()) {
        await supabase.auth.updateUser({ data: { name: name.trim() } });
      }
      setBusy(false);
      toast.success("تم تسجيل الدخول");
      onLoggedIn?.();
      onOpenChange(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: cleanName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message.includes("already") ? "هذا البريد مسجل بالفعل، سجّل الدخول" : "تعذر إنشاء الحساب");
      return;
    }

    if (data.user && data.session) {
      setBusy(false);
      toast.success("تم إنشاء حسابك وتسجيل الدخول");
      onLoggedIn?.();
      onOpenChange(false);
    } else {
      setBusy(false);
      setMode("login");
      toast.success("تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}</DialogTitle>
          <DialogDescription>
            سجّل دخولك مرة واحدة، وبعدها تحفظ طلباتك وبياناتك في حسابك.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="customer-login-name">الاسم</Label>
              <Input id="customer-login-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="اسمك" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="customer-login-email">البريد الإلكتروني</Label>
            <Input id="customer-login-email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-login-password">كلمة المرور</Label>
            <Input id="customer-login-password" type="password" dir="ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
          </div>
          <Button className="w-full rounded-full" disabled={busy} onClick={submit}>
            {busy ? "جاري…" : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </Button>
          <button type="button" className="w-full text-sm text-muted-foreground underline" disabled={busy} onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "ليس لدي حساب — إنشاء حساب" : "لدي حساب — تسجيل الدخول"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
