"use client";

import { useRef, useState, type RefObject } from "react";
import { compareContracts, type CompareResponse, type VersionChange } from "@/lib/api";
import { copy as t } from "@/lib/copy";

export function VersionCompare() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CompareResponse | null>(null);
  const inputA = useRef<HTMLInputElement>(null);
  const inputB = useRef<HTMLInputElement>(null);

  function take(which: "a" | "b", next: File | null) {
    if (!next) return;
    const name = next.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError(t.fileType);
      return;
    }
    setError(null);
    setReport(null);
    if (which === "a") setFileA(next);
    else setFileB(next);
  }

  async function run() {
    if (!fileA || !fileB) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await compareContracts(fileA, fileB));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.compareFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <VersionSlot label={t.versionA} file={fileA} inputRef={inputA} onFile={(file) => take("a", file)} />
        <VersionSlot label={t.versionB} file={fileB} inputRef={inputB} onFile={(file) => take("b", file)} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!fileA || !fileB || busy}
          onClick={run}
          className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
        >
          {busy ? t.comparing : t.compareAction}
        </button>
        {error && <p className="text-sm text-high">{error}</p>}
      </div>
      {!report && <p className="text-sm text-muted">{t.compareEmpty}</p>}
      {report && (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-ivory">{report.resumen}</p>
          {report.cambios.map((change) => (
            <ChangeBlock key={change.id} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}

function VersionSlot({
  label,
  file,
  inputRef,
  onFile,
}: {
  label: string;
  file: File | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-ink-2 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-sm border border-line px-3 py-2 text-sm text-ivory"
      >
        {file ? file.name : t.upload}
      </button>
    </div>
  );
}

function ChangeBlock({ change }: { change: VersionChange }) {
  const label =
    change.tipo === "agregado" ? t.added : change.tipo === "eliminado" ? t.removed : t.changed;
  return (
    <article
      className={`rounded-md border p-4 ${
        change.alerta ? "border-high bg-high/10" : "border-line bg-ink-2"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{label}</p>
        {change.alerta && (
          <span className="rounded-sm bg-high/20 px-2 py-0.5 text-[11px] uppercase tracking-wider text-high">
            {t.alertLabel}
          </span>
        )}
      </div>
      {change.texto_version_a && (
        <p className="mt-3 text-sm leading-6 text-ivory/80 line-through decoration-high/70">
          {change.texto_version_a}
        </p>
      )}
      {change.texto_version_b && (
        <p className="mt-2 text-sm leading-6 text-ivory">{change.texto_version_b}</p>
      )}
      <p className="mt-3 text-sm leading-6 text-muted">{change.analisis}</p>
    </article>
  );
}
