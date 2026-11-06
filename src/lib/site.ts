/**
 * Canonical origin of the waitlist site, used by metadata, robots and sitemap.
 *
 * Resolved once at build time, in this order:
 *
 *   1. NEXT_PUBLIC_SITE_URL           explicit override, wins over everything
 *   2. VERCEL_PROJECT_PRODUCTION_URL  Vercel's production domain (no protocol)
 *   3. FALLBACK_SITE_URL              last resort
 *
 * Set NEXT_PUBLIC_SITE_URL once the custom domain is live. Vercel only knows
 * the domain it issues (*.vercel.app), so without the override a project with
 * both would end up advertising the Vercel host in canonical tags.
 *
 * VERCEL_URL is deliberately not used: it is the URL of the *current*
 * deployment, so on a preview build it would point canonical tags and the
 * sitemap at a throwaway preview host.
 *
 * This module is server-only. It is imported by the root layout, robots.ts and
 * sitemap.ts — none of which ship to the browser — so reading a non-public env
 * var here is safe. Do not import it from a client component.
 */

const FALLBACK_SITE_URL = "https://waitlist.edupayafrica.com.ng";

/** Normalises "example.com/", "https://example.com/" and "https://example.com" alike. */
function normaliseOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim()) return normaliseOrigin(explicit);

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProduction && vercelProduction.trim()) return normaliseOrigin(vercelProduction);

  return FALLBACK_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();

/** Optional official EduPay WhatsApp Channel. */
export const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbByeNR47XeEqQcE803V";
