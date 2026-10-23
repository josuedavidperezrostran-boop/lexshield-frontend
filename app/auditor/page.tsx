"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColorLegend } from "@/components/ColorLegend";
import { LegalShield } from "@/components/LegalShield";
import { RecoverAccess } from "@/components/RecoverAccess";
import { SiteHeader } from "@/components/SiteHeader";
import { VersionCompare } from "@/components/VersionCompare";
import { resolveAccess, type AccessView, type BackendModel } from "@/lib/access";
import {
  analyzeContract,
  ApiError,
  getBillingStatus,
  openBillingPortal,
  signOut,
  unlockDemoAccess,
  type AuditIntegrity,
  type AuditResponse,
  type MissingClause,
  type RiskFinding,
} from "@/lib/api";
import { highlightSegments } from "@/lib/highlight";
import { copy as t } from "@/lib/copy";
import { downloadAuditReport } from "@/lib/reportPdf";

export default function AuditorPage() {
  const [view, setView] = useState<AccessView | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [workspace, setWorkspace] = useState<"audit" | "compare">("audit");
  const inputRef = useRef<HTMLInputElement>(null);

  const hydrate = useCallback(async (isCancelled: () => boolean = () => false) => {
    setView(null);
    let backend: BackendModel = "unknown";
    try {
      const status = await getBillingStatus();
      if (isCancelled()) return;
      if (!status.checkout_required) {
        setDemoMode(true);
        setView({ kind: "workspace", state: null });
        return;
      }
      backend = status.access_model === "stripe-subscription-v1" ? status.access_model : "legacy";
    } catch {
      // The subscription check below reports Stripe or network trouble on its own.
    }
    const next = await resolveAccess(backend);
    if (!isCancelled()) setView(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydrate(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const authed = view?.kind === "workspace" || view?.kind === "legacy_workspace";
  const subscription = view?.kind === "workspace" ? view.state : null;

  async function openPortal() {
    setPortalBusy(true);
    setError(null);
    try {
      window.location.href = await openBillingPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.portalFailed);
      setPortalBusy(false);
    }
  }

  const segments = useMemo(
    () => (audit ? highlightSegments(audit.contract_text, audit.risks) : []),
    [audit],
  );

  const highCount = audit?.risks.filter((risk) => risk.severity === "high").length ?? 0;
  const mediumCount = audit?.risks.filter((risk) => risk.severity === "medium").length ?? 0;

  function takeFile(next: File | null) {
    if (!next) return;
    const name = next.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError(t.fileType);
      return;
    }
    setError(null);
    setFile(next);
    setAudit(null);
  }

  async function runScan() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await analyzeContract(file);
      setAudit(result);
      setActiveId(result.risks[0]?.id ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await hydrate();
      } else if (err instanceof ApiError && err.status === 402) {
        setView({ kind: "payment_required" });
      } else if (err instanceof ApiError && err.status === 403) {
        setView({ kind: "inactive" });
      } else if (err instanceof ApiError && err.status === 503) {
        setError(t.stripeUnavailable);
      } else {
        setError(err instanceof Error ? err.message : t.scanFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader compact />
      {view === null && <p className="mx-6 mt-6 text-sm text-muted">{t.checking}</p>}

      {view?.kind === "unavailable" && (
        <div className="mx-6 mt-6 rounded-md border border-line bg-panel p-8">
          <p className="max-w-2xl text-ivory">{t.stripeUnavailable}</p>
          <button
            type="button"
            onClick={() => hydrate()}
            className="mt-4 rounded-sm border border-line px-3 py-2 text-sm text-ivory hover:border-gold"
          >
            {t.retry}
          </button>
        </div>
      )}

      {view?.kind === "payment_required" && (
        <div className="mx-6 mt-6 rounded-md border border-gold/40 bg-panel p-8">
          <h1 className="font-display text-4xl">{t.paymentRequiredTitle}</h1>
          <p className="mt-3 max-w-2xl text-muted">{t.paymentRequiredBody}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={portalBusy}
              onClick={openPortal}
              className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
            >
              {portalBusy ? t.openingPortal : t.updatePayment}
            </button>
            <button type="button" onClick={() => hydrate()} className="text-sm text-muted hover:text-ivory">
              {t.retry}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-high">{error}</p>}
        </div>
      )}

      {(view?.kind === "signed_out" || view?.kind === "inactive") && (
        <div className="mx-6 mt-6 rounded-md border border-gold/40 bg-panel p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">{t.gate}</p>
          <h1 className="font-display mt-2 text-4xl">{t.gateTitle}</h1>
          <p className="mt-3 max-w-2xl text-muted">
            {view.kind === "inactive" ? t.inactiveBody : t.gateBody}
          </p>
          <div className="mt-6 max-w-xl space-y-3">
            <LegalShield label={t.proceed} />
            {view.kind === "signed_out" && <RecoverAccess />}
            {/* The backend refuses the billing bypass in production, so customers never see it. */}
            {process.env.NODE_ENV !== "production" && (
              <button
                type="button"
                className="text-sm text-muted underline-offset-4 hover:underline"
                onClick={async () => {
                  try {
                    await unlockDemoAccess();
                    setDemoMode(true);
                    setView({ kind: "workspace", state: null });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : t.demoFailed);
                  }
                }}
              >
                {t.demo}
              </button>
            )}
            {error && <p className="text-sm text-high">{error}</p>}
          </div>
        </div>
      )}

      {authed && (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-panel px-4 py-3">
            <div className="flex items-start gap-3">
              <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold">
                {t.workspace}
              </p>
              <p className="max-w-xl text-sm text-muted">
                {demoMode ? t.demoPrefix : ""}
                {t.zdr}
              </p>
              {subscription?.cancel_at_period_end && (
                <p className="mt-1 max-w-xl text-sm text-gold">
                  {t.cancelScheduled}
                  {subscription.current_period_end
                    ? ` (${new Date(subscription.current_period_end * 1000).toLocaleDateString("es")})`
                    : ""}
                  .
                </p>
              )}
              </div>
              <ColorLegend />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-sm border border-line px-3 py-2 text-sm text-ivory"
              >
                {file ? file.name : t.upload}
              </button>
              <button
                type="button"
                disabled={!file || busy}
                onClick={runScan}
                className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
              >
                {busy ? t.scanning : t.scan}
              </button>
              <button
                type="button"
                disabled={portalBusy}
                onClick={openPortal}
                className="rounded-sm border border-line px-3 py-2 text-sm text-ivory hover:border-gold disabled:opacity-50"
              >
                {portalBusy ? t.openingPortal : t.manage}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setView({ kind: "signed_out" });
                  setAudit(null);
                  setDemoMode(false);
                }}
                className="text-xs text-muted hover:text-ivory"
              >
                {t.signOut}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWorkspace("audit")}
              className={`rounded-sm px-3 py-2 text-sm ${
                workspace === "audit" ? "bg-gold text-ink" : "border border-line text-ivory"
              }`}
            >
              {t.tabAudit}
            </button>
            <button
              type="button"
              onClick={() => setWorkspace("compare")}
              className={`rounded-sm px-3 py-2 text-sm ${
                workspace === "compare" ? "bg-gold text-ink" : "border border-line text-ivory"
              }`}
            >
              {t.tabCompare}
            </button>
          </div>

          {workspace === "compare" ? (
            <VersionCompare />
          ) : (
          <>
          {error && (
            <p className="rounded-md border border-high/40 bg-high/10 px-4 py-3 text-sm text-high">
              {error}
            </p>
          )}

          {!audit && !busy && (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                takeFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex flex-1 items-center justify-center rounded-md border border-dashed text-center ${
                dragging ? "border-gold bg-gold/5" : "border-line"
              }`}
            >
              <div>
                <p className="font-display text-3xl">{t.awaiting}</p>
                <p className="mt-2 max-w-md text-sm text-muted">{t.drop}</p>
              </div>
            </div>
          )}

          {busy && (
            <div className="flex flex-1 items-center justify-center rounded-md border border-line bg-ink-2 px-6">
              <div className="w-full max-w-3xl">
                <p className="text-center text-sm text-gold">{t.reading}</p>
                <ol className="mt-6 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
                  <li className="bg-ink px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{t.deskAuditor}</p>
                    <p className="mt-2 text-sm leading-6 text-ivory">{t.deskAuditorBody}</p>
                  </li>
                  <li className="bg-ink px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{t.deskLitigator}</p>
                    <p className="mt-2 text-sm leading-6 text-ivory">{t.deskLitigatorBody}</p>
                  </li>
                  <li className="bg-ink px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{t.deskPartner}</p>
                    <p className="mt-2 text-sm leading-6 text-ivory">{t.deskPartnerBody}</p>
                  </li>
                  <li className="bg-ink px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{t.deskSupervisor}</p>
                    <p className="mt-2 text-sm leading-6 text-ivory">{t.deskSupervisorBody}</p>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {audit && (
            <div className="grid min-h-[70vh] flex-1 gap-4 lg:grid-cols-2">
              <section className="overflow-hidden rounded-md border border-line bg-ink-2">
                <header className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gold">{t.contract}</p>
                    <h2 className="font-display text-2xl">{audit.document_title}</h2>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>
                      <span className="text-high">{highCount} {t.high}</span>
                      {" · "}
                      <span className="text-medium">{mediumCount} {t.medium}</span>
                    </p>
                    {audit.truncated && <p className="text-medium">{t.trimmed}</p>}
                  </div>
                </header>
                <article className="h-[calc(70vh-4rem)] overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-ivory/90">
                  {segments.map((segment, index) => {
                    if (!segment.riskId) {
                      return <PageAware key={index} text={segment.text} />;
                    }
                    const active = segment.riskId === activeId;
                    const tone =
                      segment.severity === "high"
                        ? "bg-high/25 outline-high"
                        : "bg-medium/25 outline-medium";
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setActiveId(segment.riskId!);
                          document
                            .getElementById(`finding-${segment.riskId}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={`rounded-[2px] px-0.5 text-left outline outline-1 ${tone} ${
                          active ? "ring-2 ring-gold" : ""
                        }`}
                      >
                        <PageAware text={segment.text} />
                      </button>
                    );
                  })}
                </article>
              </section>

              <section className="overflow-hidden rounded-md border border-line bg-panel">
                <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gold">
                      {t.findings}
                    </p>
                    <h2 className="font-display text-2xl">{t.findingsTitle}</h2>
                    <p className="mt-2 text-sm text-muted">{audit.summary}</p>
                  </div>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      setError(null);
                      try {
                        await downloadAuditReport(audit);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : t.pdfFailed);
                      } finally {
                        setExporting(false);
                      }
                    }}
                    className="shrink-0 rounded-sm border border-line bg-ink px-3 py-2 text-xs tracking-wide text-ivory transition hover:border-gold disabled:opacity-50"
                  >
                    {exporting ? t.preparingPdf : t.downloadPdf}
                  </button>
                </header>
                <div className="h-[calc(70vh-7rem)] space-y-4 overflow-auto p-4">
                  {audit.integrity ? <IntegrityNotice integrity={audit.integrity} /> : null}
                  <MetadataCard audit={audit} />
                  {(audit.omissions ?? []).map((omission) => (
                    <OmissionCard key={omission.id} omission={omission} />
                  ))}
                  {audit.risks.length === 0 && (audit.omissions ?? []).length === 0 && (
                    <p className={audit.integrity?.status === "unreliable" ? "text-sm text-high" : "text-sm text-muted"}>
                      {audit.integrity?.status === "unreliable" ? audit.integrity.message : t.noRisks}
                    </p>
                  )}
                  {audit.risks.map((risk) => (
                    <FindingCard
                      key={risk.id}
                      risk={risk}
                      active={risk.id === activeId}
                      onFocus={() => setActiveId(risk.id)}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {authed === null && (
        <p className="p-8 text-sm text-muted">{t.checking}</p>
      )}
    </div>
  );
}

function PageAware({ text }: { text: string }) {
  const parts = text.split(/(\[\[PÁGINA\s+\d+\]\])/);
  return (
    <>
      {parts.map((part, index) => {
        const page = part.match(/^\[\[PÁGINA\s+(\d+)\]\]$/);
        if (!page) return <span key={index}>{part}</span>;
        return (
          <span
            key={index}
            id={`fuente-pagina-${page[1]}`}
            className="mt-6 block border-t border-line pt-3 text-[10px] uppercase tracking-[0.2em] text-gold"
          >
            {t.pageLabel} {page[1]}
          </span>
        );
      })}
    </>
  );
}

function IntegrityNotice({ integrity }: { integrity: AuditIntegrity }) {
  const unreliable = integrity.status === "unreliable";
  const needsReview = integrity.status !== "complete";
  if (!integrity.status_label && !integrity.message && !needsReview) return null;
  const frame = unreliable
    ? "border-high/40 bg-high/10 text-high"
    : needsReview
      ? "border-medium/40 bg-medium/10 text-ivory"
      : "border-line bg-ink text-ivory";
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${frame}`}>
      {integrity.status_label ? (
        <p className={`text-xs uppercase tracking-[0.18em] ${unreliable ? "text-high" : "text-gold"}`}>
          {integrity.status_label}
        </p>
      ) : null}
      {integrity.message ? (
        <p className={`mt-2 leading-6 ${unreliable ? "text-high" : "text-ivory"}`}>{integrity.message}</p>
      ) : null}
      {needsReview ? (
        <p className={`mt-2 text-xs uppercase tracking-[0.16em] ${unreliable ? "text-high" : "text-medium"}`}>
          Revisión humana obligatoria.
        </p>
      ) : null}
    </div>
  );
}

function MetadataCard({ audit }: { audit: AuditResponse }) {
  const metadata = audit.metadata;
  const rows = [
    [t.parties, metadata?.parties],
    [t.date, metadata?.contract_date],
    [t.fees, metadata?.fees],
    [t.term, metadata?.term],
  ];
  return (
    <article className="rounded-md border border-line bg-ink px-4 py-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">{t.metadata}</p>
        <h3 className="truncate font-display text-xl text-ivory">
          {metadata?.contract_type || audit.document_title}
        </h3>
      </div>
      <dl className="mt-3 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-ink-2 px-3 py-3">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-gold">{label}</dt>
            <dd className="mt-1.5 text-sm font-medium leading-6 text-ivory">
              {value || t.missingValue}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function OmissionCard({ omission }: { omission: MissingClause }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="rounded-md border border-line border-l-2 border-l-gold bg-ink-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{t.cite}</p>
          <p className="mt-1 font-display text-2xl leading-tight text-ivory">{omission.article}</p>
          <h3 className="mt-3 font-display text-xl text-ivory">{omission.clause}</h3>
        </div>
        <span className="shrink-0 rounded-sm border border-line px-2 py-0.5 text-[11px] uppercase tracking-wider text-gold">
          {t.omission}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{omission.analysis}</p>
      <div className="mt-4 rounded-sm border border-line bg-ink-2 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold">
            {t.insert}
          </p>
          <button
            type="button"
            className="text-[11px] text-muted hover:text-gold"
            onClick={async () => {
              await navigator.clipboard.writeText(omission.alternative_drafting);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? t.copied : t.copy}
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ivory">
          {omission.alternative_drafting}
        </p>
      </div>
    </article>
  );
}

function FindingCard({
  risk,
  active,
  onFocus,
}: {
  risk: RiskFinding;
  active: boolean;
  onFocus: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const badge =
    risk.severity === "high"
      ? "bg-high/20 text-high"
      : "bg-medium/20 text-medium";
  const desk =
    risk.origin === "litigador"
      ? t.deskLitigator
      : risk.origin === "auditor"
        ? t.deskAuditor
        : risk.origin === "supervisor"
          ? t.deskSupervisor
          : t.deskPartner;
  return (
    <article
      id={`finding-${risk.id}`}
      onClick={onFocus}
      className={`cursor-pointer rounded-md border p-4 ${
        active ? "border-gold bg-ink-2" : "border-line bg-ink/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{t.cite}</p>
          <p className="mt-1 font-display text-2xl leading-tight text-ivory">{risk.article}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted">{desk}</p>
          <p className="mt-1 text-[11px] text-muted">
            {t.pageLabel} {risk.pagina_exacta} · {risk.seccion_articulo}
          </p>
          <button
            type="button"
            className="mt-3 rounded-sm border border-line px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-gold"
            onClick={(event) => {
              event.stopPropagation();
              onFocus();
              document.getElementById(`fuente-pagina-${risk.pagina_exacta}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            {t.verifySource}
          </button>
          <h3 className="mt-3 font-display text-xl">{risk.title}</h3>
        </div>
        <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[11px] uppercase tracking-wider ${badge}`}>
          {risk.severity === "high" ? t.high : t.medium}
        </span>
      </div>
      <blockquote className="mt-4 border-l border-line pl-3 text-sm leading-6 text-ivory/80">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{t.quoted}</p>
        <p className="mt-1">{risk.excerpt}</p>
      </blockquote>
      {risk.contexto_insercion_word ? (
        <p className="mt-3 text-[11px] leading-5 tracking-wide text-muted">
          <span className="uppercase tracking-[0.16em] text-gold">{t.wordAnchor}</span>
          <span className="mt-1 block text-ivory/80">{risk.contexto_insercion_word}</span>
        </p>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-muted">{risk.analysis}</p>
      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-gold">{t.action}</p>
        <p className="mt-1 text-sm text-ivory/90">{risk.suggestion}</p>
      </div>
      <div className="mt-4 rounded-sm border border-line bg-ink p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold">
            {t.alternative}
          </p>
          <button
            type="button"
            className="text-[11px] text-muted hover:text-gold"
            onClick={async (event) => {
              event.stopPropagation();
              await navigator.clipboard.writeText(risk.alternative_drafting);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? t.copied : t.copy}
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ivory">
          {risk.alternative_drafting}
        </p>
      </div>
    </article>
  );
}
