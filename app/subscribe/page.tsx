"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, confirmEmailCheckout } from "@/lib/api";
import { copy as t } from "@/lib/copy";

/** Landing page of the emailed subscribe link: /subscribe#code=… The code stays in the fragment
 * and is removed from the address bar at once. A verified email goes to Stripe Checkout, or
 * straight to the auditor when it already had a subscription. */
export default function SubscribePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      setError(t.recoverLinkInvalid);
      return;
    }
    confirmEmailCheckout(code)
      .then((checkoutUrl) => {
        if (checkoutUrl) window.location.href = checkoutUrl;
        else router.replace("/auditor");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) router.replace("/auditor");
        else if (err instanceof ApiError && (err.status === 503 || err.status === 429)) setError(t.newCheckoutUnavailable);
        else setError(t.recoverLinkInvalid);
      });
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-5xl">{t.recoverHeading}</h1>
      <p className={`mt-4 max-w-md ${error ? "text-high" : "text-muted"}`}>{error ?? t.redirecting}</p>
    </main>
  );
}
