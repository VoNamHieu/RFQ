// Buyer events: what buyers send from their customer account (the B2B Portal's
// extensions) — a business registration, a quote request from an order, accepting a
// quote or countering it. The backend (qs-b2b-api) keeps them in their own metafield
// on the app's installation (BUYER_EVENTS_KEY), not in the app's data, so an admin
// open at that moment can't overwrite them when it saves. The admin applies each one
// once, when it loads (`db.appliedBuyerEvents` keeps their ids, saved with the app's
// data); the backend applies the ones not applied yet to show the buyer what they sent
// straight away. The same function on both sides (the backend bundles this file).
//
// An event: { id, type, at (ISO time), data }
//   registration   data: a registration as Registrations lists it (status 'pending')
//   quote-request  data: a quote as a company's Quotes tab lists it ('New Received')
//   quote-accept   data: { quoteId }
//   quote-counter  data: { quoteId, unitPrice }
//   contract-response  data: { number, version, kind: 'approve' | 'changes' | 'cancel', message,
//                  buyer, email, customerGid } — a buyer's answer to a contract sent
//                  for their approval (its Contract proposal or Upcoming contract card),
//                  kept on the contract in `buyerResponses`, latest last; the contract
//                  page shows the latest for its version. An approval activates the
//                  proposal (agreements.js activateApproved).
import { activateApproved } from './agreements.js';

export const BUYER_EVENTS_KEY = 'buyer_events';

const day = (iso) => (iso || '').slice(0, 10);
const when = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function applyBuyerEvent(db, e) {
  const d = e.data || {};
  if (e.type === 'registration') {
    db.registrations = db.registrations || [];
    if (!db.registrations.some((r) => r.id === d.id)) db.registrations.unshift({ ...d });
    return;
  }
  if (e.type === 'contract-response') {
    const ag = (db.agreements || []).find((a) => a.number === d.number);
    if (ag) ag.buyerResponses = [...(ag.buyerResponses || []), { ...d, at: day(e.at) }];
    return;
  }
  db.quotes = db.quotes || [];
  if (e.type === 'quote-request') {
    if (!db.quotes.some((q) => q.id === d.id)) db.quotes.unshift({ ...d });
    return;
  }
  const q = db.quotes.find((x) => x.id === d.quoteId);
  if (!q) return;
  const log = (what) => (q.timeline = [...(q.timeline || []), { when: when(e.at), what }]);
  if (e.type === 'quote-accept') {
    q.status = 'Deal Closed';
    q.updated = day(e.at);
    q.acceptedAt = day(e.at);
    log('Buyer accepted the quote');
  } else if (e.type === 'quote-counter') {
    q.status = 'Updated';
    q.updated = day(e.at);
    q.counterUnitPrice = Number(d.unitPrice);
    log(`Buyer sent a counter offer: ${Number(d.unitPrice)} a unit`);
  }
}

// A contract's latest buyer response for the version it's on (Approve or Request
// changes from its Upcoming contract card), or null — an answer to an earlier version
// no longer counts once the contract was saved again.
export const latestBuyerResponse = (ag) => [...(ag?.buyerResponses || [])].reverse().find((r) => r.version === ag.version) || null;

// Applies the events `db` hasn't applied yet, oldest first, then activates the
// proposals buyers approved — those approved before too, while still Proposed
// (mutates `db`). Returns whether anything changed.
export function applyBuyerEvents(db, events) {
  const done = new Set(db.appliedBuyerEvents || []);
  const fresh = (events || []).filter((e) => e && e.id && !done.has(e.id)).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  fresh.forEach((e) => {
    applyBuyerEvent(db, e);
    done.add(e.id);
  });
  db.appliedBuyerEvents = [...done];
  const activated = activateApproved(db);
  return fresh.length > 0 || activated;
}
