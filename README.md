# EduPay Waitlist Frontend

A standalone Next.js + TypeScript website for the EduPay Waitlist. It is not part of the EduPay customer or admin application.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript (strict)
- Responsive CSS
- lucide-react

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Frontend routes

- `/` — landing page and waitlist form
- `/verify` — verification instructions; with `?token=…` it confirms the token and renders verified, expired or invalid. Also carries the optional WhatsApp Channel invitation so a new subscriber has a next step while waiting. `noindex`.
- `/success` — display-only post-verification content and optional official WhatsApp Channel link; it must only be surfaced after the backend confirms verification. `noindex`.
- `/privacy` — transparent pre-launch waitlist privacy notice; not yet approved for production

## Backend integration

The waitlist backend is implemented as a Supabase Edge Function and is **switched off until
`NEXT_PUBLIC_EDUPAY_API_URL` is set**. With the variable empty, `registerWaitlist()` throws a
configuration error and the form reports that registration is not connected — nothing is sent
anywhere. That is the intended state until the privacy notice is approved.

### Contract

All three actions are `POST` to `<NEXT_PUBLIC_EDUPAY_API_URL>/waitlist` with an `action` field:

| Action | Request | Success response |
| --- | --- | --- |
| `register` | `fullName`, `email`, `phone?`, `audienceType`, `state?`, `schoolName?`, `educationLevel?`, `institutionName?`, `institutionType?`, `contactRole?`, `waitlistConsent`, `marketingConsent` | `201 { status: "pending_verification" }` or `200 { status: "already_verified" }` |
| `verify` | `token` | `200 { state: "verified" \| "expired" \| "invalid" }` |
| `resend` | `email` | `200 { status: "accepted" }` (identical for every email: no enumeration) |

Errors: `400 { error: "invalid_request", fields: [...] }`, `413 payload_too_large`,
`429 { error: "rate_limited" }`, `500 { error: "server_error" }`. Internal detail is logged
server-side only and never returned to visitors.

Answers to the points that were previously open:

1. **Registration** — `POST .../waitlist`, field names as above. Audience values are `student`,
   `parent_guardian`, `institution`. CORS is restricted to `WAITLIST_ALLOWED_ORIGINS`.
2. **Consent records** — `waitlist_consent`, `waitlist_notice_version` (from the
   `WAITLIST_NOTICE_VERSION` secret) and `waitlist_consent_at` are stored on every row;
   `marketing_consent` / `marketing_consent_at` are stored separately and a check constraint
   keeps the two in step.
3. **Success response** — only `pending_verification` and `already_verified` exist, so the
   frontend can never infer verification from a generic success.
4. **Duplicates** — one row per lowercased email (`waitlist_signups_email_key_idx`). A pending
   duplicate returns the same `pending_verification` body as a brand new signup; unknown emails
   are indistinguishable from pending ones.
5. **Email verification** — the link is `<WAITLIST_SITE_URL>/verify?token=…`, tokens are 32 random
   bytes, valid for 24 hours, single-use, and only the SHA-256 hash is stored. `/verify` renders
   in-progress, verified, expired or invalid.
6. **Resending** — supported via `action: "resend"`, throttled to 3/hour per email with a 10-minute
   cooldown, and it always answers `accepted`. The UI for it is not built yet.
7. **Privacy and email operations** — still open. See "Pre-launch approvals".
8. **Operational safeguards** — server-side re-validation of every field, per-IP and per-email rate
   limits, an 8 KB body cap, a CORS allowlist that never reflects an unknown origin, and generic
   public errors.

Do not create customer accounts, wallet accounts or payment records when a person joins the
waitlist — the edge function only ever touches the three `waitlist_*` tables.

### Deploying the backend

The schema lives in `supabase/migrations/` and the function in
`supabase/functions/waitlist/index.ts`:

```powershell
supabase db push
supabase functions deploy waitlist --no-verify-jwt
supabase secrets set RESEND_API_KEY=...            # required for mail to actually send
```

Required secrets: `RESEND_API_KEY`, `WAITLIST_SITE_URL`, `WAITLIST_ALLOWED_ORIGINS`,
`WAITLIST_NOTICE_VERSION`, `WAITLIST_FROM_EMAIL`, `WAITLIST_NOTIFY_EMAIL`. Without `RESEND_API_KEY`,
signups may be stored, but no verification or notification emails are sent. The function logs a
warning, not the verification link; email verification therefore cannot be completed.

#### CORS allowlist

`WAITLIST_ALLOWED_ORIGINS` is a comma-separated list. An entry with no `*` must match the request's
`Origin` byte for byte. An entry containing `*` is a pattern, which exists because preview origins
are generated per branch and cannot be listed in advance:

```powershell
supabase secrets set WAITLIST_ALLOWED_ORIGINS="https://edupay-waitlist.vercel.app,https://edupay-waitlist-*.vercel.app,http://localhost:3000"
```

A `*` matches only characters within a single hostname label. Keep patterns narrow and review them
before enabling: even `edupay-waitlist-*` can match similarly named deployments belonging to someone
else. Prefer exact origins if those deployments aren't all trusted. The example above is not applied
automatically; update the secret separately when needed. CORS is not a security boundary here — the
function has no client secret, so anyone can `POST` to it directly. Validation, rate limits and
generic responses are what protect it; CORS only stops a casual browser on an unrelated site.

Only a concrete origin is ever reflected back, never the pattern that matched it, and every response
carries `Vary: Origin`. Preflight results are cached for 10 minutes rather than a day, so a corrected
allowlist takes effect quickly.

#### Health check

Open the function URL directly in a browser tab:

```
https://<project-ref>.supabase.co/functions/v1/waitlist
```

