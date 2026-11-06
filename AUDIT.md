# EduPay Waitlist — Website Audit

**Date:** 2026-11-06
**Repo:** `Adamk-01/edupay-waitlist` (public, default branch `main`)
**Audited commit:** `4c61372` ("Stop tracking local environment config")
**Stack:** Next.js 15.5.27 (App Router) · React 19 · TypeScript (strict) · plain CSS · lucide-react

---

## Verdict

**Not launch-ready.** The site is well-built as a *static brochure* — clean code, clean build, good
typecheck/lint hygiene, small bundle — but its single purpose (collecting waitlist signups) does not
work, and the privacy/legal package that a signup form needs has not been approved.

| Area | Rating | Headline |
| --- | --- | --- |
| Functionality | ❌ **Failing** | Every form submission is rejected by a hard-coded throw. There is no backend and no storage. |
| Security | ⚠️ **Needs work** | 1 critical + 1 high advisory in dependencies; no security headers; `.gitignore` gap for `.env`. |
| Privacy & legal | ⚠️ **Not launch-ready** | Privacy notice is explicitly unapproved; controller, retention, minors' consent all unresolved. |
| Accessibility | ⚠️ **Partial** | WCAG 2.1 AA not met: 6 contrast failures, 49/50 icons exposed to screen readers. |
| SEO / discoverability | ⚠️ **Weak** | No favicon, `robots.txt`, `sitemap.xml`, canonical, or OG image; 3 pages share one title. |
| Performance | ✅ **Good** | 109 kB first-load JS, zero raster images, fully static. Fonts are the main cost. |
| Code health | 🟡 **Fair** | Typecheck + lint + build all pass; one 14 kB minified CSS line is a maintainability hazard. |
| Ops / process | ⚠️ **Minimal** | No CI, no tests, no Dependabot/secret scanning evidence, no LICENSE. |

---

## Remediation status (updated 2026-11-06, same day as the audit)

The four P0 items have been implemented and verified. Marked ✅ below.

| Finding | Status | What was done |
| --- | --- | --- |
| F-1 · form is a dead end | ✅ **Backend built** | `waitlist_signups` / `waitlist_verification_tokens` / `waitlist_request_log` tables + `waitlist` Edge Function (register / verify / resend). Registration stays **switched off** until `NEXT_PUBLIC_EDUPAY_API_URL` is set, so the site still shows the honest "not connected" message. |
| F-2 · critical RCE advisory | ✅ **Resolved** | `next` 15.5.27 → **15.5.29**, `postcss` pinned to `^8.5.32` via an override. Critical and high advisories are **gone**. |
| F-3 · `.gitignore` missed `.env` | ✅ **Resolved** | Now `.env` / `.env.*` with `!.env.example`; verified with `git check-ignore`. |
| F-4 · no security headers | ✅ **Resolved** | CSP, HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, COOP/CORP added in `next.config.ts`. |
| F-8 · SEO foundations | 🟡 **Partly** | App icon added (fixes the favicon 404), per-route titles for `/success` and `/verify`. `robots.txt`, `sitemap.xml`, canonical and OG image still outstanding. |
| F-9 · `/success` indexable | ✅ **Resolved** | `noindex, nofollow` on `/success` and `/verify`. |
| F-15 · hard-coded `/verify` redirect | ✅ **Resolved** | `registerWaitlist()` now returns a discriminated result and the form routes on `already_verified` vs `pending_verification` via `router.push()`. |

**Residual risk after this pass**

