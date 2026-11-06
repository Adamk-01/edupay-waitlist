import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleHelp, Clock3, LoaderCircle } from "lucide-react";

export type VerificationState = "in_progress" | "verified" | "expired" | "invalid";

const stateContent = {
  in_progress: {
    icon: LoaderCircle,
    title: "Check your email",
    description: "If your registration was accepted, an email with a verification link should arrive shortly. Check your spam or junk folder too.",
    action: null
  },
  verified: {
    icon: CheckCircle2,
    title: "Your email is verified",
    description: "Your email address has been confirmed. You can continue to the EduPay waitlist success page.",
    action: { href: "/success", label: "Continue" }
  },
  expired: {
    icon: Clock3,
    title: "This link has expired",
    description: "Start a new waitlist registration or contact EduPay for help. A resend option will be available if supported by the verification service.",
    action: { href: "/#join", label: "Return to the waitlist" }
  },
  invalid: {
    icon: CircleHelp,
    title: "This link could not be verified",
    description: "Check that you opened the complete verification link from your latest email. You can return to the waitlist or contact EduPay for help.",
    action: { href: "/#join", label: "Return to the waitlist" }
  }
} satisfies Record<VerificationState, {
  icon: typeof LoaderCircle;
  title: string;
  description: string;
  action: { href: string; label: string } | null;
}>;

export function VerificationStateView({ state }: { state: VerificationState }) {
  const content = stateContent[state];
  const Icon = content.icon;

  return (
    <section className="success-card verification-card" aria-live="polite">
      <div className={`success-icon verification-icon verification-icon-${state}`}>
        <Icon size={42} aria-hidden="true" />
      </div>
      <span className="eyebrow">EDUPAY EMAIL VERIFICATION</span>
      <h1>{content.title}</h1>
      <p className="success-lead">{content.description}</p>
      {content.action ? (
        <Link href={content.action.href} className="button button-primary verification-action">
          {content.action.label} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      ) : (
        <Link href="/" className="text-link">Back to EduPay</Link>
      )}
      <p className="verification-help">
        Need help? <a href="mailto:support@edupayafrica.com.ng">Contact EduPay support</a>.
      </p>
    </section>
  );
}
