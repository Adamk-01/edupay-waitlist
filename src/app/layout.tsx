import type { Metadata } from "next";
import "./globals.css";
import "./polish.css";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "EduPay Waitlist | Education services. Made easier.",
  description:
    "Join the EduPay waitlist and be among the first to hear when easier education services arrive.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "EduPay Waitlist",
    description: "Education services. Made easier.",
    type: "website",
    url: "/",
    siteName: "EduPay Waitlist"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