A healthy function answers `{"error":"method_not_allowed"}`. Do this before debugging anything else —
see the troubleshooting table below for why.

### Team notification email

Every **new** signup is forwarded to the address in `WAITLIST_NOTIFY_EMAIL` (currently
`alphaphysicseduconsult@gmail.com`) so submissions can be seen without database access. The message
lists the submitted fields, the notice version and the timestamp, and all values are HTML-escaped.

It fires only for genuinely new registrations — duplicates, resends and verification attempts return
earlier — so repeat submissions cannot flood the inbox.

> **Privacy:** this sends personal data (name, email, phone, school or institution) to a third-party
> mailbox outside the application database. Whoever controls that mailbox is effectively a recipient
> of waitlist data, so it must be named in the approved privacy notice, secured with MFA, and the
> emails deleted when they are no longer needed. If that is not acceptable, unset
> `WAITLIST_NOTIFY_EMAIL` — the function logs a warning and carries on.

The waitlist tables have RLS enabled with **no policies**, so the anon and authenticated roles are
denied every operation; only the service role inside the edge function can read or write them.

## Troubleshooting the deployed API

What the browser shows does not map one-to-one onto causes. Check this table before changing anything.

| What you see | What it actually means |
| --- | --- |
| `{"code":"BOOT_ERROR","message":"Function failed to start"}` | The function never started. No handler ran, so no origin, header or request body mattered. |
| "We couldn't reach EduPay. Check your connection and try again." | Any network-level failure: `BOOT_ERROR`, a CORS rejection, or a 404 from a malformed URL. |
| "Waitlist registration is not yet connected yet" | `NEXT_PUBLIC_EDUPAY_API_URL` was empty at build time. Set it, redeploy with the build cache cleared, then hard-refresh. |
| `{"error":"method_not_allowed"}` in a bare tab | Healthy. The function started and rejected `GET`. |
| "Some details need checking" | Server-side validation rejected a field. |
| "Too many attempts" | Rate limited: 5/hour per IP, 3/hour per email. |

### The function must not import anything

An earlier version opened with `import { createClient } from "jsr:@supabase/supabase-js@2"`. That
module could not be resolved when the function started, so it returned `BOOT_ERROR` for every single
request. From the browser this looks exactly like a CORS failure, and it cost several rounds of
origin debugging before it was found.

The function therefore has **no imports at all**: it reaches PostgREST and the mail provider through
the web-standard `fetch()`. Do not add a dependency back without first confirming the function still
boots.

A boot failure may not produce an application log line. Check the function URL and the platform's
edge-function logs when diagnosing a failure.

## Canonical site URL

`SITE_URL` in `src/lib/site.ts` backs canonical tags, `robots.txt`, `sitemap.xml` and Open Graph URLs.
It is resolved once at build time, in this order:

1. `NEXT_PUBLIC_SITE_URL` — set this once the custom domain is live.
2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's production domain, when its system environment
   variables are exposed to the build.
3. `https://waitlist.edupayafrica.com.ng` — last-resort fallback.

Set `NEXT_PUBLIC_SITE_URL` explicitly if Vercel system variables are unavailable, or to choose a
specific canonical domain. Rebuild the frontend after changing it. Set the separate Supabase secret
`WAITLIST_SITE_URL` to the same origin for verification links; it is not updated automatically.

`VERCEL_URL` is deliberately ignored: it is the URL of the *current* deployment, so on a preview build
it would point canonical tags and the sitemap at a throwaway host.

`src/lib/site.ts` reads a non-public variable, so it is server-only. It is imported by the root layout,
`robots.ts` and `sitemap.ts` — do not import it from a client component.

## Pre-launch approvals

- Replace the pre-launch privacy notice with approved policy content and complete the outstanding privacy details.
- Obtain legal review of age thresholds and parental/guardian consent for student registrations, including minors.
- Name every recipient of waitlist data in the privacy notice, including the
  `WAITLIST_NOTIFY_EMAIL` inbox that receives a copy of each signup.
- Confirm the hero screenshots in `public/` are approved product imagery and contain no real
  customer data (names, phone numbers, balances, order references).
- Confirm opt-in and unsubscribe behavior for launch emails.
- Set `NEXT_PUBLIC_EDUPAY_API_URL` in the hosting environment. Until it is set, registration stays
  switched off and no visitor data is transmitted, so this is the switch that goes live last.
- Add `RESEND_API_KEY` and a verified sending domain, otherwise verification emails are never sent.
- Replace illustrative product mockups only with approved product imagery.

The official EduPay WhatsApp Channel is optional: https://whatsapp.com/channel/0029VbByeNR47XeEqQcE803V

## Dependency upgrades

Use `npm ci` to install the versions in `package-lock.json`. The current Next.js 15 build depends on
the TypeScript 5 compiler API; TypeScript 7 is incompatible with its configuration loader. The build
checks this before starting and reports an actionable error. Dependabot skips major upgrades of the
Next.js, TypeScript, ESLint, and Node types toolchain; plan and test those together as a separate
migration. Updates within the current majors remain enabled; review security fixes that require a
major upgrade manually. Review `npm audit` findings individually instead of running `npm audit fix
--force`, which can install breaking major versions.

## Checks

```powershell
npx tsc --noEmit
npm run check:edge
npm test
npm run lint
npm run build
```

The separate edge check uses minimal Deno declarations in `tests/deno-globals.d.ts` because
`supabase/` is excluded from the Next.js TypeScript configuration. Tests cover the no-import rule,
CORS matching and canonical URL resolution. These checks also run on pull requests, but they do not
replace a real deployment smoke test.

After deploying, load the function URL to confirm it returns `{"error":"method_not_allowed"}`.
