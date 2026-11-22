import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RECEIPT_BUCKET } from "@/lib/payment-receipt";

export function ReceiptDetails({ path }: { path: string }) {
  const receipt = useQuery({
    queryKey: ["order-receipt", path],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  return (
    <div className="mt-2 text-xs">
      <p className="text-muted-foreground">إيصال التحويل:</p>
      {receipt.data ? (
        <a href={receipt.data} target="_blank" rel="noopener noreferrer" aria-label="مشاهدة إيصال التحويل">
          <img src={receipt.data} alt="إيصال التحويل البنكي" className="mt-1 max-h-48 max-w-full rounded-md object-contain" />
        </a>
      ) : receipt.isError ? (
        <Button variant="ghost" size="sm" onClick={() => void receipt.refetch()}>إعادة تحميل الإيصال</Button>
      ) : <p className="text-muted-foreground">جاري تحميل الإيصال…</p>}
    </div>
  );
}