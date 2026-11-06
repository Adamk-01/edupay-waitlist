import type { Metadata } from "next";
import "./globals.css";
import "./polish.css";

export const metadata: Metadata = {
  title: "EduPay Waitlist | Education services. Made easier.",
  description:
    "Join the EduPay waitlist and be among the first to hear when easier education services arrive.",
  metadataBase: new URL("https://waitlist.edupayafrica.com.ng"),
  openGraph: {
    title: "EduPay Waitlist",
    description: "Education services. Made easier.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
