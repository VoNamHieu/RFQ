// Pure demo-db helpers: deep clone, load-time normalization, the RFQ→B2B company
// injection, and the pricing-slot mutations (add/remove base, fork-on-transfer).
// These are separate from the reducer so both the reducer and the initial-state
// builder can share them.
import { orderSeed } from './data/db.js';
import { policyById, policyUsageCount } from './pricing.js';
import { newBaseBuilder } from './builders.js';

export const clone = (obj) =>
  typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

// Light normalization at load: legacy scalar `pricing.base:'p1'` → [{id,priority}],
// and fill the location fields the detail screen edits (non-destructive: keep the
// legacy terms/ordering the other screens still read).
export function normalizeDb(seed) {
  const db = clone(seed);
  (db.companies || []).forEach((c) => {
    c.pricing = c.pricing || { base: null, quantity: null };
    if (typeof c.pricing.base === 'string') {
      c.pricing.base = [{ id: c.pricing.base, priority: 1 }];
    }
    c.orders = orderSeed[c.id] || [];
    (c.locations || []).forEach((l, i) => {
      l.id = l.id || `${c.id}-l${i + 1}`;
      l.status = l.status || 'Active';
      if (l.paymentTerms == null) l.paymentTerms = l.terms && l.terms !== 'Not set' ? l.terms : 'No payment terms';
      if (l.purchasingMode == null) l.purchasingMode = l.ordering === 'You approve first' ? 'REQUIRE_APPROVAL' : 'DIRECT';
      if (l.externalId == null) l.externalId = '';
      if (!l.shipping) l.shipping = { country: 'VN', address1: l.address || '', address2: '', city: '', postal: '', phone: '' };
      if (l.billingSameAsShipping == null) l.billingSameAsShipping = true;
      if (l.editableShipping == null) l.editableShipping = false;
      if (l.taxId == null) l.taxId = '';
      if (!l.taxSettings) l.taxSettings = 'collect';
      if (!l.pricing) l.pricing = { base: null, quantity: null };
    });
  });
  return db;
}