- `npm audit` reports **6 moderate, dev-only** advisories (minimatch via `@typescript-eslint`). They
  are reachable only through ESLint's own glob matching at lint time, not by the website. Clearing
  them needs a `@typescript-eslint` major bump; a forced `minimatch@11` override breaks ESLint
  itself (`@eslint/eslintrc` imports minimatch's default export), so it was reverted deliberately.
- **The Edge Function has not been exercised over HTTP.** The sandbox cannot reach
  `*.supabase.co`, so register/verify/resend are untested end to end. The schema *was* tested
  directly: a valid insert succeeds, and an insert with `waitlist_consent = false` is rejected by
  the check constraint. Run a live signup with the URL set before announcing the waitlist.
- **Verification emails will not send yet** — `RESEND_API_KEY` is not configured. Until it is, the
  function stores the signup and logs the verification link instead of mailing it.
- The accessibility and SEO findings (F-5, F-6, F-7, F-8 remainder, F-10…F-22) are untouched.

---

## How I audited

| Check | Tool / method | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | ✅ 0 errors |
| Lint | `npm run lint` (next/core-web-vitals + next/typescript) | ✅ 0 errors, 0 warnings |
| Build | `npm run build` | ✅ 7 static routes, 109 kB first load |
| Dependencies | `npm audit` | ❌ 8 vulns (1 critical, 1 high, 6 moderate) |
| Runtime HTML | Built site served on `:3000`, all 4 routes fetched and parsed | see findings |
| Contrast | WCAG 2.1 relative-luminance math on every text/background pair in the CSS | 6 pairs fail AA |
| Backend | Supabase "EduPay" project inspected (`list_projects`, `execute_query` on `pg_tables`, `list_edge_functions`) | no waitlist table, 0 edge functions |
| Repo posture | `gh api` on repo metadata | public, no license, no PRs/issues |
| Secret scan | grep for key patterns across tracked files | ✅ no credentials in the repo |

**Limitations — please read before acting on this report.** The production site
(`https://waitlist.edupayafrica.com.ng`) is **not reachable from the audit sandbox**, so
deployment-level checks (TLS configuration, HSTS, live response headers, DNS, uptime, CDN caching,
real Lighthouse/field Core Web Vitals) were **not** verified. Everything below is from source,
dependency data, and a local production build. Accessibility findings are from static analysis and
contrast math, not from assistive-technology testing. Run the production URL through
PageSpeed Insights / SecurityHeaders.com and re-check.

---

## Critical

### F-1 · The waitlist form cannot register anyone — and there is nowhere to store a signup

**Severity: Critical · Area: Functionality**

`registerWaitlist()` exists only as a stub that always throws. It accepts the input, discards it,
and raises a configuration error:

```ts
// src/lib/waitlist-api.ts:33-36
export async function registerWaitlist(input: WaitlistRegistrationInput): Promise<void> {
  void input;
  throw new WaitlistApiError("configuration");
}
```

`src/components/waitlist-form.tsx:83-89` catches that and shows the visitor:
*"Waitlist registration is not connected yet. Please check back soon."*

There is no `fetch`, no endpoint, and no `NEXT_PUBLIC_EDUPAY_API_URL` value in `.env.example`, so
every visitor who fills in the form gets an error. **The site's only conversion action is a dead
end, and it currently has no way to tell you that someone tried to join.**

It is also not just a frontend gap. Inspecting the connected Supabase project **EduPay**
(`sllwhfwvjngfsaapblin`, `eu-west-1`, `ACTIVE_HEALTHY`):

- 27 tables in `public` — `orders`, `wallets`, `wallet_transactions`, `profiles`, `payments`… the
  full customer/admin app.
- **No waitlist table of any kind.**
- **Zero edge functions** — so no verification-email sender, no resend, no verification callback.

So there is no schema, no endpoint, and no email pipeline to point the form at yet.

**Fix (in order):** 1) agree the 8-point backend contract already listed in your `README.md`;
2) create a `waitlist_signups` table (see F-2 note on RLS) plus a verification-token table and an
edge function for send/verify/resend; 3) then implement `registerWaitlist()` against it. Do not
enable the form publicly before step 3 — a live form that silently fails is worse than no form.

> This is deliberate, documented behaviour, not an accident — your README is unusually honest about
> it. I'm flagging it as Critical because of the impact on visitors, not because someone made a
> mistake.

## High

### F-2 · Critical RCE advisory in the installed Next.js version

**Severity: High (advisory severity: Critical 9.5) · Area: Dependencies**

`next@15.5.27` is inside the vulnerable range of:

- **[GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) — Critical (9.5)** ·
  Unauthenticated RCE in the Image Optimization API when SVG files are used (memory-corruption in
  an upstream image library, glibc Linux). Affects `>= 10.0.0, <= 15.5.27`. **Patched in 15.5.28**
  (npm currently resolves 15.5.29). Workaround if you can't upgrade: ensure `sharp >= 0.35.5`.
