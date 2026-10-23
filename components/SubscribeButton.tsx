"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/api";
import { copy as t } from "@/lib/copy";

type Props = {
  label?: string;
  className?: string;
  allowed?: boolean;
};

export function SubscribeButton({
  label,
  className = "rounded-sm border border-gold/70 bg-gold px-4 py-2 text-sm font-medium tracking-wide text-ink transition hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-40",
  allowed = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !allowed || busy;

  async function subscribe() {
    if (!allowed || busy) return;
    setBusy(true);
    setError(null);
    try {
      window.location.href = await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.checkoutFailed);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={subscribe}
        disabled={locked}
        aria-disabled={locked}
        className={`${className} disabled:pointer-events-none`}
      >
        {busy ? t.redirecting : label ?? t.subscribe}
      </button>
      {error && <p className="text-xs text-high">{error}</p>}
    </div>
  );
}
