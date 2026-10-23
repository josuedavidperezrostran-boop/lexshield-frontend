"use client";

import { useEffect, useState } from "react";
import { ApiError, getBillingStatus, requestRecovery } from "@/lib/api";
import { copy as t } from "@/lib/copy";

/** "Already subscribed?" form. Shows the same confirmation whatever the email, because the
 * backend never says whether an account exists. Hidden when the backend reports that it cannot
 * send mail, so nobody is told a link is on its way when none can be. */
export function RecoverAccess() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    getBillingStatus()
      .then((status) => setAvailable(status.recovery_available === true))
      .catch(() => setAvailable(false));
  }, []);

  if (available === null) return null;
  if (!available) {
    return (
      <div className="mt-6 max-w-xl rounded-sm border border-line px-4 py-4">
        <p className="text-sm text-ivory">{t.recoveryNotAvailable}</p>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestRecovery(email.trim());
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError(t.recoverTooMany);
      else if (err instanceof ApiError && err.status === 503) setError(t.recoverUnavailable);
      else if (err instanceof ApiError && err.status === 400) setError(t.recoverInvalidEmail);
      else setError(t.recoverUnavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-xl rounded-sm border border-line px-4 py-4">
      <p className="text-sm text-ivory">{t.recoverTitle}</p>
      {sent ? (
        <p className="mt-2 text-sm text-muted">{t.recoverSent}</p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.recoverPlaceholder}
            className="min-w-0 flex-1 rounded-sm border border-line bg-ink px-3 py-2 text-sm text-ivory"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="rounded-sm border border-line px-3 py-2 text-sm text-ivory hover:border-gold disabled:opacity-50"
          >
            {busy ? t.recoverSending : t.recoverSend}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-high">{error}</p>}
    </div>
  );
}