- **[GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) — High** · DoS in App
  Router Server Actions.
- `postcss` (transitive) — High: arbitrary file read via attacker-controlled `sourceMappingURL`.
- 6 moderate advisories in the `@typescript-eslint` / `minimatch` dev chain (dev-only, low real risk).

**Exploitability today: low.** The app never uses `next/image`, defines no `images.remotePatterns`,
ships no SVG in `public/`, and has no Server Actions — so the image-optimizer path is not reachable
with attacker-controlled SVG. But `/_next/image` ships enabled by default, so the moment someone
adds an image component or a remote pattern the exposure opens silently.

**Fix:** `npm install next@15.5.29` (pin it, since `next` is the one dep you pin exactly), re-run
`npm audit`, and add Dependabot so this never sits for 6 months again.

### F-3 · `.gitignore` does not ignore a plain `.env` file

**Severity: High · Area: Security**

```gitignore
# .gitignore
.env*.local
.env.local
```

`.env` (no suffix) and `.env.production` are **not** matched — `.env*.local` requires the `.local`
ending. Your README instructs `Copy-Item .env.example .env.local`, so the happy path is safe, but a
teammate who runs `cp .env.example .env` — or Vercel/Netlify export tooling that writes `.env` —
will have real credentials staged and committable. In a **public** repo, that is a one-commit data
breach.

**Fix:**

```gitignore
.env
.env.*
!.env.example
```

Also run a history scan (`gitleaks detect` or `trufflehog git file://.`) — note the sandbox clone is
shallow (depth 1), so I could only inspect the single available commit: it contains no secrets.

### F-4 · No security headers are set anywhere

**Severity: High (once the form is live) · Area: Security**

Responses from the built site carry only `Content-Type`, `Cache-Control`, `ETag` and `Vary`. There is
no CSP, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`/`frame-ancestors`, or `Permissions-Policy`, and `next.config.ts` sets no `headers()`.

Today the site is static and stateless, so the practical risk is low. It becomes real the moment the
form posts PII: without `frame-ancestors`, your consent screen can be clickjacked in an iframe.

**Fix:** add a `headers()` block in `next.config.ts` with a CSP
(`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <api>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`),
HSTS with `preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### F-5 · 49 of 50 decorative icons are exposed to assistive technology

**Severity: High · Area: Accessibility (WCAG 1.1.1 / 4.1.2)**

The home page renders 50 `<svg>` elements. Exactly **one** has `aria-hidden="true"`; none has a
`role` or accessible name. lucide-react v0.468 does not add `aria-hidden` by default, so screen
readers and Voice Control enumerate 49 unnamed graphics around your copy and buttons.

**Fix:** set `aria-hidden="true"` (or `aria-hidden` + `focusable="false"`) on purely decorative
icons — all of `waitlist-landing.tsx`, `logo.tsx`, `phone-mockups.tsx`, and the button icons. A
single shared `<Icon>` wrapper is the cleanest fix, since this will recur.

### F-6 · Six colour pairs fail WCAG 2.1 AA contrast

**Severity: High · Area: Accessibility (WCAG 1.4.3)**

Computed with the WCAG relative-luminance formula against the actual backgrounds in the CSS:

| Element | Colours | Ratio | Size | Verdict |
| --- | --- | --- | --- | --- |
| FAQ / body copy `.faq-item p` | `#68758a` on `#fff9ef` | **4.46** | 12 px | ❌ needs 4.5 |
| WhatsApp fine print | `#687b70` on `#f1f8f2` | **4.18** | 10 px | ❌ |
| Section eyebrow labels | `#a76b21` on `#fff9ef` | **4.20** | 10 px | ❌ |
| "Join WhatsApp Channel" button | `#ffffff` on `#159b60` | **3.57** | 14 px | ❌ (bold, but < 18.66 px) |
| Mockup "Completed" status pill | `#13834e` on `#dcf6e9` | **4.20** | 8 px | ❌ |
| Mockup document sub-text | `#8390a3` on `#ffffff` | **3.24** | 8 px | ❌ |

