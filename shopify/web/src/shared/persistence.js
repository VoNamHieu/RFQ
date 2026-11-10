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
// request — a cart over an order maximum sent for review the buyer sent instead of checking out —
// waits here until the B2B app's merchant approves or declines it.
export const ORDER_LIMITS_KEY = 'qsOrderLimits';
export const ORDER_REQUESTS_KEY = 'qsOrderRequests';
export const publishOrderLimits = (limits) => writeJSON(ORDER_LIMITS_KEY, limits);
export const publishedOrderLimits = () => readJSON(ORDER_LIMITS_KEY);
export const readOrderRequests = () => readJSON(ORDER_REQUESTS_KEY) || [];
// Contracts ↔ storefront: the B2B app publishes the B2B Portal's contract cards for
// each company location (b2b/portalContracts.js, { v: 2, at }) for the buyer's
// account page. Going the other way, what buyers send from it — an answer to an
// upcoming contract — waits here as buyer events, as the real store keeps them
// (b2b/buyerEvents.js): the B2B app applies them when it loads and as they come.
export const CONTRACTS_KEY = 'qsContracts';
export const publishContracts = (contracts) => writeJSON(CONTRACTS_KEY, contracts);
export const publishedContracts = () => readJSON(CONTRACTS_KEY);
export const BUYER_EVENTS_KEY = 'qsBuyerEvents';
export const readBuyerEvents = () => readJSON(BUYER_EVENTS_KEY) || [];
// `at`: when it was sent (ISO), on the demo's day.
export function addBuyerEvent(type, data, at) {
  const event = { id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, type, at, data };
  writeJSON(BUYER_EVENTS_KEY, [...readBuyerEvents(), event]);
  return event;
}
// Held orders ↔ storefront: the B2B app publishes the orders held for its review
// and what became of them (see storefrontHeldOrders in b2b/dbHelpers.js), for the
// buyer's Orders on the B2B Portal.
export const HELD_ORDERS_KEY = 'qsHeldOrders';
export const publishHeldOrders = (orders) => writeJSON(HELD_ORDERS_KEY, orders);
export const publishedHeldOrders = () => readJSON(HELD_ORDERS_KEY);
export const addOrderRequest = (request) => writeJSON(ORDER_REQUESTS_KEY, [...readOrderRequests(), request]);
export function removeOrderRequests(ids) {
  const left = readOrderRequests().filter((r) => !ids.includes(r.id));
  if (left.length !== readOrderRequests().length) writeJSON(ORDER_REQUESTS_KEY, left);
}
// Invoices ↔ B2B app: an approved held order is a draft order with an invoice sent
// to the buyer. The buyer checks out from it on the storefront (the order number
// lands here); the B2B app then marks that order placed and clears it.
export const INVOICE_CHECKOUTS_KEY = 'qsInvoiceCheckouts';
export const readInvoiceCheckouts = () => readJSON(INVOICE_CHECKOUTS_KEY) || [];
export const addInvoiceCheckout = (orderId) => writeJSON(INVOICE_CHECKOUTS_KEY, [...readInvoiceCheckouts(), orderId]);
export function removeInvoiceCheckouts(ids) {
  const left = readInvoiceCheckouts().filter((id) => !ids.includes(id));
  if (left.length !== readInvoiceCheckouts().length) writeJSON(INVOICE_CHECKOUTS_KEY, left);
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
  removeKeys(DEMO_STATE_KEY, HANDOFF_KEY, ORDER_LIMITS_KEY, ORDER_REQUESTS_KEY, CONTRACTS_KEY, BUYER_EVENTS_KEY, HELD_ORDERS_KEY, INVOICE_CHECKOUTS_KEY);
  try {
    window.location.reload();
  } catch {
    /* ignore */
  }
}
