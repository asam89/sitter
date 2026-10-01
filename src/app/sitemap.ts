import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/site";

const PRIORITY: Record<string, number> = { "/": 1, "/team": 0.8, "/policies": 0.6 };

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: PRIORITY[path] ?? 0.4,
  }));
}
