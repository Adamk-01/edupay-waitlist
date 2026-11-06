import {
  ArrowRight,
  ArrowDown,
  FileText,
  Award,
  Headset,
  Landmark,
  FolderOpen,
  Search,
  ClipboardList,
  CreditCard,
  Clock3,
  CheckCircle2,
  Users,
  ShieldCheck,
  Zap,
  GraduationCap,
  ChevronDown
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PhoneMockups } from "@/components/phone-mockups";
import { SiteNav } from "@/components/site-nav";
import { WaitlistForm } from "@/components/waitlist-form";

const services = [
  { title: "School Forms", detail: "Access essential school application forms.", icon: FileText },
  { title: "Certificate Processing", detail: "Get help with certificate-related requests.", icon: Award },
  { title: "Consultation", detail: "Connect with education support and guidance.", icon: Headset },
  { title: "JAMB Services", detail: "Get support with relevant JAMB services.", icon: Landmark },
  { title: "Results & Documents", detail: "Access result and document services.", icon: FolderOpen }
];
const steps = [
  { title: "Discover", text: "Find the education service you need.", icon: Search },
  { title: "Request", text: "Tell us what you need.", icon: ClipboardList },
  { title: "Pay", text: "Make payments through a clear process.", icon: CreditCard },
  { title: "Track", text: "Follow the progress of your request.", icon: Clock3 },
  { title: "Receive", text: "Get your completed service or result.", icon: CheckCircle2 },
  { title: "Store", text: "Keep important items in your EduPay Vault.", icon: FolderOpen }
];
const faqs = [
  ["What is EduPay?", "EduPay is an education services platform designed to make it easier to discover, request, pay for and track essential education services."],
  ["When will EduPay launch?", "We will announce the launch through our official communication channels and by email to people who opt in to launch announcements."],
  ["Is joining the waitlist free?", "Yes. Joining the waitlist is free and does not create a customer account or wallet."],
  ["Does joining guarantee that every service is available immediately?", "Service availability may vary. We will communicate the services available when EduPay launches."],
  ["How will I receive updates?", "Email launch announcements are optional and separate from joining the waitlist. Any launch announcement email must include a working unsubscribe option. Joining our WhatsApp Channel is also optional."]
];

export function WaitlistLanding() {
  return (
    <main>
      <SiteNav />

      <section className="hero" id="home">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="pill"><span /> EduPay is coming</span>
            <h1>Education services.<br />Made <em>easier.</em></h1>
            <p className="hero-lead">From school forms and JAMB services to certificate processing and results documents, EduPay is bringing essential education services together in one place.</p>
            <div className="hero-actions">
              <a href="#join" className="button button-primary button-large">Join the Waitlist <ArrowRight size={19} aria-hidden="true" /></a>
              <a href="#about" className="discover-link"><span><ArrowDown size={18} aria-hidden="true" /></span> Discover EduPay</a>
            </div>
            <div className="trust-points">
              <span><GraduationCap aria-hidden="true" /> Education-focused</span>
              <span><Zap aria-hidden="true" /> Simple to use</span>
              <span><Users aria-hidden="true" /> For everyone</span>
            </div>
          </div>
          <PhoneMockups />
        </div>
      </section>

      <section className="services-section section-pad" id="services">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">WHAT YOU CAN DO WITH EDUPAY</span>
            <h2>Explore EduPay services</h2>
            <p>Education support, brought together in one convenient place.</p>
          </div>
          <div className="service-grid">
            {services.map(({ title, detail, icon: Icon }) => (
              <article className="service-card" key={title}>
                <span className="service-icon"><Icon size={27} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="journey-section">
        <div className="container journey-panel">
          <div className="journey-intro">
            <span className="eyebrow">A CLEARER EXPERIENCE</span>
            <h2>How EduPay works</h2>
            <p>Getting started is simple. Follow your request from beginning to end.</p>
          </div>
          <div className="steps-grid">
            {steps.map(({ title, text, icon: Icon }, index) => (
              <div className="step" key={title}>
                <span className="step-number" aria-hidden="true">{index + 1}</span>
                <Icon size={29} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section section-pad" id="about">
        <div className="container about-grid">
          <div className="about-copy">
            <span className="eyebrow">A BETTER WAY TO MANAGE EDUCATION REQUESTS</span>
            <h2>One place for your education needs.</h2>
            <p>EduPay is designed to make education services easier to find and simpler to manage. Submit a request, follow its progress and keep important documents organised.</p>
            <a href="#join" className="button button-primary">Be part of what&apos;s next <ArrowRight size={17} aria-hidden="true" /></a>
          </div>

          <div className="feature-visual" aria-hidden="true">
            <div className="feature-document">
              <div className="feature-doc-head"><Logo decorative /><span className="doc-badge">EDUPAY VAULT</span></div>
              <div className="doc-line short" />
              <div className="doc-line" />
              <div className="doc-line medium" />
              <div className="doc-file"><FileText /><span><b>Academic document</b><small>Keep in one place</small></span><CheckCircle2 /></div>
              <div className="doc-file"><Award /><span><b>Certificate record</b><small>Available in your vault</small></span><CheckCircle2 /></div>
            </div>
            <div className="feature-stamp"><GraduationCap size={27} /><b>Education.<br />Made Easier.</b></div>
          </div>

          <div className="audience-card">
            <span className="eyebrow">BUILT FOR THE EDUCATION COMMUNITY</span>
            <h2>Who it&apos;s for</h2>
            <p>Whether you&apos;re pursuing your education or supporting someone else, EduPay is being built with you in mind.</p>
            <div className="audience-grid">
              <span><GraduationCap aria-hidden="true" />Students</span>
              <span><Users aria-hidden="true" />Parents</span>
              <span><ShieldCheck aria-hidden="true" />Guardians</span>
              <span><Landmark aria-hidden="true" />Institutions</span>
            </div>
          </div>
        </div>
      </section>

      <section className="join-faq-section section-pad" id="join">
        <div className="container join-grid">
          <div className="join-panel">
            <span className="pill pill-light"><span /> BE PART OF WHAT&apos;S NEXT</span>
            <h2>Join the EduPay Waitlist</h2>
            <p>Be among the first to hear when EduPay launches. Sign up for updates and stay connected.</p>
            <WaitlistForm />
          </div>
          <div className="faq-panel" id="faqs">
            <span className="eyebrow">NEED TO KNOW MORE?</span>
            <h2>Frequently asked questions</h2>
            <div className="faq-list">
              {faqs.map(([question, answer]) => (
                <details className="faq-item" key={question}>
                  <summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-main">
          <Logo light />
          <div className="footer-links">
            <a href="#about">About EduPay</a>
            <a href="#services">Services</a>
            <a href="/privacy">Privacy notice</a>
            <a href="#faqs">FAQs</a>
            <a href="mailto:support@edupayafrica.com.ng">Contact</a>
          </div>
          <p>© {new Date().getFullYear()} EduPay. All rights reserved.</p>
        </div>
        <div className="footer-bottom">EduPay is an education services platform. Service availability will be communicated at launch.</div>
      </footer>
    </main>
  );
}
