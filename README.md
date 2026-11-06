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
- `/verify` — verification-in-progress instructions
- `/success` — display-only post-verification content and optional official WhatsApp Channel link; it must only be surfaced after the backend confirms verification
- `/privacy` — transparent pre-launch waitlist privacy notice; not yet approved for production

## Backend integration status

Backend integration is intentionally **not enabled**. The registration endpoint, request DTO, response format, verification URL and status exchange have not been confirmed. The frontend does not send registration data, invent an endpoint or treat a registration as verified.

`src/lib/waitlist-api.ts` contains the frontend input/unknown response types, centralized API base URL configuration and a configuration error until an agreed API adapter can be implemented. The form still validates and preserves input but reports that registration is not connected. `src/components/verification-state.tsx` provides UI for in-progress, verified, expired and invalid states; `/verify` currently displays in-progress only because the backend result transport and URL format are not known.

`.env.example` leaves `NEXT_PUBLIC_EDUPAY_API_URL` empty. Do not configure production values until the contract below is agreed. Existing provisional endpoint values, if present in a local `.env.local`, are not used by the current frontend.

### Backend contract required before integration

The backend team must confirm and document:

1. **Registration:** exact HTTP method and path; accepted DTO field names and types for name, email, optional normalized phone, audience, optional state and audience-specific fields; validation limits; and any CORS requirements. The frontend audience values are `student`, `parent_guardian` and `institution`; the backend must confirm or define their mapping.
2. **Consent records:** how the server records the required waitlist notice/version and consent time separately from optional launch-announcement consent; how consent withdrawal is handled; and how the notice version is supplied.
3. **Successful registration response:** exact success status and response schema, including how the frontend distinguishes a pending verification registration from an already verified registration. The frontend must not infer verification from a generic success response.
4. **Duplicates:** exact behavior for an existing pending or verified email, including status/response semantics, whether a verification email is sent again, and the user-safe message to show. Define server-side idempotency and rate limits.
5. **Email verification:** the email link URL format, token handling, the verification endpoint or callback, and how the frontend receives confirmed states for in-progress, verified, expired and invalid links. No URL parameter or endpoint format is assumed in this frontend.
6. **Resending verification:** whether resend is supported; if so, its exact method, path, request/response semantics, expiry, throttling and generic privacy-safe messages.
7. **Privacy and email operations:** controller identity and contact, approved privacy notice/version, retention and deletion rules, access/processor details, approved handling of minors, and a working unsubscribe mechanism in every optional launch-announcement email.
8. **Operational safeguards:** server-side validation, abuse/rate limiting, CORS allowlist, and safe public error semantics. Internal errors must not be sent to visitors.

Do not create customer accounts, wallet accounts or payment records when a person joins the waitlist.

## Pre-launch approvals

- Replace the pre-launch privacy notice with approved policy content and complete the outstanding privacy details.
- Obtain legal review of age thresholds and parental/guardian consent for student registrations, including minors.
- Confirm opt-in and unsubscribe behavior for launch emails.
- Confirm the backend API contract above before implementing or enabling network requests.
- Replace illustrative product mockups only with approved product imagery.

The official EduPay WhatsApp Channel is optional: https://whatsapp.com/channel/0029VbByeNR47XeEqQcE803V

## Checks

```powershell
npx tsc --noEmit
npm run lint
npm run build
```
