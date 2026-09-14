import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/parent",
          "/sitter",
          "/bookings",
          "/api",
          "/reset-password",
          "/forgot-password",
          "/unsubscribe",
          "/newsletter/confirm",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
