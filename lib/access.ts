import {
  ApiError,
  clearToken,
  getSubscriptionState,
  getToken,
  refreshAccess,
  type SubscriptionState,
} from "@/lib/api";

/** What the auditor shows. Only "signed_out" and "inactive" offer Checkout; a Stripe outage
 * ("unavailable") never does, because it says nothing about the subscription. */
export type AccessView =
  | { kind: "signed_out" }
  | { kind: "workspace"; state: SubscriptionState | null }
  | { kind: "payment_required" }
  | { kind: "inactive" }
  | { kind: "unavailable" };

// Renew on page load once the token is a day old, so active customers rarely reach the
// 7-day expiry. The backend still decides access from Stripe on every call.
const PROACTIVE_REFRESH_SECONDS = 24 * 60 * 60;

export function viewFor(state: SubscriptionState): AccessView {
  if (state.access) return { kind: "workspace", state };
  if (state.payment_required) return { kind: "payment_required" };
  return { kind: "inactive" };
}

export function tokenAgeSeconds(token: string | null, now = Date.now()): number | null {
  const issuedAt = Number(token?.split(".", 1)[0]);
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) return null;
  return now / 1000 - issuedAt;
}

async function renew(): Promise<AccessView> {
  try {
    return viewFor(await refreshAccess());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Too old or not ours: only account recovery can help now.
      clearToken();
      return { kind: "signed_out" };
    }
    // 403: known customer with nothing to renew. Keep the token so Checkout reuses the customer.
    if (err instanceof ApiError && err.status === 403) return { kind: "inactive" };
    return { kind: "unavailable" };
  }
}

export async function resolveAccess(): Promise<AccessView> {
  if (!getToken()) return { kind: "signed_out" };
  let state: SubscriptionState;
  try {
    state = await getSubscriptionState();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return renew();
    // A backend without /billing/me predates Stripe-backed access and still checks the token
    // itself on every call; keep the old behaviour instead of blocking everyone.
    if (err instanceof ApiError && err.status === 404) return { kind: "workspace", state: null };
    return { kind: "unavailable" };
  }
  const age = tokenAgeSeconds(getToken());
  if (age !== null && age > PROACTIVE_REFRESH_SECONDS) {
    try {
      state = await refreshAccess();
    } catch {
      // The current token still works; renewal can wait for the next visit.
    }
  }
  return viewFor(state);
}
