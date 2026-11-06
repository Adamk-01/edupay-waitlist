import { FileText, GraduationCap, Search, Wallet, Clock3, CheckCircle2, FolderOpen } from "lucide-react";

export function PhoneMockups() {
  return (
    <div className="phone-stage" role="img" aria-label="Illustrative preview of the EduPay mobile experience">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="phone phone-home">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-top"><span className="mini-brand"><GraduationCap size={17}/> EduPay</span><Search size={16}/></div>
          <p className="phone-greeting">Good morning,<br/><b>Student 👋</b></p>
          <div className="phone-banner"><small>YOUR EDUCATION JOURNEY</small><b>Everything you need, in one place.</b><span>Explore services →</span></div>
          <div className="phone-section-title">Our Services <small>View all</small></div>
          <div className="phone-service-grid">
            <div><FileText/><b>School Forms</b></div><div><GraduationCap/><b>JAMB Services</b></div>
            <div><CheckCircle2/><b>Certificates</b></div><div><FolderOpen/><b>Results & Docs</b></div>
          </div>
          <div className="phone-balance"><span>Wallet balance</span><b>₦12,500.00</b><small><Wallet size={12}/> Secure payments</small></div>
        </div>
      </div>
      <div className="phone phone-orders">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-top"><b>My Orders</b><span>＋</span></div>
          <div className="order-tabs">All　 Pending　 In progress</div>
          <div className="order-card"><small>JAMB SERVICES</small><b>JAMB Registration</b><span className="status status-progress">In progress</span><div className="order-foot"><Clock3 size={13}/> Track request →</div></div>
          <div className="order-card"><small>DOCUMENTS</small><b>Certificate Processing</b><span className="status status-done">Completed</span><div className="order-foot"><CheckCircle2 size={13}/> View details →</div></div>
          <div className="order-card"><small>EDUPAY VAULT</small><b>My Documents</b><span className="document-row"><FileText size={15}/> Result statement.pdf</span><span className="document-row"><FileText size={15}/> Certificate.pdf</span></div>
        </div>
      </div>
      <div className="float-chip chip-secure"><CheckCircle2 size={16}/> Secure & reliable</div>
      <div className="float-chip chip-track"><Clock3 size={16}/> Track your requests</div>
    </div>
  );
}
