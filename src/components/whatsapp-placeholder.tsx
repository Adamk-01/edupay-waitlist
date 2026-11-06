import { MessageCircle } from "lucide-react";
import { WHATSAPP_CHANNEL } from "@/lib/site";

/**
 * Optional invitation to the official EduPay WhatsApp Channel.
 *
 * Shown immediately after a waitlist submission so a new subscriber has a
 * useful next step while they wait for the verification email. It is always
 * presented as optional and as unrelated to the registration itself.
 */
export function WhatsAppPlaceholder() {
  return (
    <section className="whatsapp-panel" aria-labelledby="whatsapp-heading">
      <div className="whatsapp-icon">
        <MessageCircle size={25} aria-hidden="true" />
      </div>
      <div>
        <h2 id="whatsapp-heading">Stay connected with EduPay</h2>
        <p>
          While you wait, join our official WhatsApp Channel for product news, helpful updates and our
          launch announcement.
        </p>
      </div>
      <a className="button button-whatsapp" href={WHATSAPP_CHANNEL} target="_blank" rel="noopener noreferrer">
        Join WhatsApp Channel <MessageCircle size={17} aria-hidden="true" />
      </a>
      <small>Joining the channel is optional and does not affect your waitlist registration.</small>
    </section>
  );
}
