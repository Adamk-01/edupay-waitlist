import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { VerificationStateView } from "@/components/verification-state";
import { VerifyTokenHandler } from "@/components/verify-token-handler";

export const metadata: Metadata = {
  title: "Check your email | EduPay Waitlist",
  description: "Confirm your email address to complete your EduPay waitlist registration.",
  // Verification screens are per-person and must never be indexed.
  robots: { index: false, follow: false }
};

export default function VerifyPage() {
  return (
    <main className="success-page">
      <Link href="/" className="back-link">
        Back to EduPay
      </Link>
      <Suspense fallback={<VerificationStateView state="in_progress" />}>
        <VerifyTokenHandler />
      </Suspense>
    </main>
  );
}
