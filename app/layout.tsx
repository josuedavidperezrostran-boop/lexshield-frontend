import { Cormorant_Garamond, Geist } from "next/font/google";
import { ComplianceBanner } from "@/components/ComplianceBanner";
import { copy } from "@/lib/copy";
import "./globals.css";

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
      <head>
        <title>LexShield — Riesgo contractual, antes de que se vuelva responsabilidad</title>
        <meta name="description" content={copy.zdr} />
      </head>
      <body className={`${geist.variable} ${display.variable} antialiased`}>
        <ComplianceBanner />
        {children}
      </body>
    </html>
  );
}
