export type WaitlistAudience = "student" | "parent_guardian" | "institution";

export interface WaitlistRegistrationInput {
  fullName: string;
  email: string;
  phone?: string;
  audienceType: WaitlistAudience;
  state?: string;
  schoolName?: string;
  educationLevel?: string;
  institutionName?: string;
  institutionType?: string;
  contactRole?: string;
  waitlistConsent: boolean;
  marketingConsent: boolean;
}

/**
 * Outcome of an accepted registration request.
 *
 * `pending_verification` covers three server-side cases on purpose — a brand
 * new signup, an email that is already pending, and an email that is not
 * registered at all — so the response cannot be used to discover whether
 * somebody joined. Only an already-verified address is distinguished, because
 * the frontend must not send that person back to "check your email".
 */
export type WaitlistRegistrationResult =
  | { status: "pending_verification" }
  | { status: "already_verified" };

export type WaitlistVerificationState = "in_progress" | "verified" | "expired" | "invalid";

export type WaitlistApiErrorKind =
  | "configuration"
  | "network"
  | "rate_limited"
  | "invalid"
  | "http";

export class WaitlistApiError extends Error {
  constructor(readonly kind: WaitlistApiErrorKind) {
    super(kind);
    this.name = "WaitlistApiError";
  }
}

/**
 * NEXT_PUBLIC_* values are inlined into the client bundle at build time.
 * This is only ever a public API base URL — never put a secret in one.
 */
export const waitlistApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_EDUPAY_API_URL?.trim() || null
} as const;

type WaitlistAction = "register" | "verify" | "resend";

async function postWaitlistAction(
  action: WaitlistAction,
  payload: object
): Promise<Record<string, unknown>> {
  const baseUrl = waitlistApiConfig.baseUrl;
  // Still unset = the backend has not been switched on for this environment.
  if (!baseUrl) throw new WaitlistApiError("configuration");

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, "")}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      cache: "no-store"
    });
  } catch {
    throw new WaitlistApiError("network");
  }

  if (response.status === 429) throw new WaitlistApiError("rate_limited");
  if (response.status === 400 || response.status === 413) throw new WaitlistApiError("invalid");
  if (!response.ok) throw new WaitlistApiError("http");

  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new WaitlistApiError("http");
  }
}

export async function registerWaitlist(
  input: WaitlistRegistrationInput
): Promise<WaitlistRegistrationResult> {
  const body = await postWaitlistAction("register", input);

  if (body.status === "already_verified") return { status: "already_verified" };
  if (body.status === "pending_verification") return { status: "pending_verification" };

  // An unrecognised success payload is a contract violation, not a success.
  throw new WaitlistApiError("http");
}

export async function verifyWaitlistToken(token: string): Promise<WaitlistVerificationState> {
  const body = await postWaitlistAction("verify", { token });
  const state = body.state;

  return state === "verified" || state === "expired" || state === "invalid" ? state : "invalid";
}

/** Always resolves for any well-formed email, whether or not it is registered. */
export async function resendWaitlistVerification(email: string): Promise<void> {
  await postWaitlistAction("resend", { email });
}
