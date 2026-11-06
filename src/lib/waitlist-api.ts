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

export type WaitlistRegistrationResponse = unknown;

export type WaitlistApiErrorKind = "configuration" | "network" | "http";

export class WaitlistApiError extends Error {
  constructor(readonly kind: WaitlistApiErrorKind) {
    super(kind);
    this.name = "WaitlistApiError";
  }
}

export const waitlistApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_EDUPAY_API_URL?.trim() || null
} as const;

export async function registerWaitlist(input: WaitlistRegistrationInput): Promise<void> {
  void input;
  throw new WaitlistApiError("configuration");
}
