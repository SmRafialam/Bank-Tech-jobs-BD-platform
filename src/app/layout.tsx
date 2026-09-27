import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import "./globals.css";

const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "BankTech Jobs BD — IT jobs at Bangladeshi banks, NBFIs and fintechs",
    template: "%s | BankTech Jobs BD",
  },
  description:
    "Find IT Officer, software engineer, application support, network, security, data and digital banking jobs at Bangladeshi banks, NBFIs, fintechs and government recruiters — with deadline tracking and eligibility checks.",
  applicationName: "BankTech Jobs BD",
  openGraph: {
    type: "website",
    siteName: "BankTech Jobs BD",
    locale: "en_BD",
    title: "BankTech Jobs BD",
    description: "Technology jobs at banks, NBFIs and fintechs in Bangladesh — deadlines, eligibility and alerts.",
  },
  twitter: { card: "summary" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0b1f4d",
  width: "device-width",
  initialScale: 1,
};

// Every page reads fresh data from PostgreSQL (and the session cookie), so render on request.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
