// Shared demo-state persistence + cross-app handoff.
//
// The RFQ app (/) and the B2B app (/b2b) are two separate pages, so switching
// between them — or the version switcher navigating — triggers a full reload
// into a fresh in-memory store. The god files kept the demo alive across those
// reloads with a shared localStorage key (`rfqB2BDemoState`), and handed a
// just-created company to the B2B app through a one-shot key
// (`rfqHandoffCompany`). This module ports both, verbatim in spirit:
//   - RFQ writes `rfqB2BDemoState` on every mutation and rehydrates from it.
//   - B2B reads `rfqB2BDemoState.b2bCompanies` to rebuild RFQ-created companies,
//     and reads `rfqHandoffCompany` once to open the company just handed over.
// (Legacy parity: the B2B app does NOT persist its own edits — only the RFQ app
// writes the shared state — so B2B-side changes reset on reload, as before.)
export const DEMO_STATE_KEY = 'rfqB2BDemoState';
export const HANDOFF_KEY = 'rfqHandoffCompany';

export function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage disabled — the demo simply won't persist */
  }
}

export function removeKeys(...keys) {
  try {
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// Order limits ↔ storefront. The B2B app publishes its order limits whenever they
// change, so the storefront checks carts against the same ones (B2B edits reset on
// its reload, so the storefront follows that too). Going the other way, an order
// request — a cart over a review threshold the buyer sent instead of checking out —
// waits here until the B2B app's merchant approves or declines it.
export const ORDER_LIMITS_KEY = 'qsOrderLimits';
export const ORDER_REQUESTS_KEY = 'qsOrderRequests';
export const publishOrderLimits = (limits) => writeJSON(ORDER_LIMITS_KEY, limits);
export const publishedOrderLimits = () => readJSON(ORDER_LIMITS_KEY);
export const readOrderRequests = () => readJSON(ORDER_REQUESTS_KEY) || [];
export const addOrderRequest = (request) => writeJSON(ORDER_REQUESTS_KEY, [...readOrderRequests(), request]);
export function removeOrderRequests(ids) {
  const left = readOrderRequests().filter((r) => !ids.includes(r.id));
  if (left.length !== readOrderRequests().length) writeJSON(ORDER_REQUESTS_KEY, left);
}

// One-shot read of the RFQ→B2B handoff. Cached at module scope so it is safe to
// call more than once (React StrictMode double-invokes lazy initializers, and a
// dev remount would otherwise lose the payload once the key is removed).
let _handoff;
let _handoffConsumed = false;
export function consumeHandoff() {
  if (_handoffConsumed) return _handoff;
  _handoffConsumed = true;
  _handoff = readJSON(HANDOFF_KEY);
  removeKeys(HANDOFF_KEY);
  return _handoff;
}

// "Reset sample data" — clear the shared demo state + any pending handoff and
// reload back to seed (legacy resetDemoData / the top-bar "Reset data" button).
export function resetDemo() {
  removeKeys(DEMO_STATE_KEY, HANDOFF_KEY, ORDER_LIMITS_KEY, ORDER_REQUESTS_KEY);
  try {
    window.location.reload();
  } catch {
    /* ignore */
  }
}
