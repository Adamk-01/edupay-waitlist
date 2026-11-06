// EduPay waitlist API — Supabase Edge Function (Deno).
//
// Public routes (verify_jwt = false; abuse is controlled by validation,
// rate limiting and generic responses, not by a client secret):
//
//   POST /waitlist  { action: "register", ...fields }  -> create / re-confirm a signup
//   POST /waitlist  { action: "verify",   token }      -> consume a verification token
//   POST /waitlist  { action: "resend",   email }      -> send a fresh verification email
//
// Required secrets (Supabase Dashboard -> Edge Functions -> Secrets):
//   WAITLIST_SITE_URL        e.g. https://waitlist.edupayafrica.com.ng
//   WAITLIST_ALLOWED_ORIGINS comma-separated CORS allowlist; supports "*" patterns
//   WAITLIST_NOTICE_VERSION  privacy notice version recorded with each consent
//   WAITLIST_FROM_EMAIL      verified sender, e.g. "EduPay <no-reply@edupayafrica.com.ng>"
//   WAITLIST_NOTIFY_EMAIL    team inbox that receives every new signup
//   RESEND_API_KEY           email provider key
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Design rules enforced here:
//   - No customer account, wallet or payment record is ever created.
//   - Only a SHA-256 hash of a verification token is stored.
//   - Duplicate and unknown emails return the SAME response: no enumeration.
//   - Internal errors are logged server-side and never returned to visitors.
//
// IMPORTANT — this file has no imports on purpose.
//
// An earlier version imported "jsr:@supabase/supabase-js@2". That module could
// not be resolved at cold start, so the function never booted: every request
// returned {"code":"BOOT_ERROR"} before any handler ran. The failure looks
// exactly like a CORS problem from the browser, which is why it was hard to
// spot. Everything here talks to PostgREST and the mail provider over plain
// fetch() instead. Please do not reintroduce an import: if this function needs
// a new capability, prefer web-standard APIs already present in Deno.
//
// To verify a deployment is healthy, open the function URL in a browser tab.
// A working function answers {"error":"method_not_allowed"}. Anything else,
// and in particular BOOT_ERROR, means the code did not start.

const AUDIENCES = ["student", "parent_guardian", "institution"] as const;
const EDUCATION_LEVELS = ["Primary", "Secondary school", "Undergraduate", "Postgraduate", "Other"] as const;
const INSTITUTION_TYPES = [
  "School",
  "College / Polytechnic",
  "University",
  "Education agency",
  "Other"
] as const;

const TOKEN_TTL_MINUTES = 60 * 24; // 24 hours
const RESEND_COOLDOWN_MINUTES = 10;
const REGISTER_MAX_PER_IP_PER_HOUR = 5;
const REGISTER_MAX_PER_EMAIL_PER_HOUR = 3;
const RESEND_MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_BODY_BYTES = 8 * 1024;

// How long a browser may cache a preflight response. Deliberately short: a
// stale "allowed" decision used to stick for a full day and made configuration
// changes look like they had not been applied.
const CORS_MAX_AGE_SECONDS = 600;

type Audience = (typeof AUDIENCES)[number];
type Row = Record<string, unknown>;

// ----------------------------------------------------------------- utilities

/**
 * Encodes a value for use in a PostgREST query string.
 *
 * PostgREST parses its query string against the database, so this must be
 * airtight: a value that reaches it unescaped could be read as structure
 * rather than data. encodeURIComponent alone is not enough — it leaves
 * ! ' ( ) * intact, and all of those carry meaning to PostgREST (for example
 * "in.(a,b)" or "like.*foo*"). They are escaped explicitly here, leaving the
 * RFC 3986 unreserved set as the only characters passed through verbatim.
 */
