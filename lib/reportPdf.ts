import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuditResponse } from "./api";
import { copy } from "./copy";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

export async function downloadAuditReport(audit: AuditResponse) {
  const saved = await buildAuditPdf(audit);
  const buffer = new ArrayBuffer(saved.byteLength);
  new Uint8Array(buffer).set(saved);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = (audit.filename || audit.document_title || "contrato")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  link.href = url;
  link.download = `LexShield-Audit-${slug || "informe"}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function buildAuditPdf(audit: AuditResponse): Promise<Uint8Array<ArrayBuffer>> {
  const t = copy;
  const doc = await PDFDocument.create();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ink = rgb(0.07, 0.08, 0.1);
  const mute = rgb(0.35, 0.38, 0.42);
  const line = rgb(0.72, 0.75, 0.78);
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  function ensure(height: number) {
    if (y - height < MARGIN + 28) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function rule() {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: line,
    });
    y -= 16;
  }

  function write(
    text: string,
    font: typeof sans,
    size: number,
    color = ink,
    gap = 6,
  ) {
    const lines = wrap(clean(text), font, size, contentWidth);
    for (const row of lines) {
      ensure(size + gap);
      page.drawText(row, { x: MARGIN, y: y - size, size, font, color });
      y -= size + gap;
    }
  }

  write("LEXSHIELD AUDIT", sansBold, 9, mute, 10);
  write("Informe ejecutivo de riesgo contractual", serif, 22, ink, 8);
  rule();

  write("CONTRATO", sansBold, 8, mute, 4);
  write(audit.filename || audit.document_title, serifBold, 14, ink, 4);
  if (audit.document_title && audit.document_title !== audit.filename) {
    write(audit.document_title, sans, 10, mute, 8);
  }

  const metadata = audit.metadata;
  write(t.metadata.toUpperCase(), sansBold, 8, mute, 4);
  write(`Tipo: ${metadata?.contract_type || audit.document_title}`, serif, 11, ink, 3);
  write(`${t.parties}: ${metadata?.parties || t.missingValue}`, serif, 11, ink, 3);
  write(`${t.date}: ${metadata?.contract_date || t.missingValue}`, serif, 11, ink, 3);
  write(`${t.fees}: ${metadata?.fees || t.missingValue}`, serif, 11, ink, 3);
  write(`${t.term}: ${metadata?.term || t.missingValue}`, serif, 11, ink, 12);

  write("RESUMEN DE RIESGOS", sansBold, 8, mute, 4);
  write(audit.summary || "Sin resumen.", serif, 11, ink, 12);

  const high = audit.risks.filter((risk) => risk.severity === "high").length;
  const medium = audit.risks.filter((risk) => risk.severity === "medium").length;
  const integrity = audit.integrity;
  const unreliable = integrity?.status === "unreliable";
  if (!unreliable) {
    write(
      `${audit.risks.length} riesgos · ${high} altos · ${medium} medios`,
      sans,
      10,
      mute,
      14,
    );
  }
  if (integrity) {
    const parts: { text: string; font: typeof sans; size: number }[] = [];
    if (integrity.status_label) parts.push({ text: integrity.status_label, font: sansBold, size: 10 });
    if (integrity.message) parts.push({ text: integrity.message, font: serif, size: 11 });
    if (integrity.status !== "complete") {
      parts.push({ text: "Revisión humana obligatoria.", font: sans, size: 10 });
    }
    parts.forEach((part, index) => {
      write(part.text, part.font, part.size, ink, index === parts.length - 1 ? 14 : 4);
    });
  }

  const omissions = audit.omissions ?? [];
  if (omissions.length === 0) {
    write(
      "No se detectaron omisiones en esta pasada. No equivale a ausencia de omisiones.",
      serif,
      11,
      ink,
      12,
    );
  }
  omissions.forEach((omission, index) => {
    ensure(72);
    rule();
    write(`OMISIÓN CRÍTICA ${index + 1}`, sansBold, 8, mute, 4);
    write(omission.article || "Índice revisado", serifBold, 12, ink, 4);
    write(omission.clause, serifBold, 14, ink, 8);
    write("ANÁLISIS", sansBold, 8, mute, 3);
    write(omission.analysis, serif, 11, ink, 8);
    write("REDACCIÓN PARA INSERTAR", sansBold, 8, mute, 3);
    write(omission.alternative_drafting, serif, 11, ink, 14);
  });

  if (audit.risks.length === 0) {
    write(t.noRisks, serif, 11);
  }

  audit.risks.forEach((risk, index) => {
    ensure(72);
    rule();
    const level = risk.severity === "high" ? t.high : t.medium;
    const desk =
      risk.origin === "litigador"
        ? t.deskLitigator
        : risk.origin === "auditor"
          ? t.deskAuditor
          : risk.origin === "supervisor"
            ? t.deskSupervisor
            : t.deskPartner;
    write(`RIESGO ${index + 1}  ·  ${level.toUpperCase()}`, sansBold, 8, mute, 4);
    write(risk.article || "Sin cita", serifBold, 12, ink, 3);
    if (risk.pagina_exacta) {
      write(`Página ${risk.pagina_exacta} · ${risk.seccion_articulo}`, sans, 9, mute, 4);
      if (risk.contexto_insercion_word) {
        write(risk.contexto_insercion_word, sans, 8, mute, 4);
      }
    }
    write(desk, sans, 9, mute, 4);
    write(risk.title, serifBold, 14, ink, 8);
    write(t.quoted.toUpperCase(), sansBold, 8, mute, 3);
    write(risk.excerpt, serif, 11, ink, 8);
    write("ANÁLISIS", sansBold, 8, mute, 3);
    write(risk.analysis, serif, 11, ink, 8);
    write(t.action.toUpperCase(), sansBold, 8, mute, 3);
    write(risk.suggestion, serif, 11, ink, 8);
    write(t.alternative.toUpperCase(), sansBold, 8, mute, 3);
    write(risk.alternative_drafting, serif, 11, ink, 14);
  });

  ensure(48);
  rule();
  write(
    "Revisión humana obligatoria. Este informe es apoyo a la decisión y no sustituye el criterio de un abogado.",
    sans,
    8,
    mute,
    3,
  );
  write(
    "Los documentos se procesan en memoria y se eliminan automáticamente tras la auditoría. Para el análisis, el texto se envía a un proveedor de IA externo (OpenAI), que puede conservarlo temporalmente según sus políticas. Este informe es una herramienta de apoyo, no constituye asesoría legal y requiere revisión por un abogado.",
    sans,
    8,
    mute,
    0,
  );

  const pages = doc.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawText(`${index + 1} / ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 36,
      y: 28,
      size: 8,
      font: sans,
      color: mute,
    });
  });

  const saved = await doc.save();
  const bytes = new Uint8Array(saved.byteLength);
  bytes.set(saved);
  return bytes;
}

function wrap(
  text: string,
  font: { widthOfTextAtSize: (value: string, size: number) => number },
  size: number,
  maxWidth: number,
) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function clean(value: string) {
  return value
    .replace(/\u2014|\u2013/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, "...")
    .replace(/[^\n\r\t\x20-\xFF]/g, "");
}
