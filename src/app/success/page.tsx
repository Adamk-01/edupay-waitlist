import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { WhatsAppPlaceholder } from "@/components/whatsapp-placeholder";

export const metadata: Metadata = {
  title: "You're on the list | EduPay Waitlist",
  description: "Your EduPay waitlist registration is confirmed.",
  // Only ever reached after a verified registration, so it must not be indexed.
  robots: { index: false, follow: false }
};

export default function SuccessPage() {
  return (
    <main className="success-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Back to EduPay
      </Link>
      <section className="success-card">
        <div className="success-icon">
          <CheckCircle2 size={42} aria-hidden="true" />
        </div>
        <span className="eyebrow">EDUPAY WAITLIST</span>
        <h1>You&apos;re on the list!</h1>
        <p className="success-lead">
          Thank you for completing your EduPay waitlist registration. We&apos;re
          excited to make education services easier to manage.
        </p>

        <WhatsAppPlaceholder />

        <div className="success-note">
          <Mail size={17} aria-hidden="true" /> Email launch announcements are optional and must include a
          working unsubscribe option.
        </div>
        <Link href="/" className="text-link">
          Return to the website
        </Link>
      </section>
    </main>
  );
}
