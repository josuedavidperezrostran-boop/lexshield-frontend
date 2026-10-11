"use client";

import { useState } from "react";
import { SubscribeButton } from "@/components/SubscribeButton";
import { copy as t } from "@/lib/copy";

type Props = {
  label: string;
  className?: string;
};

export function LegalShield({ label, className }: Props) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ivory">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#d7dde6]"
        />
        <span>{t.acceptTerms}</span>
      </label>
      <div className="max-h-36 overflow-y-auto rounded-sm border border-line bg-ink px-3 py-3 text-xs leading-relaxed text-muted">
        {t.disclaimer}
      </div>
      <SubscribeButton label={label} className={className} allowed={accepted} />
    </div>
  );
}
