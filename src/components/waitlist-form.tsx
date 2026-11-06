"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import {
  registerWaitlist,
  WaitlistApiError,
  WaitlistAudience,
  WaitlistRegistrationInput
} from "@/lib/waitlist-api";

function normalizePhoneNumber(value: string): string | undefined | null {
  const phone = value.trim();
  if (!phone) return undefined;

  const compact = phone.replace(/[\s().-]/g, "");
  if (/^0[789]\d{9}$/.test(compact)) {
    return `+234${compact.slice(1)}`;
  }
  if (/^\+234[789]\d{9}$/.test(compact) || /^\+[1-9]\d{7,14}$/.test(compact)) {
    return compact;
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof WaitlistApiError) {
    if (error.kind === "configuration") {
      return "Waitlist registration is not connected yet. Please check back soon.";
    }
    if (error.kind === "network") {
      return "We couldn't reach EduPay. Check your connection and try again.";
    }
  }

  return "We couldn't complete your registration. Please try again. If you have already signed up, check your inbox.";
}

export function WaitlistForm() {
  const [audience, setAudience] = useState<WaitlistAudience>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const phone = normalizePhoneNumber(String(data.get("phone") ?? ""));
    if (phone === null) {
      setError("Enter a valid phone number, including its country code, or leave it blank.");
      return;
    }

    const input: WaitlistRegistrationInput = {
      fullName: String(data.get("fullName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone,
      audienceType: audience,
      state: String(data.get("state") ?? "").trim() || undefined,
      schoolName: String(data.get("schoolName") ?? "").trim() || undefined,
      educationLevel: String(data.get("educationLevel") ?? "").trim() || undefined,
      institutionName: String(data.get("institutionName") ?? "").trim() || undefined,
      institutionType: String(data.get("institutionType") ?? "").trim() || undefined,
      contactRole: String(data.get("contactRole") ?? "").trim() || undefined,
      waitlistConsent: data.get("waitlistConsent") === "on",
      marketingConsent: data.get("marketingConsent") === "on"
    };

    if (!input.waitlistConsent) {
      setError("Please agree to the waitlist privacy notice to continue.");
      return;
    }

    setError("");
    submitting.current = true;
    setBusy(true);

    try {
      await registerWaitlist(input);
      window.location.assign("/verify");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="waitlist-form" onSubmit={submit} aria-busy={busy}>
      <div className="form-grid">
        <label>
          Full name
          <input name="fullName" autoComplete="name" placeholder="Your full name" required maxLength={120} />
        </label>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} />
        </label>
        <label>
          Phone number <span className="optional">Optional</span>
          <input name="phone" type="tel" autoComplete="tel" placeholder="+234 800 000 0000" maxLength={24} aria-describedby="phone-help" />
          <span className="field-help" id="phone-help">Include a country code. Nigerian numbers beginning with 0 are normalized to +234.</span>
        </label>
        <label>
          I am a...
          <select
            name="audienceType"
            value={audience}
            onChange={(event) => setAudience(event.target.value as WaitlistAudience)}
            required
          >
            <option value="student">Student</option>
            <option value="parent_guardian">Parent/Guardian</option>
            <option value="institution">Educational institution</option>
          </select>
        </label>
        <label>
          State <span className="optional">Optional</span>
          <input name="state" autoComplete="address-level1" placeholder="Your state" maxLength={80} />
        </label>
        {audience === "student" && (
          <>
            <label>
              School name
              <input name="schoolName" placeholder="Your school" required maxLength={160} />
            </label>
            <label>
              Education level
              <select name="educationLevel" defaultValue="" required>
                <option value="" disabled>Choose level</option>
                <option>Primary</option>
                <option>Secondary school</option>
                <option>Undergraduate</option>
                <option>Postgraduate</option>
                <option>Other</option>
              </select>
            </label>
          </>
        )}
        {audience === "parent_guardian" && (
          <label>
            Learner&apos;s education level <span className="optional">Optional</span>
            <select name="educationLevel" defaultValue="">
              <option value="">Choose level</option>
              <option>Primary</option>
              <option>Secondary school</option>
              <option>Undergraduate</option>
              <option>Postgraduate</option>
              <option>Other</option>
            </select>
          </label>
        )}
        {audience === "institution" && (
          <>
            <label>
              Institution name
              <input name="institutionName" placeholder="Name of institution" required maxLength={160} />
            </label>
            <label>
              Institution type
              <select name="institutionType" defaultValue="" required>
                <option value="" disabled>Choose type</option>
                <option>School</option>
                <option>College / Polytechnic</option>
                <option>University</option>
                <option>Education agency</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Contact person&apos;s role
              <input name="contactRole" placeholder="e.g. Administrator" required maxLength={100} />
            </label>
          </>
        )}
      </div>

      <label className="consent">
        <input type="checkbox" name="waitlistConsent" required />
        <span>
          I agree that EduPay may use my details to manage my waitlist registration. I have read the{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">privacy notice</a>.
        </span>
      </label>
      <label className="consent optional-consent">
        <input type="checkbox" name="marketingConsent" />
        <span>I&apos;d like to receive optional EduPay launch announcements by email. I can unsubscribe from these emails.</span>
      </label>

      <button className="button button-primary form-submit" type="submit" disabled={busy}>
        {busy ? <><LoaderCircle className="spin" size={18} aria-hidden="true" /> Joining...</> : <>Join the Waitlist <ArrowRight size={18} aria-hidden="true" /></>}
      </button>
      {busy && <p className="form-status" role="status">Submitting your registration...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="form-security">Only the information needed for your waitlist registration is requested.</p>
    </form>
  );
}
