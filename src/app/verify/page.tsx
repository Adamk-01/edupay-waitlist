import Link from "next/link";
import { VerificationStateView } from "@/components/verification-state";

export default function VerifyPage() {
  return (
    <main className="success-page">
      <Link href="/" className="back-link">Back to EduPay</Link>
      <VerificationStateView state="in_progress" />
    </main>
  );
}
