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
  const [greenBookingInstruction, setGreenBookingInstruction] = useState("");
  const [greenDeliveryInstruction, setGreenDeliveryInstruction] = useState("");
  const [beigeBookingInstruction, setBeigeBookingInstruction] = useState("");
  const [beigeDeliveryInstruction, setBeigeDeliveryInstruction] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (info.data !== undefined) {
      setContent(info.data.content);
      setGreenBookingInstruction(info.data.green_booking_instruction);
      setGreenDeliveryInstruction(info.data.green_delivery_instruction);
      setBeigeBookingInstruction(info.data.beige_booking_instruction);
      setBeigeDeliveryInstruction(info.data.beige_delivery_instruction);
    }
  }, [info.data]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("store_information")
      .upsert({
        id: 1,
        content: content.slice(0, 5000),
        green_booking_instruction: greenBookingInstruction.slice(0, 1000),
        green_delivery_instruction: greenDeliveryInstruction.slice(0, 1000),
        beige_booking_instruction: beigeBookingInstruction.slice(0, 1000),
        beige_delivery_instruction: beigeDeliveryInstruction.slice(0, 1000),
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
          مواعيد كل شريط تظهر للعملاء عند الضغط على زر «التعليمات» أعلى المتجر.
        </p>
      </div>
      <div className="space-y-4 border-r-4 border-schedule-green pr-4">
        <h3 className="font-bold text-foreground">الشريط الأخضر</h3>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">موعد الحجز</label>
          <Textarea rows={2} value={greenBookingInstruction} onChange={(e) => setGreenBookingInstruction(e.target.value)} placeholder="مثال: الحجز يوم السبت والثلاثاء" disabled={info.isLoading} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">موعد التسليم</label>
          <Textarea rows={2} value={greenDeliveryInstruction} onChange={(e) => setGreenDeliveryInstruction(e.target.value)} placeholder="مثال: التسليم يوم الاثنين والخميس" disabled={info.isLoading} />
        </div>
      </div>
      <div className="space-y-4 border-r-4 border-schedule-beige pr-4">
        <h3 className="font-bold text-foreground">الشريط البيج</h3>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">موعد الحجز</label>
          <Textarea rows={2} value={beigeBookingInstruction} onChange={(e) => setBeigeBookingInstruction(e.target.value)} placeholder="مثال: الحجز يوم الأحد والأربعاء" disabled={info.isLoading} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">موعد التسليم</label>
          <Textarea rows={2} value={beigeDeliveryInstruction} onChange={(e) => setBeigeDeliveryInstruction(e.target.value)} placeholder="مثال: التسليم يوم الاثنين والخميس" disabled={info.isLoading} />
        </div>
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
