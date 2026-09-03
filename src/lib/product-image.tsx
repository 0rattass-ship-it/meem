import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "product-images";
export const IMAGE_PREFIX = "/api/public/product-image/";

const TTL_SECONDS = 60 * 60 * 24 * 7; // signed url lifetime
const STORAGE_KEY = "product-image-urls-v1";

/** Extract the storage object path from a stored image_url value. */
export function storagePathFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const idx = url.indexOf(IMAGE_PREFIX);
  if (idx !== -1) return decodeURIComponent(url.slice(idx + IMAGE_PREFIX.length));
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return null;
  return url;
}

type Entry = { url: string; exp: number };

const memory = new Map<string, Entry>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();
    for (const [path, entry] of Object.entries(parsed)) {
      if (entry && entry.exp > now) memory.set(path, entry);
    }
  } catch {
    /* ignore */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memory)));
  } catch {
    /* ignore */
  }
}

function cached(path: string) {
  hydrate();
  const entry = memory.get(path);
  if (entry && entry.exp > Date.now()) return entry.url;
  return null;
}

// --- batching: collect all paths requested in the same tick into ONE request ---
const queue = new Set<string>();
const waiters = new Map<string, ((url: string | null) => void)[]>();
let flushScheduled = false;

async function flush() {
  flushScheduled = false;
  const paths = [...queue];
  queue.clear();
  if (paths.length === 0) return;

  const resolveAll = (map: Map<string, string | null>) => {
    for (const path of paths) {
      const url = map.get(path) ?? null;
      if (url) {
        memory.set(path, { url, exp: Date.now() + (TTL_SECONDS - 3600) * 1000 });
      }
      for (const fn of waiters.get(path) ?? []) fn(url);
      waiters.delete(path);
    }
    persist();
  };

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, TTL_SECONDS);
    if (error) throw error;
    const map = new Map<string, string | null>();
    for (const item of data ?? []) {
      const key = item.path ?? "";
      map.set(key, item.signedUrl ?? null);
    }
    resolveAll(map);
  } catch {
    resolveAll(new Map());
  }
}

function requestSignedUrl(path: string): Promise<string | null> {
  const hit = cached(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    waiters.set(path, [...(waiters.get(path) ?? []), resolve]);
    queue.add(path);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flush);
    }
  });
}

/**
 * Resolve a product image to a browser-usable URL.
 * Signed URLs are batched into a single request per tick and cached in
 * localStorage, so images appear instantly on repeat visits.
 */
export function useProductImageUrl(imageUrl: string | null | undefined) {
  const path = storagePathFromUrl(imageUrl);
  const [url, setUrl] = useState<string | null>(() => (path ? cached(path) : null));

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const hit = cached(path);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    setUrl(null);
    requestSignedUrl(path).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  if (path === null) return imageUrl ?? null;
  return url;
}

export function ProductImage({
  imageUrl,
  alt,
  className,
  fallback = null,
  loading = "eager",
}: {
  imageUrl: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  loading?: "lazy" | "eager";
}) {
  const src = useProductImageUrl(imageUrl);
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      fetchPriority={loading === "eager" ? "high" : "auto"}
    />
  );
}