Everything else I measured passes AA, several at AAA. Two secondary issues compound this:
`.consent` and several supporting styles are **10 px**, and `.step p` / `.phone-*` content drops to
**8–10 px**, which is below comfortable minimums even where contrast passes.

**Fix:** darken `#68758a` → `#5c6878`, `#687b70` → `#5a6b60`, `#a76b21` → `#8a5615`; darken the
WhatsApp button to `#0f7d4c` (or darken text); raise body text to 14 px and never below 12 px.

### F-7 · Mobile has no navigation at all

**Severity: High · Area: Accessibility / UX**

At `max-width: 700px` the CSS does `.desktop-nav, .nav-cta { display: none }` and the only remaining
header control is:

```tsx
<a className="mobile-menu" href="#join" aria-label="Go to registration"><Menu/></a>
```

There is no menu behind the hamburger — it is a plain anchor to the form. Home / About / Services /
FAQs are unreachable on mobile except by scrolling, and the icon carries the whole accessible name
"Go to registration", which is not what a hamburger means.

**Fix:** either make the hamburger open a real navigable menu (with `aria-expanded`, `aria-controls`,
focus trap and Escape to close), or replace it with a "Join the waitlist" button that looks like one.

## Medium

### F-8 · SEO foundations are missing

**Severity: Medium · Area: SEO**

Verified against the built HTML:

- **No favicon or app icon** — `/favicon.ico`, `/icon.svg` both **404**. Add `src/app/icon.svg` (and
  `apple-icon.png`).
- **No `robots.txt`, no `sitemap.xml`** — both **404**. Add `src/app/robots.ts` and `src/app/sitemap.ts`.
- **No canonical URL** — `metadataBase` is set but `alternates.canonical` is not, so `og:url` and
  canonical are absent.
- **No OG image** — shares on WhatsApp/X/facebook render as a bare link. This matters extra here: your
  growth channel *is* WhatsApp.
- **No structured data** (`Organization` / `WebSite` JSON-LD).
- **Duplicate metadata.** `/` , `/success` and `/verify` all ship the identical title
  *"EduPay Waitlist | Education services. Made easier."* and the identical description, because only
  `/privacy` exports its own `metadata`. Give each route its own title/description.
- No `theme-color`.

### F-9 · `/success` is publicly reachable and indexable

**Severity: Medium · Area: SEO / Privacy**

`src/app/success/page.tsx` renders "You're on the list!" to anyone who types the URL, and it is
statically prerendered with no `noindex`. Your README states this page *"must only be surfaced after
the backend confirms verification"* — today nothing enforces that, and Google can index a
confirmation page nobody earned.

**Fix:** add `export const metadata = { robots: { index: false, follow: false } }` to `/success` and
`/verify` now. Longer term, gate `/success` on a real verified state (server-side token check, not a
client-side redirect) once F-1 is done.

### F-10 · Google Fonts via CSS `@import` — performance *and* privacy cost

**Severity: Medium · Area: Performance / Privacy**

`src/app/globals.css:1`:

```css
@import url('https://fonts.googleapis.com/…DM+Sans…Manrope…&display=swap');
```

This survives into the built stylesheet. Three problems: (1) an `@import` inside CSS is discovered
only after the CSS downloads, adding a serial round-trip to `fonts.googleapis.com` *and*
`fonts.gstatic.com` before first paint; (2) every visitor's IP address is disclosed to Google — a
live issue under Nigeria's NDPA 2023 and the GDPR precedent on Google Fonts; (3) it renders your
site font-dependent on a third party.

**Fix:** `next/font/google` (self-hosts and inlines at build time, zero external requests, automatic
font fallback metrics) or `next/font/local` with the `.woff2` files vendored.

### F-11 · Decorative mockup copy is exposed as real content

**Severity: Medium · Area: Accessibility**

`.phone-stage` is correctly marked `role="img"` with an `aria-label`, so its text is hidden from
screen readers — good. But `.feature-visual` in `waitlist-landing.tsx:73-76` has no such treatment,
so AT reads "Academic document Keep in one place Certificate record Available in your vault
Education. Made Easier." as page content. Meanwhile those same labels are 8–10 px at 3.2:1 for
sighted users with low vision.

