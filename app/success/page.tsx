"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { copy as t } from "@/lib/copy";
import { verifyCheckout } from "@/lib/api";

function SuccessInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setError(t.noSession);
      return;
    }
    verifyCheckout(sessionId)
      .then(() => router.replace("/auditor"))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t.verifyFailed);
      });
  }, [params, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Stripe</p>
      <h1 className="font-display mt-3 text-5xl">{t.confirming}</h1>
      {error ? (
        <p className="mt-4 max-w-md text-high">{error}</p>
      ) : (
        <p className="mt-4 text-muted">{t.unlocking}</p>
      )}
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<main className="p-10 text-muted">{t.loading}</main>}>
      <SuccessInner />
    </Suspense>
  );
}
