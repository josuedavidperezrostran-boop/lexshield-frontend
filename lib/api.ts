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

/** Keeps the HTTP status so callers can tell expired (401), payment (402), inactive (403),
 * existing subscription (409) and temporary Stripe trouble (503) apart. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function fail(response: Response, data: { detail?: unknown }, fallback: string): never {
  throw new ApiError(readError(data, fallback), response.status);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function requireAccessToken(data: Record<string, unknown>): string {
  const token = data.access_token;
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("El servidor no devolvió un token de acceso válido.");
  }
  return token;
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
  /** Present on backends with Stripe-backed access ("stripe-subscription-v1"). */
  access_model?: string;
};

/** Mirrors the backend: access comes from the Stripe subscription, not from the token. */
export type SubscriptionState = {
  status: string | null;
  access: boolean;
  payment_required: boolean;
  has_subscription: boolean;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
};

function readSubscription(value: unknown): SubscriptionState {
  if (!value || typeof value !== "object" || typeof (value as SubscriptionState).access !== "boolean") {
    throw new Error("El servidor no devolvió el estado de la suscripción.");
  }
  return value as SubscriptionState;
}

export async function getSubscriptionState(): Promise<SubscriptionState> {
  const response = await fetch(`${API_URL}/billing/me`, { headers: authHeaders() });
  const data = await readBody(response);
  if (!response.ok) fail(response, data, "No se pudo leer la suscripción.");
  return readSubscription(data);
}

/** Renews the stored token without Checkout or any charge. */
export async function refreshAccess(): Promise<SubscriptionState> {
  const response = await fetch(`${API_URL}/billing/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await readBody(response);
  if (!response.ok) fail(response, data, "No se pudo renovar la sesión.");
  setToken(requireAccessToken(data));
  return readSubscription(data.subscription);
}

/** Asks for a one-time sign-in link. The answer is the same whether or not the email has a
 * subscription, so this never tells the caller which it was. */
export async function requestRecovery(email: string): Promise<void> {
  const response = await fetch(`${API_URL}/billing/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await readBody(response);
  if (!response.ok) fail(response, data, "No se pudo enviar el enlace.");
}

/** Exchanges the code from the emailed link for a new session. Works once. */
export async function confirmRecovery(code: string): Promise<SubscriptionState> {
  const response = await fetch(`${API_URL}/billing/recover/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await readBody(response);
  if (!response.ok) fail(response, data, "No se pudo confirmar el enlace.");
  setToken(requireAccessToken(data));
  return readSubscription(data.subscription);
}

/** Revokes this session on the server, then forgets it here even if the server is unreachable. */
export async function signOut(): Promise<void> {
  try {
    if (getToken()) {
      await fetch(`${API_URL}/billing/logout`, { method: "POST", headers: authHeaders() });
    }
  } catch {
    // Offline: the token is still dropped below; it expires on its own.
  } finally {
    clearToken();
  }
}

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
  setToken(requireAccessToken(data));
}

export async function openBillingPortal(): Promise<string> {
  const response = await fetch(`${API_URL}/api/billing/portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  const data = await readBody(response);
  if (!response.ok) fail(response, data, "No se pudo abrir el portal de cliente.");
  return data.portal_url as string;
}

/** Sends the stored token so the backend reuses the Stripe customer and refuses (409) a
 * second subscription. Without a token the visitor is anonymous. */
export async function startCheckout(): Promise<string> {
  const response = await fetch(`${API_URL}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({}),
  });
  const data = await readBody(response);
  if (!response.ok) fail(response, data, "No se pudo iniciar Stripe Checkout.");
  if (typeof data.checkout_url !== "string" || !data.checkout_url.startsWith("https://")) {
    throw new Error("El servidor no devolvió una URL de Stripe Checkout válida.");
  }
  return data.checkout_url;
}

export async function verifyCheckout(sessionId: string) {
  const response = await fetch(`${API_URL}/billing/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  const data = await readBody(response);
  if (!response.ok) fail(response, data, "No se pudo verificar la suscripción.");
  setToken(requireAccessToken(data));
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
  if (!response.ok) fail(response, data, "No se pudo comparar las versiones.");
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
  if (!response.ok) fail(response, data, "La auditoría falló.");
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
