import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Post-submit screens are per-person and already carry noindex.
      disallow: ["/success", "/verify"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
