"use client";

import { useState } from "react";
import {
  ApiError,
  getBillingStatus,
  getToken,
  openBillingPortal,
  startCheckout,
  startEmailCheckout,
} from "@/lib/api";
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
  // Visitors without a session verify their email before any payment link exists.
  const [askEmail, setAskEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const locked = !allowed || busy;

  async function subscribe() {
    if (!allowed || busy) return;
    setBusy(true);
    setError(null);
    setExisting(false);
    if (!getToken()) {
      try {
        const status = await getBillingStatus();
        if (status.new_checkout_available === false) setError(t.newCheckoutUnavailable);
        else setAskEmail(true);
      } catch {
        setError(t.newCheckoutUnavailable);
      }
      setBusy(false);
      return;
    }
    try {
      window.location.href = await startCheckout();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Never a second subscription: send the customer to manage the one they have.
        setExisting(true);
        setError(t.subscriptionExists);
      } else if (err instanceof ApiError && err.status === 401) {
        // The stored session is no longer valid: verify the email instead.
        setAskEmail(true);
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t.stripeUnavailable);
      } else {
        setError(err instanceof Error ? err.message : t.checkoutFailed);
      }
      setBusy(false);
    }
  }

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await startEmailCheckout(email.trim());
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError(t.recoverTooMany);
      else if (err instanceof ApiError && err.status === 400) setError(t.recoverInvalidEmail);
      else setError(t.newCheckoutUnavailable);
    } finally {
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
      {!askEmail && (
        <button
          type="button"
          onClick={subscribe}
          disabled={locked}
          aria-disabled={locked}
          className={`${className} disabled:pointer-events-none`}
        >
          {busy ? t.redirecting : label ?? t.subscribe}
        </button>
      )}
      {askEmail && !sent && (
        <form onSubmit={sendLink} className="flex w-full flex-col gap-2">
          <p className="text-xs text-muted">{t.subscribeEmailPrompt}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.recoverPlaceholder}
              className="min-w-0 flex-1 rounded-sm border border-line bg-ink px-3 py-2 text-sm text-ivory"
            />
            <button type="submit" disabled={busy || !email.trim()} className={className}>
              {busy ? t.recoverSending : t.subscribeEmailSend}
            </button>
          </div>
        </form>
      )}
      {sent && <p className="text-xs text-muted">{t.subscribeEmailSent}</p>}
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
