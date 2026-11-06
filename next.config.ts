import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * Notes for whoever maintains this:
 * - `script-src 'unsafe-inline'` is required by Next.js' inline bootstrap/RSC
 *   payload scripts. It is safe to keep only because this app never renders
 *   visitor-controlled markup (no dangerouslySetInnerHTML anywhere in src/).
 *   A nonce-based CSP (see the Next.js docs) is the stronger option, but it
 *   forces every route to render dynamically, which we do not want on a
 *   fully static marketing site. Revisit if the app ever takes user content.
 * - The fonts.googleapis.com / fonts.gstatic.com entries exist only because
 *   globals.css still @imports Google Fonts. Remove them when the fonts are
 *   moved to next/font (see AUDIT.md finding F-10).
 * - connect-src allows Supabase because the waitlist form posts to the
 *   Supabase Edge Functions that back registration and email verification.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "upgrade-insecure-requests"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // `preload` is deliberately omitted: it is a near-permanent commitment that
  // also covers every subdomain. Add it only once HTTPS is confirmed everywhere.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
