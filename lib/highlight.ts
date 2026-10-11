import type { RiskFinding } from "./api";

export type Segment = {
  text: string;
  riskId?: string;
  severity?: "high" | "medium";
};

export function highlightSegments(
  contractText: string,
  risks: RiskFinding[],
): Segment[] {
  const matches: { start: number; end: number; risk: RiskFinding }[] = [];

  for (const risk of risks) {
    const span = findExcerptSpan(contractText, risk.excerpt.trim());
    if (!span) continue;
    matches.push({ ...span, risk });
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: typeof matches = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    kept.push(match);
    cursor = match.end;
  }

  const segments: Segment[] = [];
  let index = 0;
  for (const match of kept) {
    if (match.start > index) {
      segments.push({ text: contractText.slice(index, match.start) });
    }
    segments.push({
      text: contractText.slice(match.start, match.end),
      riskId: match.risk.id,
      severity: match.risk.severity,
    });
    index = match.end;
  }
  if (index < contractText.length) {
    segments.push({ text: contractText.slice(index) });
  }
  return segments;
}

function findExcerptSpan(
  haystack: string,
  needle: string,
): { start: number; end: number } | null {
  if (needle.length < 8) return null;
  const direct = haystack.indexOf(needle);
  if (direct >= 0) return { start: direct, end: direct + needle.length };

  const collapsedHay = collapseWs(haystack);
  const collapsedNeedle = collapseWs(needle);
  const collapsedIndex = collapsedHay.indexOf(collapsedNeedle);
  if (collapsedIndex < 0) return null;

  const start = mapCollapsedIndex(haystack, collapsedIndex);
  const end = mapCollapsedIndex(haystack, collapsedIndex + collapsedNeedle.length);
  if (start < 0 || end < 0 || end <= start) return null;
  return { start, end };
}

function collapseWs(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function mapCollapsedIndex(original: string, collapsedIndex: number): number {
  let compact = 0;
  let i = 0;
  while (i < original.length && /\s/.test(original[i]!)) i += 1;
  if (collapsedIndex === 0) return i;

  while (i < original.length) {
    const ch = original[i]!;
    if (/\s/.test(ch)) {
      while (i < original.length && /\s/.test(original[i]!)) i += 1;
      compact += 1;
      if (compact === collapsedIndex) return i;
      continue;
    }
    compact += 1;
    i += 1;
    if (compact === collapsedIndex) return i;
  }
  return original.length;
}
