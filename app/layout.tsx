import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { ComplianceBanner } from "@/components/ComplianceBanner";
import { copy } from "@/lib/copy";
import "./globals.css";

const DEFAULT_SITE_URL = "https://frontend-1-lex-shield2.vercel.app";

function siteUrl(): URL {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return new URL(configured || DEFAULT_SITE_URL);
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "LexShield — Riesgo contractual, antes de que se vuelva responsabilidad",
  description: copy.zdr,
  alternates: {
    canonical: "/",
  },
};

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geist.variable} ${display.variable} antialiased`}>
        <ComplianceBanner />
        {children}
      </body>
    </html>
  );
}
