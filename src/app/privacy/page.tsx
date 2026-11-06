import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Waitlist Privacy Notice | EduPay",
  description: "Information about the data requested by the EduPay Waitlist."
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <div className="container privacy-nav">
          <Logo />
          <Link href="/" className="privacy-back"><ArrowLeft size={17} aria-hidden="true" /> Back to EduPay</Link>
        </div>
      </header>
      <article className="privacy-content">
        <span className="eyebrow">EDUPAY WAITLIST</span>
        <h1>Waitlist privacy notice</h1>
        <p className="privacy-intro">
          This page explains the information requested by the current waitlist form and how it is intended to be used.
        </p>
        <aside className="privacy-review-note">
          <strong>Pre-launch notice — legal approval is still required.</strong>
          <p>
            EduPay&apos;s data controller details, retention period, service providers, data-rights process and requirements for
            registrations involving minors have not yet been confirmed. This notice must be reviewed and approved before live
            registration is enabled.
          </p>
        </aside>

        <section>
          <h2>Information the form requests</h2>
          <p>
            The form asks for your name, email address, audience type and waitlist consent. Phone number and state are optional.
            Depending on your audience, it may also ask for a student&apos;s school and education level, a learner&apos;s education
            level, or an institution&apos;s name, type and contact person&apos;s role. Optional email announcement consent is
            recorded separately from waitlist consent.
          </p>
          <p>Please do not enter sensitive personal information in the waitlist form.</p>
        </section>

        <section>
          <h2>Why this information is requested</h2>
          <p>
            The information is intended to manage a waitlist registration and, only if you separately opt in, send EduPay
            launch announcements by email. A verification email may be needed to confirm an address once the backend
            verification flow is agreed and enabled.
          </p>
          <p>
            Joining this waitlist does not create a customer account, wallet account or customer payment record.
          </p>
        </section>

        <section>
          <h2>Email and WhatsApp updates</h2>
          <p>
            Email launch announcements are optional and separate from waitlist registration. Announcement emails must include
            a working unsubscribe mechanism before launch. Joining the official{" "}
            <a href="https://whatsapp.com/channel/0029VbByeNR47XeEqQcE803V" target="_blank" rel="noopener noreferrer">
              EduPay WhatsApp Channel
            </a>{" "}
            is optional and is not consent to receive email.
          </p>
        </section>

        <section>
          <h2>Students and minors</h2>
          <p>
            The waitlist may be used by students who are minors. Before registration is enabled, EduPay must obtain legal
            review of the applicable age threshold, parental or guardian consent requirements, the information collected from
            minors and the appropriate notice and consent flow.
          </p>
        </section>

        <section>
          <h2>Storage, retention and your choices</h2>
          <p>
            The backend storage location, people or providers who can access waitlist data, retention period, deletion process
            and contact for privacy requests have not been confirmed for this frontend phase. These details must be supplied
            and approved before collecting live registrations. Do not treat this pre-launch page as a statement that these
            arrangements are already in place.
          </p>
        </section>

        <section>
          <h2>Questions</h2>
          <p>
            For questions about the waitlist, contact{" "}
            <a href="mailto:support@edupayafrica.com.ng">support@edupayafrica.com.ng</a>.
          </p>
        </section>
        <p className="privacy-footer-note">This pre-launch notice is not the approved production privacy policy.</p>
      </article>
    </main>
  );
}