**Fix:** wrap the illustrative mockup in `aria-hidden="true"` (or `role="img"` + label) and stop
relying on sub-10 px text to carry meaning.

### F-12 · Form UX and data-quality gaps

**Severity: Medium · Area: UX / Data quality**

- Switching the "I am a…" audience unmounts the conditional fields, so **anything already typed is
  silently discarded** when a user toggles back and forth (`waitlist-form.tsx:125-179`).
- No `inputMode="tel"` on the phone field — users get a text keyboard.
- Email is not lowercased/normalised before it becomes data, so `A@X.com` and `a@x.com` will be two
  rows and later two verification emails.
- "State" is a free-text input with `autoComplete="address-level1"`, so you will receive
  `Lagos`, `lagos`, `LA`, `Lagos State`. Use a select of the 36 states + FCT.
- `normalizePhoneNumber` rejects `2348012345678` (no leading `+`, no leading `0`) — a very common way
  Nigerians type their number — with "include its country code". Accept the bare `234…` form.
  Everything else about that function is correct and well-handled (`waitlist-form.tsx:12-25`).

### F-13 · `globals.css` is effectively unmaintainable

**Severity: Medium · Area: Maintainability**

`src/app/globals.css` is 6 physical lines; **line 3 is 14,369 characters** of minified CSS, line 5 is
2,505. Consequences: every diff is a one-line change to a 14 kB blob, code review is impossible,
merge conflicts are unresolvable by hand, and no formatter or linter can touch it. Styles are also
split across two files (minified `globals.css` + readable `polish.css`) with overlapping concerns and
several `!important` overrides fighting each other (e.g. `.consent`, `.privacy-intro`).

**Fix:** run the file through Prettier and keep it formatted; consider CSS Modules or Tailwind for
new work. At minimum, split by section so diffs are reviewable.

### F-14 · No CI, no tests, no automated security scanning

**Severity: Medium · Area: Process**

There is no `.github/` directory at all: no workflow running `tsc`, `lint` or `build` on pull
requests, no test runner or a single test file, no Dependabot config, no CODEOWNERS, no LICENSE
(repo is public → all rights reserved by default), no `SECURITY.md`. I could not verify branch
protection on `main` (the token available to me is not permitted to read it) or whether Dependabot /
secret scanning are enabled — please confirm both in Settings.

**Fix:** add a GitHub Actions workflow (`npm ci` → `tsc --noEmit` → `npm run lint` → `npm run build`
→ `npm audit --audit-level=high`), enable Dependabot + secret scanning + push protection, require
PR review on `main`, and add an MIT/Apache LICENSE.

### F-15 · Post-submit navigation is hard-coded to `/verify`

**Severity: Medium · Area: Correctness (for when the backend lands)**

```tsx
// waitlist-form.tsx:83-84
await registerWaitlist(input);
window.location.assign("/verify");
```

Whoever reaches this line is sent to "Check your email" unconditionally. Once a real API exists, an
**already-verified** or **duplicate** registration will also be told to check their inbox, which is
wrong and, for duplicates, a small privacy tell. It is also a full document navigation rather than a
client-side route transition.

**Fix:** have `registerWaitlist()` return a discriminated result (`pending_verification` |
`already_verified` | `duplicate` | `rate_limited`) and branch on it, using
`useRouter().push()`. This is item 3 and 4 of the contract already in your README.

## Low

- **F-16** · Footer year is computed during static prerender (`waitlist-landing.tsx:88`), so
  `© 2026` is frozen at build time and will not roll over without a redeploy.
- **F-17** · `phone-mockups.tsx:25-26` uses U+3000 ideographic spaces (`All　 Pending`) and a
  fullwidth `＋`; these render inconsistently across fonts.
- **F-18** · `eslint.config.mjs` imports `@eslint/eslintrc` but it is not declared in
  `devDependencies` — it only resolves because it happens to be hoisted from eslint. Declare it.
- **F-19** · `next` is pinned exactly (`15.5.27`) while every other dependency uses `^`; inconsistent,
  and the one package you most want auto-patching is the one that can't move.
