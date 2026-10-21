const LIVE_API_URL = "https://lexshield-backend.onrender.com";

function resolveApiUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  const bareRenderSite = trimmed === "https://onrender.com" || trimmed === "http://onrender.com";
  const local = !trimmed || trimmed.includes("localhost") || trimmed.includes("127.0.0.1");
  if (process.env.NODE_ENV === "production" || bareRenderSite || local) {
    return LIVE_API_URL;
  }
  return trimmed;
}

export const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

async function readBody(response: Response): Promise<{ detail?: unknown } & Record<string, unknown>> {
  const text = (await response.text()).trim();
  if (!text) return {};
  if (text.startsWith("<")) {
    throw new Error("El servidor devolvió HTML en lugar de JSON. La URL de la API no apunta al backend.");
  }
  try {
    return JSON.parse(text) as { detail?: unknown } & Record<string, unknown>;
  } catch {
    throw new Error("La respuesta de la API no es JSON válido.");
  }
}

/** Stripe publishable key from the repo-root .env (safe for the browser). */
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export const TOKEN_KEY = "lexshield_access_token";

function readError(data: { detail?: unknown }, fallback: string) {
  if (typeof data.detail === "string") return data.detail;
  return fallback;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export type BillingStatus = {
  product: string;
  amount_usd: number;
  interval: string;
  checkout_required: boolean;
  stripe_configured: boolean;
};

export async function getBillingStatus(): Promise<BillingStatus> {
  const response = await fetch(`${API_URL}/billing/status`);
  const data = await readBody(response);
  if (!response.ok) {
    throw new Error(readError(data, "No se pudo leer el estado de facturación."));
  }
  return data as BillingStatus;
}

export async function unlockDemoAccess() {
  const response = await fetch(`${API_URL}/billing/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bypass: true }),
  });
  const data = await readBody(response);
  if (!response.ok) {
    throw new Error(readError(data, "La demostración local no está disponible."));
  }
  setToken(data.access_token);
}

export async function openBillingPortal(): Promise<string> {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/billing/portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await readBody(response);
  if (!response.ok) {
    throw new Error(readError(data, "No se pudo abrir el portal de cliente."));
  }
  return data.portal_url as string;
}

export async function startCheckout(): Promise<string> {
  const response = await fetch("https://lexshield-backend.onrender.com/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await readBody(response);
  if (!response.ok) {
    throw new Error(readError(data, "No se pudo iniciar Stripe Checkout."));
  }
  return data.checkout_url as string;
}

export async function verifyCheckout(sessionId: string) {
  const response = await fetch(`${API_URL}/billing/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  const data = await readBody(response);
  if (!response.ok) {
    throw new Error(readError(data, "No se pudo verificar la suscripción."));
  }
  setToken(data.access_token);
}

export async function compareContracts(versionA: File, versionB: File) {
  const token = getToken();
  const form = new FormData();
  form.append("version_a", versionA);
  form.append("version_b", versionB);
  const response = await fetch(`${API_URL}/api/contracts/compare`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await readBody(response);
  if (!response.ok) {
    throw new Error(readError(data, "No se pudo comparar las versiones."));
  }
  return data as CompareResponse;
}

export async function analyzeContract(file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await readBody(response);
  if (!response.ok) {
    throw new Error(readError(data, "La auditoría falló."));
  }
  return data as AuditResponse;
}

export type ContractMetadata = {
  contract_type: string;
  parties: string;
  contract_date: string;
  fees: string;
  term: string;
};

export type MissingClause = {
  id: string;
  article: string;
  clause: string;
  analysis: string;
  alternative_drafting: string;
};

export type RiskOrigin = "auditor" | "litigador" | "socio" | "supervisor";

export type RiskFinding = {
  id: string;
  origin: RiskOrigin;
  article: string;
  severity: "high" | "medium";
  title: string;
  excerpt: string;
  analysis: string;
  suggestion: string;
  alternative_drafting: string;
  pagina_exacta: number;
  seccion_articulo: string;
  cita_literal_exacta: string;
  contexto_insercion_word: string;
};

export type VersionChange = {
  id: string;
  tipo: "agregado" | "eliminado" | "modificado";
  texto_version_a: string;
  texto_version_b: string;
  alerta: boolean;
  analisis: string;
};

export type CompareResponse = {
  version_a: string | null;
  version_b: string | null;
  resumen: string;
  cambios: VersionChange[];
};

export type AuditIntegrity = {
  version?: string;
  status?: "complete" | "incomplete" | "unreliable";
  status_label?: string;
  message?: string;
  total_candidates?: number;
  verified?: number;
  discarded?: number;
  added_by_controls?: number;
  discard_reasons?: {
    malformed_item?: number;
    failed_verification?: number;
    quote_not_anchored?: number;
  };
  flags?: string[];
  notes?: string[];
  truncated?: boolean;
  generated_at?: string;
};

export type AuditResponse = {
  filename: string;
  truncated: boolean;
  contract_text: string;
  summary: string;
  document_title: string;
  metadata?: ContractMetadata;
  omissions?: MissingClause[];
  risks: RiskFinding[];
  integrity?: AuditIntegrity;
};
