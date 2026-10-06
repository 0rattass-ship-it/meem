import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/product-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as Record<string, string>)["_splat"] ?? "";
        const path = decodeURIComponent(raw).replace(/^\/+/, "");

        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        if (!supabaseUrl) {
          return new Response("Storage is not configured", { status: 503 });
        }

        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        const imageResponse = await fetch(
          `${supabaseUrl}/storage/v1/object/public/product-images/${encodedPath}`,
        );

        if (!imageResponse.ok || !imageResponse.body) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(imageResponse.body, {
          headers: {
            "Content-Type": imageResponse.headers.get("content-type") || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