function enc(value: unknown): string {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Matches an origin against one allowlist entry.
 *
 * An entry with no "*" must match byte for byte. An entry containing "*" is a
 * pattern, which exists so generated deployment origins do not have to be
 * listed one by one:
 *
 *   https://edupay-waitlist.vercel.app    exact production origin
 *   https://edupay-waitlist-*.vercel.app  every Vercel preview for this project
 *
 * Keep patterns as narrow as you can. "https://*.vercel.app" would allow any
 * Vercel customer's site, so scope the wildcard to this project's name.
 */
function matchesOrigin(origin: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === origin;

  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(origin);
}

function allowList(): string[] {
  return (Deno.env.get("WAITLIST_ALLOWED_ORIGINS") ?? Deno.env.get("WAITLIST_SITE_URL") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Resolves the value to send back in Access-Control-Allow-Origin.
 *
 * Only a concrete origin can be reflected, never the pattern that matched it,
 * so an unrecognised origin falls back to the first exact entry. "Vary: Origin"
 * is set on every response, which is what stops a shared cache from serving
 * one origin's header to another.
 */
function resolveAllowedOrigin(origin: string | null, list: string[]): string {
  if (origin && list.some((pattern) => matchesOrigin(origin, pattern))) return origin;
  return list.find((pattern) => !pattern.includes("*")) ?? "";
}

function baseHeaders(origin: string | null): Record<string, string> {
  const list = allowList();
  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(origin, list),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": String(CORS_MAX_AGE_SECONDS),
    Vary: "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders(origin) });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

function optionalText(value: unknown, max: number): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return "invalid";
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

/** Accepts 0803…, +234803…, 234803… and other +country-code forms. */
function normalizePhone(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const compact = value.replace(/[\s().-]/g, "");
  if (/^0[789]\d{9}$/.test(compact)) return `+234${compact.slice(1)}`;
  if (/^234[789]\d{9}$/.test(compact)) return `+${compact}`;
  if (/^\+234[789]\d{9}$/.test(compact)) return compact;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return "invalid";
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function siteUrl(): string {
  return (Deno.env.get("WAITLIST_SITE_URL") ?? "https://waitlist.edupayafrica.com.ng").replace(/\/+$/, "");
}

// -------------------------------------------------------- database access

/**
 * Result of a PostgREST call.
 *
 * `count` is only populated for HEAD requests made with Prefer: count=exact.
 * `rows` is null when the server returned no body (204 from PATCH/DELETE).
 * `code` carries a Postgres SQLSTATE such as "23505" for a unique violation.
 */
interface RestResult {
  status: number;
  ok: boolean;
  count: number | null;
  rows: Row[] | null;
  code: string | null;
}

function serviceKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function restUrl(path: string): string {
  return `${Deno.env.get("SUPABASE_URL") ?? ""}/rest/v1${path}`;
}

/**
 * The single place that talks to the database.
 *
 * Uses the service role key, which bypasses row-level security. That is
 * required here — RLS deliberately allows no public access to these tables —
 * so nothing visitor-supplied may ever reach `path` unescaped. Every dynamic
 * value is passed through enc() by the callers below.
 */
async function rest(
  method: "HEAD" | "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: { body?: unknown; prefer?: string } = {}
): Promise<RestResult> {
  const headers: Record<string, string> = {
    apikey: serviceKey(),
    Authorization: `Bearer ${serviceKey()}`,
    "Content-Type": "application/json"
  };
  if (options.prefer) headers["Prefer"] = options.prefer;

  const response = await fetch(restUrl(path), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (method === "HEAD") {
    // PostgREST reports the total in Content-Range, e.g. "0-4/5" or "*/0".
    const range = response.headers.get("content-range");
    const total = range?.split("/")[1] ?? null;
    return {
      status: response.status,
      ok: response.ok,
      count: total && total !== "*" ? Number(total) : null,
      rows: null,
      code: null
    };
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  let code: string | null = null;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "code" in parsed) {
    code = String((parsed as { code: unknown }).code);
  }

  return {
    status: response.status,
    ok: response.ok,
    count: null,
    rows: Array.isArray(parsed) ? (parsed as Row[]) : parsed ? [parsed as Row] : null,
    code
  };
}

// ------------------------------------------------------------- email sending

/** Visitor-supplied values are interpolated into HTML mail, so escape them. */
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** Single place that talks to the email provider. Returns false if not sent. */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM_EMAIL") ?? "EduPay Waitlist <no-reply@edupayafrica.com.ng>";

  if (!apiKey) {
    // Without a provider the flow still works end to end, but no mail leaves
    // the server. Content is logged so it stays testable in staging.
    console.warn("[waitlist] RESEND_API_KEY is not configured; email not sent", { to, subject });
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html })
    });
    if (!response.ok) {
      console.error("[waitlist] email provider rejected the request", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[waitlist] email send failed", error);
    return false;
  }
}

async function sendVerificationEmail(to: string, verifyUrl: string): Promise<boolean> {
  const html = [
    "<div style=\"font-family:Arial,sans-serif;color:#102443;line-height:1.6\">",
    "<h2 style=\"margin:0 0 12px\">Confirm your EduPay waitlist registration</h2>",
    "<p>Thank you for joining the EduPay waitlist. Please confirm your email address to complete your registration.</p>",
    `<p><a href="${escapeHtml(verifyUrl)}" style="background:#ff941f;color:#14233a;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">Confirm my email</a></p>`,
    `<p style="font-size:12px;color:#68758a">This link expires in ${TOKEN_TTL_MINUTES / 60} hours. If the button does not work, copy this address into your browser:<br>${escapeHtml(verifyUrl)}</p>`,
    "<p style=\"font-size:12px;color:#68758a\">If you did not join the EduPay waitlist, you can ignore this email.</p>",
    "</div>"
  ].join("");

  return await sendEmail(to, "Confirm your EduPay waitlist registration", html);
}

interface SignupSummary {
  fullName: string;
  email: string;
  phone: string | null;
  audience: Audience;
  state: string | null;
  schoolName: string | null;
  educationLevel: string | null;
  institutionName: string | null;
  institutionType: string | null;
  contactRole: string | null;
  marketingConsent: boolean;
}

/**
 * Forwards each new registration to the team inbox named by
 * WAITLIST_NOTIFY_EMAIL so submissions are seen without database access.
 *
 * Only fired for genuinely new signups, never for resends or duplicate
 * attempts, so the inbox is not flooded by repeat submissions.
 */
async function notifyTeam(signup: SignupSummary, noticeVersion: string): Promise<void> {
  const to = Deno.env.get("WAITLIST_NOTIFY_EMAIL");
  if (!to) {
    console.warn("[waitlist] WAITLIST_NOTIFY_EMAIL is not set; no team notification sent");
    return;
  }

  const rows: [string, unknown][] = [
    ["Name", signup.fullName],
    ["Email", signup.email],
    ["Phone", signup.phone],
    ["Audience", signup.audience],
    ["State", signup.state],
    ["School", signup.schoolName],
    ["Education level", signup.educationLevel],
    ["Institution", signup.institutionName],
    ["Institution type", signup.institutionType],
    ["Contact role", signup.contactRole],
    ["Launch announcements", signup.marketingConsent ? "Opted in" : "Not opted in"],
    ["Notice version", noticeVersion],
    ["Submitted", new Date().toUTCString()]
  ];

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:5px 14px 5px 0;color:#5c6878;font-weight:600">${escapeHtml(label)}</th>` +
        `<td style="padding:5px 0;color:#102443">${escapeHtml(value === null ? "Not provided" : value)}</td></tr>`
    )
    .join("");

  const html = [
    "<div style=\"font-family:Arial,sans-serif;color:#102443;line-height:1.6\">",
    "<h2 style=\"margin:0 0 12px\">New EduPay waitlist signup</h2>",
    `<table style="border-collapse:collapse;font-size:14px">${table}</table>`,
    "<p style=\"font-size:12px;color:#5c6878;margin-top:20px\">This message contains personal data submitted through the EduPay waitlist form. Handle it in line with the EduPay privacy notice and do not forward it outside the team.</p>",
    "</div>"
  ].join("");

  await sendEmail(to, `New EduPay waitlist signup — ${signup.fullName}`, html);
}

// ------------------------------------------------------------- rate limiting

/**
 * Counts recent requests for a bucket and records this one.
 *
 * Fails open: if the counter cannot be read, the request is allowed through.
 * A monitoring glitch must never lock out a real visitor.
 */
async function withinLimit(bucket: string, route: string, max: number, windowMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const path =
    `/waitlist_request_log?select=id&bucket_key=eq.${enc(bucket)}` +
    `&route=eq.${enc(route)}&created_at=gte.${enc(since)}`;

  const counted = await rest("HEAD", path, { prefer: "count=exact" });

  if (counted.count === null) {
    console.error("[waitlist] rate limit read failed", counted.status);
    return true;
  }
  if (counted.count >= max) return false;

  await rest("POST", "/waitlist_request_log", { body: { bucket_key: bucket, route } });
  return true;
}

// ------------------------------------------------------------- token issuing

async function issueVerificationToken(signupId: string): Promise<string> {
  // A signup only ever has one usable token; older ones are discarded.
  await rest("DELETE", `/waitlist_verification_tokens?signup_id=eq.${enc(signupId)}&consumed_at=is.null`);

  const token = randomToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString();

  const created = await rest("POST", "/waitlist_verification_tokens", {
    body: { signup_id: signupId, token_hash: await sha256Hex(token), expires_at: expiresAt }
  });
  if (!created.ok) throw new Error(`token insert failed: ${created.status}`);

  return token;
}

// ------------------------------------------------------------------- handlers

async function handleRegister(
  request: Request,
  origin: string | null,
  body: Record<string, unknown>
): Promise<Response> {
  // --- validation -----------------------------------------------------------
  const errors: string[] = [];

  const fullName = optionalText(body.fullName, 120);
  if (fullName === null || fullName === "invalid") errors.push("fullName");

  const email = normalizeEmail(body.email);
  if (!email) errors.push("email");

  const phone = normalizePhone(body.phone);
  if (phone === "invalid") errors.push("phone");

  const audience = AUDIENCES.includes(body.audienceType as Audience)
    ? (body.audienceType as Audience)
    : null;
  if (!audience) errors.push("audienceType");

  const state = optionalText(body.state, 80);
  if (state === "invalid") errors.push("state");

  const schoolName = optionalText(body.schoolName, 160);
  const educationLevel = optionalText(body.educationLevel, 60);
  const institutionName = optionalText(body.institutionName, 160);
  const institutionType = optionalText(body.institutionType, 60);
  const contactRole = optionalText(body.contactRole, 100);
  if ([schoolName, educationLevel, institutionName, institutionType, contactRole].includes("invalid")) {
    errors.push("audienceFields");
  }
  if (educationLevel !== null && educationLevel !== "invalid" && !EDUCATION_LEVELS.includes(educationLevel as never)) {
    errors.push("educationLevel");
  }
  if (institutionType !== null && institutionType !== "invalid" && !INSTITUTION_TYPES.includes(institutionType as never)) {
    errors.push("institutionType");
  }

  // Waitlist consent is mandatory; marketing consent is separate and optional.
  const waitlistConsent = body.waitlistConsent === true;
  if (!waitlistConsent) errors.push("waitlistConsent");
  const marketingConsent = body.marketingConsent === true;

  if (audience === "student" && (!schoolName || schoolName === "invalid" || !educationLevel || educationLevel === "invalid")) {
    errors.push("studentFields");
  }
  if (audience === "institution") {
    if (!institutionName || institutionName === "invalid") errors.push("institutionName");
    if (!institutionType || institutionType === "invalid") errors.push("institutionType");
    if (!contactRole || contactRole === "invalid") errors.push("contactRole");
  }

  if (errors.length > 0 || !email || !fullName || fullName === "invalid" || !audience) {
    return json({ error: "invalid_request", fields: [...new Set(errors)] }, 400, origin);
  }

  // --- abuse control --------------------------------------------------------
  const ip = clientIp(request);
  if (!(await withinLimit(`ip:${ip}`, "register", REGISTER_MAX_PER_IP_PER_HOUR, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }
  if (!(await withinLimit(`email:${email}`, "register", REGISTER_MAX_PER_EMAIL_PER_HOUR, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  // --- existing signup? -----------------------------------------------------
  const lookup = await rest(
    "GET",
    `/waitlist_signups?select=id,status,last_verification_sent_at,verification_sent_count&email_key=eq.${enc(email)}&limit=1`
  );

  if (!lookup.ok) {
    console.error("[waitlist] signup lookup failed", lookup.status, lookup.rows);
    return json({ error: "server_error" }, 500, origin);
  }

  const existing = lookup.rows?.[0] ?? null;
  const cooldown = new Date(Date.now() - RESEND_COOLDOWN_MINUTES * 60_000).toISOString();
  const nowIso = new Date().toISOString();

  if (existing) {
    const status = typeof existing.status === "string" ? existing.status : null;
    const lastSent =
      typeof existing.last_verification_sent_at === "string" ? existing.last_verification_sent_at : null;
    const sentCount = typeof existing.verification_sent_count === "number" ? existing.verification_sent_count : 0;

    if (status === "verified") {
      return json({ status: "already_verified" }, 200, origin);
    }

    if (status === "removed") {
      // Treated exactly like a new registration: the person is asking to rejoin.
      const restored = await rest("PATCH", `/waitlist_signups?id=eq.${enc(existing.id)}`, {
        body: {
          status: "pending_verification",
          verified_at: null,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? nowIso : null
        }
      });
      if (!restored.ok) {
        console.error("[waitlist] signup restore failed", restored.status);
        return json({ error: "server_error" }, 500, origin);
      }
    }

    // Already pending and mailed very recently: do not re-send, but respond
    // identically so this cannot be used to probe which emails are registered.
    if (lastSent && lastSent > cooldown) {
      return json({ status: "pending_verification" }, 200, origin);
    }

    const token = await issueVerificationToken(String(existing.id));
    const sent = await sendVerificationEmail(email, `${siteUrl()}/verify?token=${token}`);
    await rest("PATCH", `/waitlist_signups?id=eq.${enc(existing.id)}`, {
      body: {
        verification_sent_count: sentCount + (sent ? 1 : 0),
        last_verification_sent_at: sent ? nowIso : null
      }
    });

    return json({ status: "pending_verification" }, 200, origin);
  }

  // --- new signup -----------------------------------------------------------
  const noticeVersion = Deno.env.get("WAITLIST_NOTICE_VERSION") ?? "prelaunch-2026-11-06";

  const inserted = await rest("POST", "/waitlist_signups?select=id", {
    prefer: "return=representation",
    body: {
      full_name: fullName,
      email: email,
      email_key: email,
      phone: phone && phone !== "invalid" ? phone : null,
      audience_type: audience,
      state: state && state !== "invalid" ? state : null,
      school_name: audience === "student" && schoolName !== "invalid" ? schoolName : null,
      education_level: educationLevel !== "invalid" ? educationLevel : null,
      institution_name: audience === "institution" && institutionName !== "invalid" ? institutionName : null,
      institution_type: audience === "institution" && institutionType !== "invalid" ? institutionType : null,
      contact_role: audience === "institution" && contactRole !== "invalid" ? contactRole : null,
      waitlist_consent: true,
      waitlist_notice_version: noticeVersion,
      waitlist_consent_at: nowIso,
      marketing_consent: marketingConsent,
      marketing_consent_at: marketingConsent ? nowIso : null
    }
  });

  if (!inserted.ok) {
    // Unique violation = a concurrent request claimed this email first.
    if (inserted.code === "23505" || inserted.status === 409) {
      return json({ status: "pending_verification" }, 200, origin);
    }
    console.error("[waitlist] signup insert failed", inserted.status, inserted.rows);
    return json({ error: "server_error" }, 500, origin);
  }

  const newId = String(inserted.rows?.[0]?.id ?? "");
  const token = await issueVerificationToken(newId);
  const sent = await sendVerificationEmail(email, `${siteUrl()}/verify?token=${token}`);

  await rest("PATCH", `/waitlist_signups?id=eq.${enc(newId)}`, {
    body: {
      verification_sent_count: sent ? 1 : 0,
      last_verification_sent_at: sent ? nowIso : null
    }
  });

  // Forward the submission to the team inbox. Only new signups reach here —
  // duplicates and resends return earlier, so the inbox is not flooded.
  await notifyTeam(
    {
      fullName,
      email,
      phone: typeof phone === "string" ? phone : null,
      audience,
      state: typeof state === "string" ? state : null,
      schoolName: audience === "student" && typeof schoolName === "string" ? schoolName : null,
      educationLevel: typeof educationLevel === "string" ? educationLevel : null,
      institutionName: audience === "institution" && typeof institutionName === "string" ? institutionName : null,
      institutionType: audience === "institution" && typeof institutionType === "string" ? institutionType : null,
      contactRole: audience === "institution" && typeof contactRole === "string" ? contactRole : null,
      marketingConsent
    },
    noticeVersion
  );

  return json({ status: "pending_verification" }, 201, origin);
}

async function handleVerify(
  request: Request,
  origin: string | null,
  body: Record<string, unknown>
): Promise<Response> {
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 200) return json({ state: "invalid" }, 200, origin);

  if (!(await withinLimit(`ip:${clientIp(request)}`, "verify", 60, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  const tokenHash = await sha256Hex(token);
  const lookup = await rest(
    "GET",
    `/waitlist_verification_tokens?select=id,signup_id,expires_at,consumed_at&token_hash=eq.${enc(tokenHash)}&limit=1`
  );

  if (!lookup.ok) {
    console.error("[waitlist] token lookup failed", lookup.status);
    return json({ error: "server_error" }, 500, origin);
  }

  const record = lookup.rows?.[0] ?? null;
  if (!record) return json({ state: "invalid" }, 200, origin);

  const signupId = String(record.signup_id ?? "");

  // Reports the current state rather than "invalid" when a link is opened
  // twice, so a returning visitor still sees success.
  async function stateFromSignup(): Promise<Response> {
    const signup = await rest("GET", `/waitlist_signups?select=status&id=eq.${enc(signupId)}&limit=1`);
    const status = signup.rows?.[0]?.status;
    return json({ state: status === "verified" ? "verified" : "invalid" }, 200, origin);
  }

  if (record.consumed_at) {
    return await stateFromSignup();
  }

  if (typeof record.expires_at !== "string" || new Date(record.expires_at).getTime() < Date.now()) {
    return json({ state: "expired" }, 200, origin);
  }

  const now = new Date().toISOString();
  const consumed = await rest("PATCH", `/waitlist_verification_tokens?id=eq.${enc(record.id)}&consumed_at=is.null`, {
    prefer: "return=representation",
    body: { consumed_at: now }
  });

  // Zero rows means a concurrent request consumed this token first.
  if (!consumed.ok || !consumed.rows || consumed.rows.length === 0) {
    return await stateFromSignup();
  }

  const verified = await rest("PATCH", `/waitlist_signups?id=eq.${enc(signupId)}`, {
    body: { status: "verified", verified_at: now }
  });

  if (!verified.ok) {
    console.error("[waitlist] signup verify failed", verified.status);
    return json({ error: "server_error" }, 500, origin);
  }

  return json({ state: "verified" }, 200, origin);
}

async function handleResend(
  request: Request,
  origin: string | null,
  body: Record<string, unknown>
): Promise<Response> {
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "invalid_request" }, 400, origin);

  if (!(await withinLimit(`ip:${clientIp(request)}`, "resend", 20, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }
  if (!(await withinLimit(`email:${email}`, "resend", RESEND_MAX_PER_EMAIL_PER_HOUR, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  const lookup = await rest(
    "GET",
    `/waitlist_signups?select=id,status,last_verification_sent_at&email_key=eq.${enc(email)}&limit=1`
  );

  if (!lookup.ok) {
    console.error("[waitlist] resend lookup failed", lookup.status);
    return json({ error: "server_error" }, 500, origin);
  }

  const signup = lookup.rows?.[0] ?? null;
  const cooldown = new Date(Date.now() - RESEND_COOLDOWN_MINUTES * 60_000).toISOString();

  if (signup) {
    const status = typeof signup.status === "string" ? signup.status : null;
    const lastSent =
      typeof signup.last_verification_sent_at === "string" ? signup.last_verification_sent_at : null;

    if (status !== "verified" && status !== "removed") {
      if (!lastSent || lastSent <= cooldown) {
        const token = await issueVerificationToken(String(signup.id));
        const sent = await sendVerificationEmail(email, `${siteUrl()}/verify?token=${token}`);
        await rest("PATCH", `/waitlist_signups?id=eq.${enc(signup.id)}`, {
          body: { last_verification_sent_at: sent ? new Date().toISOString() : null }
        });
      }
    }
  }

  // One generic answer for every case: registered, not registered, verified.
  return json({ status: "accepted" }, 200, origin);
}

// ---------------------------------------------------------------- entry point

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: baseHeaders(origin) });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }

  if (!Deno.env.get("SUPABASE_URL") || !serviceKey()) {
    console.error("[waitlist] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
    return json({ error: "server_error" }, 500, origin);
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413, origin);

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return json({ error: "invalid_json" }, 400, origin);
    }

    switch (body.action) {
      case "register":
        return await handleRegister(request, origin, body);
      case "verify":
        return await handleVerify(request, origin, body);
      case "resend":
        return await handleResend(request, origin, body);
      default:
        return json({ error: "unknown_action" }, 400, origin);
    }
  } catch (error) {
    // Log the detail, return nothing an attacker could use.
    console.error("[waitlist] unhandled error", error);
    return json({ error: "server_error" }, 500, origin);
  }
});
