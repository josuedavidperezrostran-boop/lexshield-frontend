"use client";

import Link from "next/link";
import { LegalShield } from "@/components/LegalShield";
import { copy as t } from "@/lib/copy";

export default function CancelPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">{t.cancelled}</p>
      <h1 className="font-display mt-3 text-5xl">{t.noCharge}</h1>
      <p className="mt-4 max-w-md text-muted">{t.stillGated}</p>
      <div className="mt-8 flex w-full max-w-xl flex-col items-center gap-4">
        <LegalShield label={t.returnCheckout} />
        <Link href="/" className="text-sm text-muted hover:text-ivory">
          {t.backHome}
        </Link>
      </div>
    </main>
  );
}
