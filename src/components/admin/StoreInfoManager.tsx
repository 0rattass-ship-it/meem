import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useStoreInformation } from "@/lib/store-data";

export function StoreInfoManager() {
  const info = useStoreInformation();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (info.data !== undefined) setContent(info.data);
  }, [info.data]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("store_information")
      .upsert({ id: 1, content: content.slice(0, 5000), updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error("تعذّر حفظ المعلومات");
      return;
    }
    toast.success("تم حفظ المعلومات");
    void qc.invalidateQueries({ queryKey: ["store-information"] });
  }

  return (
    <div className="card-soft space-y-4 p-5">
      <div>
        <h2 className="text-lg font-bold text-primary">المعلومات والملاحظات</h2>
        <p className="text-sm text-muted-foreground">
          هذا النص يظهر للعملاء عند الضغط على زر «المعلومات» في أعلى المتجر.
        </p>
      </div>
      <Textarea
        rows={12}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="اكتب هنا أوقات العمل، طريقة الطلب، أي ملاحظات للعملاء…"
        disabled={info.isLoading}
      />
      <Button className="w-full rounded-full" onClick={save} disabled={saving || info.isLoading}>
        {saving ? "جاري الحفظ…" : "حفظ"}
      </Button>
    </div>
  );
}