- **F-20** · No `not-found.tsx` or `error.tsx`; 404s get the unstyled Next.js default page.
- **F-21** · The Supabase EduPay project is in `eu-west-1` while your audience is Lagos. Fine for
  data-residency optics; adds ~100 ms round-trip latency per request from Nigeria.
- **F-22** · `.env.example` uses the `NEXT_PUBLIC_` prefix, so the API URL is inlined into the client
  bundle. Correct for a public endpoint — just never put a secret in a `NEXT_PUBLIC_*` variable.

---

## What's genuinely good

Worth saying, because this codebase is better than most pre-launch landing sites:

- ✅ `tsc --noEmit`, `eslint` and `next build` all pass clean on a fresh install.
- ✅ **109 kB first-load JS** and zero raster images — LCP will be text/SVG-bound and fast.
- ✅ All routes statically prerendered; nothing server-rendered per request.
- ✅ `poweredByHeader: false` and `reactStrictMode: true` in `next.config.ts`.
- ✅ No `dangerouslySetInnerHTML`, no `eval`, no `innerHTML` anywhere → no XSS surface.
- ✅ Every external `target="_blank"` link carries `rel="noopener noreferrer"`.
- ✅ No credentials anywhere in tracked files.
- ✅ All 27 tables in the Supabase `public` schema have **RLS enabled** — the main EduPay app is not
  sloppy about this, so hold the waitlist schema to the same bar.
- ✅ Real a11y thought is visible: focus-visible rings, `prefers-reduced-motion` handling,
  `role="status"` / `role="alert"` on form feedback, `aria-describedby` on the phone field,
  `aria-busy`, semantic `<main>`/`<header>`/`<nav>`/`<footer>`, correct heading order with one `h1`.
- ✅ Consent is split into two separate checkboxes (waitlist vs. marketing) rather than one bundled
  tick — that is the right legal shape.
- ✅ The form preserves the user's input when submission fails.
- ✅ The README's "Backend contract required before integration" section is an unusually disciplined
  document. Most teams ship the broken version first.

---

## Prioritised remediation plan

**P0 — before this site is allowed to collect a single signup**
1. F-1 — stand up the waitlist backend (table + verification email + resend), then implement
   `registerWaitlist()`. Until then, keep the form's honest error message.
2. F-2 — `npm install next@15.5.29`, re-run `npm audit`, enable Dependabot.
3. F-4 — add the security-headers block to `next.config.ts`.
4. F-3 — fix `.gitignore` to cover `.env`, and run a history secret scan.

**P1 — before public launch traffic**
5. F-6 → F-5 → F-7 — the accessibility trio: contrast fixes, `aria-hidden` on decorative icons, real
   mobile navigation. Target WCAG 2.1 AA.
6. F-10 — move fonts to `next/font`; removes a third-party request and a privacy exposure at once.
7. F-8 / F-9 — favicon, robots, sitemap, canonical, OG image, per-route metadata, `noindex` on
   `/success` and `/verify`.
8. F-4 (legal half) — replace the pre-launch privacy notice with approved content: controller
   identity, retention period, processors, data-rights contact, minors' consent flow, working
   unsubscribe. NDPA 2023 applies.

**P2 — engineering hygiene**
9. F-12, F-13, F-14, F-15 — form data quality, format the CSS, add CI + tests + LICENSE, fix
   post-submit routing.
10. F-16 … F-22 — the small stuff.

---

## Appendix — reproduce the checks

```bash
npm ci
npx tsc --noEmit          # ✅ clean
npm run lint              # ✅ clean
npm run build             # ✅ 7 static routes
npm audit                 # 1 critical, 1 high, 6 moderate

npm run build && npx next start -H 0.0.0.0 -p 3000
curl -sI localhost:3000/                 # headers — note what is missing
curl -s localhost:3000/ | grep -c '<svg' # 50 icons, 1 aria-hidden
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/favicon.ico  # 404
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/robots.txt   # 404
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/sitemap.xml  # 404
gitleaks detect --no-git  # secret scan (unshallow the clone first for full history)
```

**Then, against production** (I could not reach it from the sandbox): PageSpeed Insights,
SecurityHeaders.com, SSL Labs, and one screen-reader pass (NVDA or VoiceOver) on the form.
