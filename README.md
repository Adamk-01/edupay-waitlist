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
`WAITLIST_NOTICE_VERSION`, `WAITLIST_FROM_EMAIL`, `WAITLIST_NOTIFY_EMAIL`. Without `RESEND_API_KEY`
the flow still works — signups are stored and the email content is written to the function logs —
but no mail leaves the server.

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

## Checks

```powershell
npx tsc --noEmit
npm run lint
npm run build
```
