"use client";

import Link from "next/link";
import { copy as t } from "@/lib/copy";

type Props = {
  compact?: boolean;
};

export function SiteHeader({ compact = false }: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-ink-2 font-display text-lg text-ivory">
          L
        </span>
        <span>
          <span className="block font-display text-xl leading-none tracking-wide">
            LexShield
          </span>
          {!compact && (
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
              {t.brandTag}
            </span>
          )}
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/auditor"
          className="hidden text-sm text-muted transition hover:text-ivory sm:inline"
        >
          {t.openAuditor}
        </Link>
        <Link
          href="/#pricing"
          className="rounded-sm border border-gold/70 bg-gold px-4 py-2 text-sm font-medium tracking-wide text-ink transition hover:bg-ivory"
        >
          {t.subscribe}
        </Link>
      </div>
    </header>
  );
}
