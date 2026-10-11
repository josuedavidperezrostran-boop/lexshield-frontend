"use client";

import { useEffect, useId, useRef, useState } from "react";
import { copy as t } from "@/lib/copy";

const items = [
  {
    title: t.legendHigh,
    body: t.legendHighBody,
    dot: "bg-high",
    ring: "border-high/40",
  },
  {
    title: t.legendMedium,
    body: t.legendMediumBody,
    dot: "bg-medium",
    ring: "border-medium/40",
  },
  {
    title: t.legendOmission,
    body: t.legendOmissionBody,
    dot: "bg-gold",
    ring: "border-line",
  },
];

export function ColorLegend() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const visible = open || pinned;

  useEffect(() => {
    if (!pinned) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={t.legendLabel}
        aria-expanded={visible}
        aria-controls={panelId}
        onClick={() => {
          setPinned((current) => {
            const next = !current;
            setOpen(next);
            return next;
          });
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-ink-2 text-sm text-gold transition hover:border-gold"
      >
        ⓘ
      </button>
      {visible && (
        <div
          id={panelId}
          role="tooltip"
          className="absolute left-0 z-30 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-md border border-line bg-ink-2 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">{t.legendLabel}</p>
          <ul className="mt-3 space-y-3">
            {items.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${item.dot} ${item.ring}`}
                />
                <span>
                  <span className="block text-sm text-ivory">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
