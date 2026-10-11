"use client";

import { LegalShield } from "@/components/LegalShield";
import { SiteHeader } from "@/components/SiteHeader";
import { copy as t } from "@/lib/copy";

export default function HomePage() {
  const pillars = [
    { title: t.pillarZdr, body: t.zdr },
    { title: t.pillarScan, body: t.pillarScanBody },
    { title: t.pillarDraft, body: t.pillarDraftBody },
  ];
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.35em] text-gold">
          {t.eyebrow}
        </p>
        <h1 className="font-display mt-4 max-w-4xl text-5xl leading-[1.05] text-ivory sm:text-7xl">
          {t.hero}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          {t.heroBody}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <a
            href="#pricing"
            className="rounded-sm border border-gold/70 bg-gold px-6 py-3 text-sm font-medium tracking-wide text-ink transition hover:bg-ivory"
          >
            {t.start}
          </a>
          <a href="/auditor" className="text-sm text-gold underline-offset-4 hover:underline">
            {t.already}
          </a>
        </div>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-md border border-line bg-panel/70 p-6"
            >
              <h2 className="font-display text-2xl text-ivory">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{pillar.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-20 overflow-hidden rounded-md border border-line">
          <div className="grid min-h-[280px] lg:grid-cols-2">
            <div className="border-b border-line bg-ink-2 p-6 lg:border-b-0 lg:border-r">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{t.contractPane}</p>
              <p className="mt-4 text-sm leading-7 text-ivory/80">
                …shall indemnify and hold harmless the Provider from any and all
                claims{" "}
                <mark className="rounded-[2px] bg-high/25 px-0.5 text-ivory outline outline-1 outline-high">
                  including those arising from the Provider’s own negligence
                </mark>
                , without limitation of liability…
              </p>
            </div>
            <div className="bg-panel p-6">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{t.findingsPane}</p>
              <p className="mt-3 font-display text-2xl">{t.sampleFinding}</p>
              <p className="mt-2 text-sm text-muted">{t.sampleAction}</p>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="mt-20 overflow-hidden rounded-md border border-line bg-ink-2"
        >
          <div className="grid md:grid-cols-[1.2fr_0.8fr]">
            <div className="p-8 sm:p-12">
              <p className="text-xs uppercase tracking-[0.3em] text-gold">
                {t.stripeBilling}
              </p>
              <h2 className="font-display mt-3 text-4xl">{t.plan}</h2>
              <p className="mt-4 max-w-xl text-muted">
                {t.pricingBody} {t.zdr}
              </p>
              <ul className="mt-6 space-y-2 text-sm text-ivory/90">
                <li>{t.perkScans}</li>
                <li>{t.perkFindings}</li>
                <li>{t.perkDraft}</li>
                <li>{t.perkMemory}</li>
              </ul>
            </div>
            <div className="flex flex-col justify-center gap-4 border-t border-line bg-panel p-8 md:border-l md:border-t-0">
              <p className="text-sm text-muted">{t.retainer}</p>
              <p className="font-display text-6xl text-gold">$1,000</p>
              <p className="text-sm text-ivory">{t.founder}</p>
              <p className="text-xs tracking-[0.18em] text-muted">{t.code}</p>
              <LegalShield label={t.checkout} />
            </div>
          </div>
        </section>
        <p className="mt-10 text-xs text-muted">
          {t.zdr}
        </p>
      </main>
    </div>
  );
}
