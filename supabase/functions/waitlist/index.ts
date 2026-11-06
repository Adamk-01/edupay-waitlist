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
//   WAITLIST_ALLOWED_ORIGINS comma-separated CORS allowlist
//   WAITLIST_NOTICE_VERSION  privacy notice version recorded with each consent
//   WAITLIST_FROM_EMAIL      verified sender, e.g. "EduPay <no-reply@edupayafrica.com.ng>"
//   RESEND_API_KEY           email provider key
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Design rules enforced here:
//   - No customer account, wallet or payment record is ever created.
//   - Only a SHA-256 hash of a verification token is stored.
//   - Duplicate and unknown emails return the SAME response: no enumeration.
//   - Internal errors are logged server-side and never returned to visitors.

import { createClient } from "jsr:@supabase/supabase-js@2";

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

type Audience = (typeof AUDIENCES)[number];
type SupabaseAdmin = ReturnType<typeof createClient>;

// ----------------------------------------------------------------- utilities

function baseHeaders(origin: string | null): HeadersInit {
  const allowList = (Deno.env.get("WAITLIST_ALLOWED_ORIGINS") ?? Deno.env.get("WAITLIST_SITE_URL") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // Never reflect an unrecognised origin.
  const allowed = origin && allowList.includes(origin) ? origin : (allowList[0] ?? "");

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
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

// ------------------------------------------------------------- email sending

async function sendVerificationEmail(to: string, verifyUrl: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM_EMAIL") ?? "EduPay Waitlist <no-reply@edupayafrica.com.ng>";

  const html = [
    "<div style=\"font-family:Arial,sans-serif;color:#102443;line-height:1.6\">",
    "<h2 style=\"margin:0 0 12px\">Confirm your EduPay waitlist registration</h2>",
    "<p>Thank you for joining the EduPay waitlist. Please confirm your email address to complete your registration.</p>",
    `<p><a href="${verifyUrl}" style="background:#ff941f;color:#14233a;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">Confirm my email</a></p>`,
    `<p style="font-size:12px;color:#68758a">This link expires in ${TOKEN_TTL_MINUTES / 60} hours. If the button does not work, copy this address into your browser:<br>${verifyUrl}</p>`,
    "<p style=\"font-size:12px;color:#68758a\">If you did not join the EduPay waitlist, you can ignore this email.</p>",
    "</div>"
  ].join("");

  if (!apiKey) {
    // Without a provider the flow still works end to end, but no mail leaves
    // the server. The link is logged so it stays testable in staging.
    console.warn("[waitlist] RESEND_API_KEY is not configured; verification email not sent", {
      to,
      verifyUrl
    });
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "Confirm your EduPay waitlist registration",
        html
      })
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

// ------------------------------------------------------------- rate limiting

async function withinLimit(
  admin: SupabaseAdmin,
  bucket: string,
  route: string,
  max: number,
  windowMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count, error } = await admin
    .from("waitlist_request_log")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", bucket)
    .eq("route", route)
    .gte("created_at", since);

  if (error) {
    console.error("[waitlist] rate limit read failed", error);
    return true; // fail open: never block a real visitor because of a DB hiccup
  }
  if ((count ?? 0) >= max) return false;

  await admin.from("waitlist_request_log").insert({ bucket_key: bucket, route });
  return true;
}

// ------------------------------------------------------------- token issuing

async function issueVerificationToken(admin: SupabaseAdmin, signupId: string): Promise<string> {
  // A signup only ever has one usable token; older ones are discarded.
  await admin
    .from("waitlist_verification_tokens")
    .delete()
    .eq("signup_id", signupId)
    .is("consumed_at", null);

  const token = randomToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString();

  const { error } = await admin.from("waitlist_verification_tokens").insert({
    signup_id: signupId,
    token_hash: await sha256Hex(token),
    expires_at: expiresAt
  });
  if (error) throw error;

  return token;
}

// ------------------------------------------------------------------- handlers

async function handleRegister(
  admin: SupabaseAdmin,
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
  if (!(await withinLimit(admin, `ip:${ip}`, "register", REGISTER_MAX_PER_IP_PER_HOUR, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }
  if (!(await withinLimit(admin, `email:${email}`, "register", REGISTER_MAX_PER_EMAIL_PER_HOUR, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  // --- existing signup? -----------------------------------------------------
  const { data: existing, error: lookupError } = await admin
    .from("waitlist_signups")
    .select("id, status, last_verification_sent_at, verification_sent_count")
    .eq("email_key", email)
    .maybeSingle();

  if (lookupError) {
    console.error("[waitlist] signup lookup failed", lookupError);
    return json({ error: "server_error" }, 500, origin);
  }

  const cooldown = new Date(Date.now() - RESEND_COOLDOWN_MINUTES * 60_000).toISOString();
  const nowIso = new Date().toISOString();

  if (existing) {
    if (existing.status === "verified") {
      return json({ status: "already_verified" }, 200, origin);
    }
    if (existing.status === "removed") {
      // Treated exactly like a new registration: the person is asking to rejoin.
      const { error: restoreError } = await admin
        .from("waitlist_signups")
        .update({
          status: "pending_verification",
          verified_at: null,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? nowIso : null
        })
        .eq("id", existing.id);
      if (restoreError) {
        console.error("[waitlist] signup restore failed", restoreError);
        return json({ error: "server_error" }, 500, origin);
      }
    }

    // Already pending and mailed very recently: do not re-send, but respond
    // identically so this cannot be used to probe which emails are registered.
    if (existing.last_verification_sent_at && existing.last_verification_sent_at > cooldown) {
      return json({ status: "pending_verification" }, 200, origin);
    }

    const token = await issueVerificationToken(admin, existing.id);
    const sent = await sendVerificationEmail(email, `${siteUrl()}/verify?token=${token}`);
    await admin
      .from("waitlist_signups")
      .update({
        verification_sent_count: (existing.verification_sent_count ?? 0) + (sent ? 1 : 0),
        last_verification_sent_at: sent ? nowIso : null
      })
      .eq("id", existing.id);

    return json({ status: "pending_verification" }, 200, origin);
  }

  // --- new signup -----------------------------------------------------------
  const noticeVersion = Deno.env.get("WAITLIST_NOTICE_VERSION") ?? "prelaunch-2026-11-06";

  const { data: inserted, error: insertError } = await admin
    .from("waitlist_signups")
    .insert({
      full_name: fullName,
      email,
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
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique violation = a concurrent request claimed this email first.
    if (insertError.code === "23505") return json({ status: "pending_verification" }, 200, origin);
    console.error("[waitlist] signup insert failed", insertError);
    return json({ error: "server_error" }, 500, origin);
  }

  const token = await issueVerificationToken(admin, inserted.id);
  const sent = await sendVerificationEmail(email, `${siteUrl()}/verify?token=${token}`);

  await admin
    .from("waitlist_signups")
    .update({
      verification_sent_count: sent ? 1 : 0,
      last_verification_sent_at: sent ? nowIso : null
    })
    .eq("id", inserted.id);

  return json({ status: "pending_verification" }, 201, origin);
}

async function handleVerify(
  admin: SupabaseAdmin,
  request: Request,
  origin: string | null,
  body: Record<string, unknown>
): Promise<Response> {
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 200) return json({ state: "invalid" }, 200, origin);

  if (!(await withinLimit(admin, `ip:${clientIp(request)}`, "verify", 60, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  const tokenHash = await sha256Hex(token);
  const { data: record, error } = await admin
    .from("waitlist_verification_tokens")
    .select("id, signup_id, expires_at, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("[waitlist] token lookup failed", error);
    return json({ error: "server_error" }, 500, origin);
  }
  if (!record) return json({ state: "invalid" }, 200, origin);

  if (record.consumed_at) {
    // A reused link still lands on success if the address was already verified.
    const { data: signup } = await admin
      .from("waitlist_signups")
      .select("status")
      .eq("id", record.signup_id)
      .maybeSingle();
    return json({ state: signup?.status === "verified" ? "verified" : "invalid" }, 200, origin);
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return json({ state: "expired" }, 200, origin);
  }

  const now = new Date().toISOString();
  const { error: consumeError } = await admin
    .from("waitlist_verification_tokens")
    .update({ consumed_at: now })
    .eq("id", record.id)
    .is("consumed_at", null);

  if (consumeError) {
    console.error("[waitlist] token consume failed", consumeError);
    return json({ error: "server_error" }, 500, origin);
  }

  const { error: verifyError } = await admin
    .from("waitlist_signups")
    .update({ status: "verified", verified_at: now })
    .eq("id", record.signup_id);

  if (verifyError) {
    console.error("[waitlist] signup verify failed", verifyError);
    return json({ error: "server_error" }, 500, origin);
  }

  return json({ state: "verified" }, 200, origin);
}

async function handleResend(
  admin: SupabaseAdmin,
  request: Request,
  origin: string | null,
  body: Record<string, unknown>
): Promise<Response> {
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "invalid_request" }, 400, origin);

  if (!(await withinLimit(admin, `ip:${clientIp(request)}`, "resend", 20, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }
  if (!(await withinLimit(admin, `email:${email}`, "resend", RESEND_MAX_PER_EMAIL_PER_HOUR, 60))) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  const { data: signup, error } = await admin
    .from("waitlist_signups")
    .select("id, status, last_verification_sent_at")
    .eq("email_key", email)
    .maybeSingle();

  if (error) {
    console.error("[waitlist] resend lookup failed", error);
    return json({ error: "server_error" }, 500, origin);
  }

  const cooldown = new Date(Date.now() - RESEND_COOLDOWN_MINUTES * 60_000).toISOString();

  if (signup && signup.status !== "verified" && signup.status !== "removed") {
    if (!signup.last_verification_sent_at || signup.last_verification_sent_at <= cooldown) {
      const token = await issueVerificationToken(admin, signup.id);
      const sent = await sendVerificationEmail(email, `${siteUrl()}/verify?token=${token}`);
      await admin
        .from("waitlist_signups")
        .update({ last_verification_sent_at: sent ? new Date().toISOString() : null })
        .eq("id", signup.id);
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

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

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
        return await handleRegister(admin, request, origin, body);
      case "verify":
        return await handleVerify(admin, request, origin, body);
      case "resend":
        return await handleResend(admin, request, origin, body);
      default:
        return json({ error: "unknown_action" }, 400, origin);
    }
  } catch (error) {
    // Log the detail, return nothing an attacker could use.
    console.error("[waitlist] unhandled error", error);
    return json({ error: "server_error" }, 500, origin);
  }
});