// ── Buyer counts + base-slot mutations ───────────────────────────────────────
export function recomputeBuyers(c) {
  (c.locations || []).forEach((l) => {
    l.buyers = (c.contacts || []).filter((ct) => ct.locations === l.name).length;
  });
}
export function companyBaseArray(c) {
  if (!Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base ? [{ id: c.pricing.base, priority: 1 }] : [];
  return c.pricing.base;
}
export function addCompanyBase(c, policyId, priority) {
  const arr = companyBaseArray(c);
  if (!arr.some((e) => e.id === policyId)) arr.push({ id: policyId, priority: priority || arr.length + 1 });
}
export function removeCompanyBase(c, policyId) {
  if (Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base.filter((e) => e.id !== policyId);
}
export function demoPolicyId(db) {
  let n = db.policies.length + 1;
  while (db.policies.some((p) => p.id === `pq${n}`)) n += 1;
  return `pq${n}`;
}
export function quoteToBasePricing(name, priority, overrides) {
  let p = Math.round(Number(priority));
  if (!Number.isFinite(p)) p = 1;
  return {
    ...newBaseBuilder(),
    name: name || 'Quote prices',
    priority: Math.max(0, Math.min(99, p)),
    type: 'Account-specific',
    // Scope to just the quoted products (god file), so this pricing covers only
    // those SKUs and doesn't shadow the company's other bases for the rest. A
    // scope-all base would claim every product and price non-quoted ones at the
    // Shopify list via pricingRule 'keep'.
    scopeType: 'products',
    collection: '',
    selectedProducts: Object.keys(overrides),
    productAdjustments: overrides,
    explicitEnabled: true,
  };
}

// ── Cross-app handoff (ported from b2b/index.html §8118-8232) ─────────────────

// Build (or match by id/name) a B2B company from an RFQ payload; returns its id.
export function injectRfqCompany(db, p) {
  if (!p || !p.id || !p.name) return null;
  const existing = db.companies.find((c) => c.id === p.id || c.name === p.name);
  // The requester (from the quote) is the person being assigned into a location.
  const reqName = (p.quote && p.quote.buyer) || p.mainContact || p.contactEmail || '';
  const reqEmail = (p.quote && p.quote.email) || p.contactEmail || '';
  let id;
  if (existing) {
    id = existing.id;
    const assigned = p.assignedLocation || (existing.locations[0] && existing.locations[0].name) || '';
    let loc = existing.locations.find((l) => l.name === assigned);
    if (assigned && !loc) {
      loc = { id: `${id}-l${existing.locations.length + 1}`, name: assigned, ordering: 'Quote only', terms: p.terms || 'Not set', lastOrder: null, buyers: 0 };
      existing.locations.push(loc);
    }
    if (reqEmail && !existing.contacts.some((c) => c.email === reqEmail)) {
      existing.contacts.push({ name: reqName || reqEmail, email: reqEmail, role: 'Ordering only', access: 'Quote only', locations: assigned });
      if (loc) loc.buyers = (loc.buyers || 0) + 1;
    }
  } else {
    id = p.id;
    const locNames = ((p.locationList && p.locationList.length) ? p.locationList : [p.locationName || p.name]).slice();
    const assigned = p.assignedLocation || locNames[0];
    if (assigned && locNames.indexOf(assigned) === -1) locNames.push(assigned);
    // Syncing pulls the WHOLE company across — materialize every buyer, not just
    // the requester, so B2B buyer counts match the RFQ signal.
    let contacts = [];
    if (p.buyerList && p.buyerList.length) {
      contacts = p.buyerList.map((b) => ({
        name: b.name || b.email,
        email: b.email,
        role: reqEmail && b.email === reqEmail ? 'Location admin' : 'Ordering only',
        access: 'Quote only',
        locations: reqEmail && b.email === reqEmail ? assigned : (b.location || assigned),
      }));
    }
    if (reqEmail && !contacts.some((c) => c.email === reqEmail)) {
      contacts.push({ name: reqName || reqEmail, email: reqEmail, role: 'Location admin', access: 'Quote only', locations: assigned });
    }
    contacts.forEach((c) => { if (c.locations && locNames.indexOf(c.locations) === -1) locNames.push(c.locations); });
    db.companies.push({
      id, name: p.name, mainContact: reqName || 'Not set',
      source: 'QuoteSnap RFQ', externalId: p.externalId || '',
      pricing: { base: null, quantity: null }, revenue: 0, orders: [],
      locations: locNames.map((ln, i) => ({ id: `${id}-l${i + 1}`, name: ln, ordering: 'Quote only', terms: p.terms || 'Not set', lastOrder: null, buyers: contacts.filter((c) => c.locations === ln).length })),
      contacts,
      quotes: [], exceptions: [], activity: [{ when: 'Today', what: 'Created from QuoteSnap RFQ' }],
    });
  }
  // Bring the originating RFQ quote across too, so the company's Quotes tab shows it.
  if (p.quote && p.quote.id && !db.quotes.some((q) => q.id === p.quote.id && q.company === id)) {
    db.quotes.push({
      id: p.quote.id, company: id,
      buyer: p.quote.buyer || p.mainContact || '', email: p.quote.email || p.contactEmail || '',
      location: p.assignedLocation || p.locationName || p.name,
      created: p.quote.created || 'Today', updated: p.quote.created || 'Today',
      leadScore: null, progress: 'Quote received', status: 'New Received',
      assignee: null, expires: null, source: 'RFQ form',
    });
  }
  return id;
}

// Apply the destination the merchant chose on the RFQ side — create a scoped base
// or merge into an existing one (forking if the base is shared). Returns a toast
// string, or null if nothing applied.
export function applyQuotePricingTransfer(db, companyId, lines, transfer) {
  const co = db.companies.find((c) => c.id === companyId);
  if (!co) return null;
  const priced = (lines || []).filter((l) => l.quoted != null && db.products.some((pr) => pr.sku === l.sku));
  if (!priced.length) return null;
  const overrides = {};
  priced.forEach((l) => { overrides[l.sku] = { rule: 'set', valueType: 'amount', value: Number(l.quoted) }; });
  const tid = transfer && transfer.targetId;
  if (tid === '__new__' || !policyById(db.policies, tid)) {
    const prof = quoteToBasePricing(transfer && transfer.newName ? transfer.newName : `${co.name} quote prices`, transfer && transfer.newPriority, overrides);
    prof.id = demoPolicyId(db);
    db.policies.push(prof);
    addCompanyBase(co, prof.id, prof.priority);
    return `Quote prices saved as “${prof.name}”`;
  }
  const base = policyById(db.policies, tid);
  const usesBase = companyBaseArray(co).some((e) => e.id === base.id);
  const shared = policyUsageCount(base, db) - (usesBase ? 1 : 0) > 0;
  if (shared) {
    const fork = JSON.parse(JSON.stringify(base));
    fork.id = demoPolicyId(db);
    fork.type = 'Account-specific';
    if (fork.name === base.name) fork.name = `${co.name} pricing`;
    fork.productAdjustments = { ...(fork.productAdjustments || {}), ...overrides };
    fork.explicitEnabled = true;
    db.policies.push(fork);
    removeCompanyBase(co, base.id);
    addCompanyBase(co, fork.id, base.priority);
    return `Forked ${base.name} → ${fork.name} with the quote prices`;
  }
  base.productAdjustments = { ...(base.productAdjustments || {}), ...overrides };
  base.explicitEnabled = true;
  return `Quote prices added to ${base.name}`;
}
