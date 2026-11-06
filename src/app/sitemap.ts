import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * /success and /verify are deliberately absent: they are per-person screens
 * that are also marked noindex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 }
  ];
}
