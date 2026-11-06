import { GraduationCap } from "lucide-react";
import Link from "next/link";

/**
 * `decorative` renders the mark as a non-interactive span for use inside
 * illustrative mockups — a focusable link must never sit inside an
 * `aria-hidden` container.
 */
export function Logo({ light = false, decorative = false }: { light?: boolean; decorative?: boolean }) {
  const className = `brand ${light ? "brand-light" : ""}`;

  const content = (
    <>
      <span className="brand-mark">
        <GraduationCap size={29} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span className="brand-copy">
        <strong>EduPay</strong>
        <small>Education. Made Easier.</small>
      </span>
    </>
  );

  if (decorative) {
    return (
      <span className={className} aria-hidden="true">
        {content}
      </span>
    );
  }

  return (
    <Link className={className} href="/" aria-label="EduPay home">
      {content}
    </Link>
  );
}
