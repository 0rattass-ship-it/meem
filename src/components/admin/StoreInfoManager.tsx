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
  const [bookingInstruction, setBookingInstruction] = useState("");
  const [deliveryInstruction, setDeliveryInstruction] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (info.data !== undefined) {
      setContent(info.data.content);
      setBookingInstruction(info.data.booking_instruction);
      setDeliveryInstruction(info.data.delivery_instruction);
    }
  }, [info.data]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("store_information")
      .upsert({
        id: 1,
        content: content.slice(0, 5000),
        booking_instruction: bookingInstruction.slice(0, 1000),
        delivery_instruction: deliveryInstruction.slice(0, 1000),
        updated_at: new Date().toISOString(),
      });
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
        <h2 className="text-lg font-bold text-primary">التعليمات والملاحظات</h2>
        <p className="text-sm text-muted-foreground">
          النصان الأولان يظهران للعملاء عند الضغط على زر «التعليمات» أعلى المتجر.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">تعليمات الحجز</label>
        <Textarea
          rows={3}
          value={bookingInstruction}
          onChange={(e) => setBookingInstruction(e.target.value)}
          placeholder="مثال: الحجز يومي السبت والثلاثاء"
          disabled={info.isLoading}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">تعليمات التسليم</label>
        <Textarea
          rows={3}
          value={deliveryInstruction}
          onChange={(e) => setDeliveryInstruction(e.target.value)}
          placeholder="مثال: التسليم يومي الإثنين والخميس"
          disabled={info.isLoading}
        />
      </div>
      <div className="space-y-2 border-t border-border pt-4">
        <label className="text-sm font-semibold text-foreground">ملاحظات إضافية</label>
      <Textarea
        rows={6}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="أي ملاحظات إضافية للمتجر…"
        disabled={info.isLoading}
      />
      </div>
      <Button className="w-full rounded-full" onClick={save} disabled={saving || info.isLoading}>
        {saving ? "جاري الحفظ…" : "حفظ"}
      </Button>
    </div>
  );
}
