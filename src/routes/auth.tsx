import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول الإدارة — مِيم | MEEM" },
      { name: "description", content: "صفحة دخول خاصة بإدارة مِيم | MEEM." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "دخول الإدارة — مِيم | MEEM" },
      { property: "og:description", content: "صفحة دخول خاصة بالإدارة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function submit() {
    if (!email.trim() || password.length < 6) {
      toast.error("أدخل بريدًا صحيحًا وكلمة مرور من 6 أحرف على الأقل");
      return;
    }
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) {
        toast.error("بيانات الدخول غير صحيحة");
        return;
      }
      navigate({ to: "/admin", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + "/auth" },
      });
      setBusy(false);
      if (error) {
        toast.error("تعذّر إنشاء الحساب");
        return;
      }
      if (data.session) {
        navigate({ to: "/admin", replace: true });
      } else {
        toast.success("تم إنشاء الحساب، تحقق من بريدك لتأكيد الحساب ثم سجّل الدخول");
        setMode("login");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-soft w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-primary">لوحة التحكم</h1>
            <p className="text-sm text-muted-foreground">دخول خاص بالإدارة فقط</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button className="w-full rounded-full" size="lg" disabled={busy} onClick={submit}>
            {busy ? "جاري…" : mode === "login" ? "تسجيل الدخول" : "إنشاء حساب المديرة"}
          </Button>
          <button
            className="w-full text-sm text-muted-foreground underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "إنشاء حساب المديرة (أول مرة فقط)" : "لدي حساب — تسجيل الدخول"}
          </button>
        </div>
      </div>
    </div>
  );
}
