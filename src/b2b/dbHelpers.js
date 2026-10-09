// Pure demo-db helpers: deep clone, load-time normalization, the RFQ→B2B company
// injection, and the pricing-slot mutations (add/remove base, fork-on-transfer).
// These are separate from the reducer so both the reducer and the initial-state
// builder can share them.
import { orderSeed } from './data/db.js';
import { policyById, policyUsageCount, slotIds } from './pricing.js';
import { newBaseBuilder } from './builders.js';
import { money } from './format.js';

export const clone = (obj) =>
  typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

// Light normalization at load: legacy scalar `pricing.base:'p1'` (or quantity) → [{id,priority}],
// and fill the location fields the detail screen edits (non-destructive: keep the
// legacy terms/ordering the other screens still read).
export function normalizeDb(seed) {
  const db = clone(seed);
  (db.companies || []).forEach((c) => {
    c.pricing = c.pricing || { base: null, quantity: null };
    ['base', 'quantity'].forEach((k) => {
      if (typeof c.pricing[k] === 'string') c.pricing[k] = [{ id: c.pricing[k], priority: 1 }];
    });
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
// A company's list of one kind ('base' | 'quantity'), normalized in place.
export function companySlotArray(c, kind) {
  c.pricing = c.pricing || { base: null, quantity: null };
  const v = c.pricing[kind];
  if (!Array.isArray(v)) c.pricing[kind] = v ? [{ id: v, priority: 1 }] : [];
  return c.pricing[kind];
}
export function addCompanySlot(c, kind, policyId, priority) {
  const arr = companySlotArray(c, kind);
  if (!arr.some((e) => e.id === policyId)) arr.push({ id: policyId, priority: priority || arr.length + 1 });
}
export function removeCompanySlot(c, kind, policyId) {
  const v = c.pricing && c.pricing[kind];
  if (Array.isArray(v)) c.pricing[kind] = v.filter((e) => e.id !== policyId);
  else if (v === policyId) c.pricing[kind] = null;
}
// A location's own list of a kind. The first time it gets one it starts from what
// it inherited from the company (its own list replaces the company's), so adding
// or removing a pricing changes the list the location already had. An empty own
// list stays empty (the location has none of that kind) — see hasOwnSlot.
export function locationSlotArray(c, l, kind) {
  l.pricing = l.pricing || { base: null, quantity: null };
  if (l.pricing[kind] == null) l.pricing[kind] = companySlotArray(c, kind).map((e) => ({ ...e }));
  return companySlotArray(l, kind);
}
// Add a pricing to a company's locations — all of them (the company's list, which
// locations added later inherit, plus any location keeping its own list) or only
// some (each one's own list). Picking every location counts as all. `later` false:
// all of today's locations but not ones added later — each gets it in its own list.
// Some with `later`: locations added later get it too, so the company holds it and
// each location not picked keeps its own list without it.
export function addPricingToLocations(c, kind, policyId, priority, locationIds, later = true) {
  const locs = c.locations || [];
  const ensure = (list) => {
    if (!list.some((e) => e.id === policyId)) list.push({ id: policyId, priority: priority || list.length + 1 });
  };
  const some = !!(locationIds && locationIds.length && locationIds.length < locs.length);
  if (!some && (later || !locs.length)) {
    addCompanySlot(c, kind, policyId, priority);
    locs.forEach((l) => l.pricing && l.pricing[kind] != null && ensure(locationSlotArray(c, l, kind)));
    return;
  }
  const ids = some ? locationIds : locs.map((l) => l.id);
  locs.filter((l) => ids.includes(l.id)).forEach((l) => ensure(locationSlotArray(c, l, kind)));
  if (some && later) {
    // Copied before the company gets it, so the ones not picked don't.
    locs.filter((l) => !ids.includes(l.id)).forEach((l) => locationSlotArray(c, l, kind));
    addCompanySlot(c, kind, policyId, priority);
  }
}
export const companyBaseArray = (c) => companySlotArray(c, 'base');
export const addCompanyBase = (c, policyId, priority) => addCompanySlot(c, 'base', policyId, priority);
export const removeCompanyBase = (c, policyId) => removeCompanySlot(c, 'base', policyId);
export function demoPolicyId(db) {
  let n = db.policies.length + 1;
  while (db.policies.some((p) => p.id === `pq${n}`)) n += 1;
  return `pq${n}`;
}
export function quoteToBasePricing(name, priority, overrides, status) {
  let p = Math.round(Number(priority));
  if (!Number.isFinite(p)) p = 1;
  return {
    ...newBaseBuilder(),
    name: name || 'Quote prices',
    priority: Math.max(0, Math.min(99, p)),
    status: status === 'Inactive' ? 'Inactive' : 'Active',
    type: 'Account-specific',
    // Scope to just the quoted products (god file), so this pricing covers only
    // those SKUs and doesn't shadow the company's other bases for the rest. A
    // scope-all base would claim every product and price non-quoted ones at the
    // Shopify list via pricingRule 'keep'.
    scopeType: 'products',
    collection: '',
    selectedProducts: Object.keys(overrides),
    variantAdjustments: overrides,
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
  // Target: the company's base list, or (transfer.locationId) that location's own.
  const loc = transfer && transfer.locationId ? (co.locations || []).find((l) => l.id === transfer.locationId) : null;
  const addBase = (id, priority) => {
    if (!loc) return addCompanyBase(co, id, priority);
    const list = locationSlotArray(co, loc, 'base');
    if (!list.some((e) => e.id === id)) list.push({ id, priority: priority || list.length + 1 });
  };
  const tid = transfer && transfer.targetId;
  if (tid === '__new__' || !policyById(db.policies, tid)) {
    const prof = quoteToBasePricing(
      transfer && transfer.newName ? transfer.newName : `${co.name} quote prices`,
      transfer && transfer.newPriority,
      overrides,
      transfer && transfer.status,
    );
    prof.id = demoPolicyId(db);
    db.policies.push(prof);
    addBase(prof.id, prof.priority);
    return 'Quote prices saved';
  }
  const base = policyById(db.policies, tid);
  const usesBase = loc ? slotIds(loc, 'base').includes(base.id) : companyBaseArray(co).some((e) => e.id === base.id);
  const shared = policyUsageCount(base, db) - (usesBase ? 1 : 0) > 0;
  if (shared && !(transfer && transfer.updateShared)) {
    const fork = JSON.parse(JSON.stringify(base));
    fork.id = demoPolicyId(db);
    fork.type = 'Account-specific';
    if (fork.name === base.name) fork.name = `${loc ? `${co.name} · ${loc.name}` : co.name} pricing`;
    fork.variantAdjustments = { ...(fork.variantAdjustments || {}), ...overrides };
    fork.explicitEnabled = true;
    db.policies.push(fork);
    if (loc) {
      // The copy takes the original's place in the location's own list.
      const list = locationSlotArray(co, loc, 'base');
      const idx = list.findIndex((e) => e.id === base.id);
      if (idx >= 0) list[idx] = { id: fork.id, priority: list[idx].priority };
      else list.push({ id: fork.id, priority: base.priority || list.length + 1 });
    } else {
      removeCompanyBase(co, base.id);
      addCompanyBase(co, fork.id, base.priority);
    }
    return 'Pricing forked';
  }
  base.variantAdjustments = { ...(base.variantAdjustments || {}), ...overrides };
  base.explicitEnabled = true;
  return 'Quote prices added';
}

// Order requests from the storefront (a cart over a review threshold) wait as held
// orders: draft orders for the merchant to approve or decline. Adds the ones that
// aren't there yet, numbered after the newest order. Mutates `db`.
export function injectOrderRequests(db, requests) {
  const all = (db.companies || []).flatMap((c) => c.orders || []);
  let next = Math.max(1000, ...all.map((o) => Number(String(o.id).replace(/\D/g, '')) || 0)) + 1;
  requests.forEach((r) => {
    const c = (db.companies || []).find((x) => x.id === r.companyId);
    if (!c || all.some((o) => o.requestId === r.id)) return;
    const loc = (c.locations || []).find((l) => l.id === r.locationId);
    const order = {
      id: `#${next++}`, requestId: r.id, location: loc?.name || '', buyer: r.buyer, date: r.date, amount: r.amount, lines: r.lines.length, po: '',
      pricing: r.priceList || '', pricingSource: 'Company price', source: 'Storefront order request',
      status: 'Needs review', shopifyStatus: 'Draft order', reason: `Above the ${money(r.threshold)} review threshold`, heldBy: r.limitId,
    };
    c.orders = [order, ...(c.orders || [])];
    all.push(order);
  });
  return db;
}
