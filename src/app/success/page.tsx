import Link from "next/link";
import { CheckCircle2, MessageCircle, Mail, ArrowLeft } from "lucide-react";

const WHATSAPP_CHANNEL =
  "https://whatsapp.com/channel/0029VbByeNR47XeEqQcE803V";

export default function SuccessPage() {
  return (
    <main className="success-page">
      <Link href="/" className="back-link"><ArrowLeft size={17} /> Back to EduPay</Link>
      <section className="success-card">
        <div className="success-icon"><CheckCircle2 size={42} /></div>
        <span className="eyebrow">EDUPAY WAITLIST</span>
        <h1>You&apos;re on the list!</h1>
        <p className="success-lead">
          Thank you for completing your EduPay waitlist registration. We&apos;re
          excited to make education services easier to manage.
        </p>
        <div className="whatsapp-panel">
          <div className="whatsapp-icon"><MessageCircle size={25} /></div>
          <div>
            <h2>Stay connected with EduPay</h2>
            <p>Join our official WhatsApp Channel for product news, helpful updates and our launch announcement.</p>
          </div>
          <a className="button button-whatsapp" href={WHATSAPP_CHANNEL} target="_blank" rel="noopener noreferrer">
            Join WhatsApp Channel <MessageCircle size={17} />
          </a>
          <small>Joining the channel is optional and does not affect your waitlist registration.</small>
        </div>
        <div className="success-note"><Mail size={17} /> Email launch announcements are optional and must include a working unsubscribe option.</div>
        <Link href="/" className="text-link">Return to the website</Link>
      </section>
    </main>
  );
}
