"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RecoverAccess } from "@/components/RecoverAccess";
import { ApiError, confirmRecovery } from "@/lib/api";
import { copy as t } from "@/lib/copy";

/** Landing page of the emailed link: /recover#code=… The code travels in the fragment, so it is
 * never sent in a request line or Referer; it is removed from the address bar at once. */
export default function RecoverPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      setError(t.recoverLinkInvalid);
      return;
    }
    confirmRecovery(code)
      .then(() => router.replace("/auditor"))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) setError(t.recoverNoSubscription);
        else if (err instanceof ApiError && (err.status === 503 || err.status === 429)) setError(t.recoverUnavailable);
        else setError(t.recoverLinkInvalid);
      });
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-5xl">{t.recoverHeading}</h1>
      {error ? (
        <div className="flex flex-col items-center">
          <p className="mt-4 max-w-md text-high">{error}</p>
          <RecoverAccess />
        </div>
      ) : (
        <p className="mt-4 text-muted">{t.unlocking}</p>
      )}
    </main>
  );
}
