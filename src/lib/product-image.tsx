import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "product-images";
export const IMAGE_PREFIX = "/api/public/product-image/";

/** Extract the storage object path from a stored image_url value. */
export function storagePathFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const idx = url.indexOf(IMAGE_PREFIX);
  if (idx !== -1) return decodeURIComponent(url.slice(idx + IMAGE_PREFIX.length));
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return null;
  return url;
}

/**
 * Resolve a product image to a browser-usable URL.
 * Images stored in the (private) storage bucket are resolved to a signed URL
 * from the browser, so they work on any host without a server proxy.
 */
export function useProductImageUrl(imageUrl: string | null | undefined) {
  const path = storagePathFromUrl(imageUrl);
  const query = useQuery({
    queryKey: ["product-image", path],
    enabled: path !== null,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 12,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path as string, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (path === null) return imageUrl ?? null;
  return query.data ?? null;
}

export function ProductImage({
  imageUrl,
  alt,
  className,
  fallback = null,
  loading,
}: {
  imageUrl: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  loading?: "lazy" | "eager";
}) {
  const src = useProductImageUrl(imageUrl);
  if (!src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} loading={loading} />;
}
