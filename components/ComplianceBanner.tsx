import { copy } from "@/lib/copy";

export function ComplianceBanner() {
  return (
    <aside className="border-b border-line bg-ink-2">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3 lg:px-6">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-gold"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="5" y="11" width="14" height="9" rx="1.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <p className="text-xs leading-5 tracking-wide text-ivory/90">{copy.privacyBanner}</p>
      </div>
    </aside>
  );
}
