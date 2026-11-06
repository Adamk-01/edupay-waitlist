import { GraduationCap } from "lucide-react";
import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand ${light ? "brand-light" : ""}`} href="/" aria-label="EduPay home">
      <span className="brand-mark"><GraduationCap size={29} strokeWidth={2.4} /></span>
      <span className="brand-copy"><strong>EduPay</strong><small>Education. Made Easier.</small></span>
    </Link>
  );
}
