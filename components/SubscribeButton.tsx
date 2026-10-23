"use client";

import { useState } from "react";
import { ApiError, openBillingPortal, startCheckout } from "@/lib/api";
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
  const [existing, setExisting] = useState(false);
  const locked = !allowed || busy;

  async function subscribe() {
    if (!allowed || busy) return;
    setBusy(true);
    setError(null);
    setExisting(false);
    try {
      window.location.href = await startCheckout();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Never a second subscription: send the customer to manage the one they have.
        setExisting(true);
        setError(t.subscriptionExists);
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t.stripeUnavailable);
      } else {
        setError(err instanceof Error ? err.message : t.checkoutFailed);
      }
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    try {
      window.location.href = await openBillingPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.portalFailed);
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
      {existing && (
        <button
          type="button"
          onClick={manage}
          disabled={busy}
          className="rounded-sm border border-line px-3 py-2 text-sm text-ivory hover:border-gold disabled:opacity-50"
        >
          {t.manage}
        </button>
      )}
    </div>
  );
}
