import React, { createContext, useContext, useReducer } from 'react';
import { dbSeed, orderSeed } from './data/db.js';
import { shopifyCompanyDirectory } from './data/directory.js';
import { policyById, policyUsageCount } from './pricing.js';
import { DEMO_STATE_KEY, readJSON, consumeHandoff } from '../shared/persistence.js';

// The B2B god file rebuilt #app from a single `state` on every action. Here that
// becomes a reducer: a view state machine + the (mutable) demo db + the handful
// of UI fields the pricing screens need. Fields map 1:1 to spec §4.

const clone = (obj) =>
  typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

// Light normalization at load: legacy scalar `pricing.base:'p1'` → [{id,priority}].
function normalizeDb(seed) {
  const db = clone(seed);
  (db.companies || []).forEach((c) => {
    c.pricing = c.pricing || { base: null, quantity: null };
    if (typeof c.pricing.base === 'string') {
      c.pricing.base = [{ id: c.pricing.base, priority: 1 }];
    }
    c.orders = orderSeed[c.id] || [];
    // Fill the location fields the detail screen edits (non-destructive: keep the
    // legacy terms/ordering the other screens still read). Mirrors normalizeCompany.
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

function makeBaseState() {
  return {
    view: 'customers', // customers | company | pricing | analytics | settings | quote | location
    selectedCompany: 'c1',
    companyTab: 'pricing',
    selectedQuote: null,
    selectedLocation: null,
    // Companies list
    listFilter: 'all',
    companySearch: '',
    companySortField: 'name', // name | locations | status
    companySortDir: 'asc', // asc | desc
    // Base pricing pagination (spec §5.1)
    basePricingSearch: '',
    basePage: 1,
    basePageSize: 5,
    // Pricing editor (spec §5.3)
    builder: null, // working policy copy, or null when the editor is closed
    ruleEdit: null, // index of the conditional-rule open for inline edit
    addRuleMenu: false,
    editorContext: null, // { mode:'edit'|'add-base'|'swap', companyId, swapId }
    // Build pricing from closed quotes (spec §5.4)
    buildQuotes: null, // { companyId, rows:[{sku,quoted,proposed,from}], dest }
    priceBoard: null, // { companyId, search } — resolved-prices preview
    assign: null, // { companyId, mode:'add'|'swap', swapId, selectedId } — assign/swap base
    assignMulti: null, // { policyId } — assign one policy to many companies/customers/tags/global
    addCompany: null, // { step, shopifyId, baseId } — add-company wizard
    db: normalizeDb(dbSeed),
    toast: null,
  };
}

// Initial state, applying cross-app persistence + handoff from the RFQ app
// (legacy restoreRfqCompanies + receiveRfqHandoff at b2b/index.html §8190-8262).
function buildInitialState() {
  const s = makeBaseState();
  // 1) Rebuild every company created/synced from RFQ, persisted across reloads.
  const demo = readJSON(DEMO_STATE_KEY);
  if (demo && demo.b2bCompanies) {
    Object.values(demo.b2bCompanies).forEach((p) => injectRfqCompany(s.db, p));
  }
  // 2) One-shot handoff: open the specific company just handed over from RFQ.
  const handoff = consumeHandoff();
  if (handoff) {
    const id = injectRfqCompany(s.db, handoff);
    if (id) {
      s.view = 'company';
      s.selectedCompany = id;
      const lines = handoff.quote && Array.isArray(handoff.quote.lines) ? handoff.quote.lines : [];
      const hasLines = lines.length > 0;
      s.companyTab = hasLines && handoff.pricingTransfer ? 'pricing' : 'locations';
      if (hasLines && handoff.pricingTransfer) {
        s.toast = applyQuotePricingTransfer(s.db, id, lines, handoff.pricingTransfer);
      }
    }
  }
  return s;
}

let _ruleSeq = 1;
export function newRule(field) {
  return {
    id: `crn${_ruleSeq++}`,
    conditions: [{ field, operator: 'is', values: [] }],
    match: 'ALL',
    rule: 'decrease',
    valueType: 'percentage',
    value: 10,
  };
}

export function newBaseBuilder() {
  return {
    id: null,
    name: 'New base pricing',
    priority: 99,
    priceKind: 'base',
    audienceType: 'b2b',
    status: 'Active',
    type: 'Reusable',
    scopeType: 'all',
    collection: 'All B2B products',
    selectedProducts: [],
    pricingRule: 'keep',
    valueType: 'percentage',
    value: 0,
    productAdjustments: {},
    explicitEnabled: false,
    conditionalRules: [],
    fallback: 'keep',
    validityType: 'evergreen',
    startDate: '',
    endDate: '',
  };
}

export function newQuantityBuilder() {
  return {
    ...newBaseBuilder(),
    name: 'New quantity pricing',
    priceKind: 'quantity',
    scopeType: 'products',
    volumeRanges: [
      { from: 1, to: 9, valueType: 'percentage', value: 0 },
      { from: 10, to: null, valueType: 'percentage', value: 10 },
    ],
    volumeBasis: 'shopify', // 'shopify' | 'base'
    quantityBasis: 'all_selected', // all_selected | per_product | per_variant
  };
}

// ── Cross-app handoff helpers (ported from b2b/index.html §8118-8232) ─────────

// Build (or match by id/name) a B2B company from an RFQ payload; returns its id.
function injectRfqCompany(db, p) {
  if (!p || !p.id || !p.name) return null;
  const existing = db.companies.find((c) => c.id === p.id || c.name === p.name);
  // The requester (from the quote) is the person being assigned into a location.
  const reqName = (p.quote && p.quote.buyer) || p.mainContact || p.contactEmail || '';
  const reqEmail = (p.quote && p.quote.email) || p.contactEmail || '';
  let id;
  if (existing) {
    id = existing.id;
    const assigned = p.assignedLocation || (existing.locations[0] && existing.locations[0].name) || '';
    // A location created during the flow may be new to this company — add it.
    let loc = existing.locations.find((l) => l.name === assigned);
    if (assigned && !loc) {
      loc = { id: `${id}-l${existing.locations.length + 1}`, name: assigned, ordering: 'Quote only', terms: p.terms || 'Not set', lastOrder: null, buyers: 0 };
      existing.locations.push(loc);
    }
    // Add the requester as a contact at the assigned location, if not already there.
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

function demoPolicyId(db) {
  let n = db.policies.length + 1;
  while (db.policies.some((p) => p.id === `pq${n}`)) n += 1;
  return `pq${n}`;
}

function recomputeBuyers(c) {
  (c.locations || []).forEach((l) => {
    l.buyers = (c.contacts || []).filter((ct) => ct.locations === l.name).length;
  });
}

function companyBaseArray(c) {
  if (!Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base ? [{ id: c.pricing.base, priority: 1 }] : [];
  return c.pricing.base;
}
function addCompanyBase(c, policyId, priority) {
  const arr = companyBaseArray(c);
  if (!arr.some((e) => e.id === policyId)) arr.push({ id: policyId, priority: priority || arr.length + 1 });
}
function removeCompanyBase(c, policyId) {
  if (Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base.filter((e) => e.id !== policyId);
}
function quoteToBasePricing(name, priority, overrides) {
  return {
    ...newBaseBuilder(),
    name: name || 'Quote prices',
    priority: Number(priority) || 1,
    type: 'Account-specific',
    productAdjustments: overrides,
    explicitEnabled: true,
  };
}

// Apply the destination the merchant chose on the RFQ side — create a scoped
// base or merge into an existing one (forking if the base is shared). Returns a
// toast string, or null if nothing applied.
function applyQuotePricingTransfer(db, companyId, lines, transfer) {
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

function reducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, view: action.view, ...(action.patch || {}) };
    case 'OPEN_COMPANY':
      return { ...state, view: 'company', selectedCompany: action.id, companyTab: action.tab || 'pricing' };
    case 'SET_COMPANY_TAB':
      return { ...state, companyTab: action.tab };
    case 'OPEN_QUOTE':
      return { ...state, view: 'quote', selectedQuote: action.id };
    case 'OPEN_LOCATION':
      return { ...state, view: 'location', selectedCompany: action.companyId, selectedLocation: action.locationId };
    // Per-location pricing override (base or quantity). Empty policyId reverts to
    // the inherited company pricing for that kind.
    case 'SET_LOCATION_PRICING': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const l = c?.locations?.find((x) => x.id === action.locationId);
      if (l) {
        l.pricing = l.pricing || { base: null, quantity: null };
        // Back-compat: older callers pass `baseId`; newer pass `kind` + `policyId`.
        const kind = action.kind || 'base';
        const policyId = action.policyId !== undefined ? action.policyId : action.baseId;
        l.pricing[kind] = policyId || null;
      }
      return { ...state, db, toast: (action.policyId ?? action.baseId) ? 'Location pricing overridden' : 'Reverted to company pricing' };
    }
    // Assign / remove a buyer (contact) at a location. Buyer counts derive from
    // contact assignment, so recompute every location's count on change.
    case 'ASSIGN_BUYER': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const l = c?.locations?.find((x) => x.id === action.locationId);
      const ct = c?.contacts?.find((x) => x.email === action.email);
      if (c && l && ct) {
        ct.locations = l.name;
        if (action.role) ct.role = action.role;
        recomputeBuyers(c);
      }
      return { ...state, db, toast: 'Buyer assigned' };
    }
    case 'UNASSIGN_BUYER': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const ct = c?.contacts?.find((x) => x.email === action.email);
      if (c && ct) {
        ct.locations = '';
        recomputeBuyers(c);
      }
      return { ...state, db, toast: 'Buyer removed' };
    }
    // Live edit of a location's fields (general / shipping / commerce settings).
    case 'SET_LOCATION_FIELD': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const l = c?.locations?.find((x) => x.id === action.locationId);
      if (l) Object.assign(l, action.patch);
      return { ...state, db, ...(action.silent ? {} : { toast: 'Location updated' }) };
    }
    case 'OPEN_PRICE_BOARD':
      return { ...state, priceBoard: { companyId: action.companyId, search: '' } };
    case 'PRICE_BOARD_PATCH':
      return { ...state, priceBoard: { ...state.priceBoard, ...action.patch } };
    case 'CLOSE_PRICE_BOARD':
      return { ...state, priceBoard: null };
    // ----- Assign / swap base pricing -----
    case 'OPEN_ASSIGN':
      return { ...state, assign: { companyId: action.companyId, mode: action.mode, kind: action.kind || 'base', swapId: action.swapId || null, selectedId: null } };
    case 'ASSIGN_SELECT':
      return { ...state, assign: { ...state.assign, selectedId: action.id } };
    case 'CLOSE_ASSIGN':
      return { ...state, assign: null };
    case 'ASSIGN_CONFIRM': {
      const a = state.assign;
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === a.companyId);
      if (c && a.selectedId) {
        c.pricing = c.pricing || { base: null, quantity: null };
        if (a.kind === 'quantity') {
          c.pricing.quantity = a.selectedId;
        } else {
          if (!Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base ? [{ id: c.pricing.base, priority: 1 }] : [];
          const pol = db.policies.find((p) => p.id === a.selectedId);
          if (a.mode === 'swap') {
            const idx = c.pricing.base.findIndex((e) => e.id === a.swapId);
            if (idx >= 0) c.pricing.base[idx] = { id: a.selectedId, priority: pol?.priority ?? c.pricing.base[idx].priority };
          } else if (!c.pricing.base.some((e) => e.id === a.selectedId)) {
            c.pricing.base.push({ id: a.selectedId, priority: pol?.priority ?? c.pricing.base.length + 1 });
          }
        }
      }
      const label = a.kind === 'quantity' ? 'Quantity pricing' : 'Base pricing';
      return { ...state, db, assign: null, toast: a.mode === 'swap' ? `${label} changed` : `${label} added` };
    }
    case 'REMOVE_COMPANY_QUANTITY': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      if (c && c.pricing) c.pricing.quantity = null;
      return { ...state, db, toast: 'Quantity pricing removed' };
    }
    // ----- Assign one policy to many targets (companies / customers / tags / global) -----
    case 'OPEN_MULTI_ASSIGN':
      return { ...state, assignMulti: { policyId: action.policyId } };
    case 'CLOSE_MULTI_ASSIGN':
      return { ...state, assignMulti: null };
    case 'MULTI_ASSIGN': {
      const db = clone(state.db);
      const pol = db.policies.find((p) => p.id === action.policyId);
      if (!pol) return { ...state, assignMulti: null };
      const kind = pol.priceKind === 'quantity' ? 'quantity' : 'base';
      const ids = action.ids || [];
      if (action.targetType === 'company') {
        ids.forEach((id) => {
          const c = db.companies.find((x) => x.id === id);
          if (!c) return;
          c.pricing = c.pricing || { base: null, quantity: null };
          if (kind === 'quantity') c.pricing.quantity = pol.id;
          else addCompanyBase(c, pol.id, pol.priority);
        });
      } else if (action.targetType === 'customer') {
        ids.forEach((id) => {
          const cu = (db.customers || []).find((x) => x.id === id);
          if (cu) cu.policyId = pol.id;
        });
      } else if (action.targetType === 'tag') {
        ids.forEach((id) => {
          const t = (db.tagPricing || []).find((x) => x.id === id);
          if (t) t.defaultPolicyId = pol.id;
        });
      } else if (action.targetType === 'global') {
        db.defaults = { ...(db.defaults || {}), [pol.audienceType === 'd2c' ? 'wholesalePolicyId' : 'b2bPolicyId']: pol.id };
      }
      return { ...state, db, assignMulti: null, toast: `${pol.name} assigned` };
    }
    // ----- Add-company wizard -----
    case 'OPEN_ADD_COMPANY':
      return { ...state, addCompany: { step: 1, shopifyId: null, baseId: '' } };
    case 'ADD_COMPANY_PATCH':
      return { ...state, addCompany: { ...state.addCompany, ...action.patch } };
    case 'ADD_COMPANY_STEP':
      return { ...state, addCompany: { ...state.addCompany, step: action.step } };
    case 'CLOSE_ADD_COMPANY':
      return { ...state, addCompany: null };
    case 'ADD_COMPANY_CONFIRM': {
      const ac = state.addCompany;
      const shp = Object.values(shopifyCompanyDirectory).find((s) => s.id === ac.shopifyId);
      if (!shp) return { ...state, addCompany: null };
      const db = clone(state.db);
      const id = `c${db.companies.length + 1}`;
      db.companies.push({
        id,
        name: shp.name,
        mainContact: shp.contacts?.[0]?.name || '',
        source: 'Company application',
        pricing: { base: ac.baseId ? [{ id: ac.baseId, priority: 1 }] : null, quantity: null },
        revenue: 0,
        locations: (shp.locations || []).map((l) => ({ id: l.id, name: l.name, terms: l.terms, ordering: l.ordering, buyers: 0, lastOrder: '—' })),
        contacts: (shp.contacts || []).map((c) => ({ name: c.name, email: c.email, role: c.role, access: c.access, locations: c.location })),
        quotes: [],
        exceptions: [],
        activity: [],
        orders: [],
        shopifyCompanyId: ac.shopifyId,
      });
      return { ...state, db, addCompany: null, view: 'company', selectedCompany: id, companyTab: 'pricing', toast: 'Company added' };
    }
    case 'SET_LIST_FILTER':
      return { ...state, listFilter: action.filter };
    case 'SET_COMPANY_SEARCH':
      return { ...state, companySearch: action.value };
    case 'SET_COMPANY_SORT':
      return { ...state, companySortField: action.field, companySortDir: action.dir };
    case 'DELETE_COMPANY': {
      const db = clone(state.db);
      db.companies = db.companies.filter((c) => c.id !== action.id);
      db.quotes = (db.quotes || []).filter((q) => q.company !== action.id);
      const goList = state.selectedCompany === action.id;
      return {
        ...state,
        db,
        ...(goList ? { view: 'customers', selectedCompany: db.companies[0]?.id || null } : {}),
        toast: 'Company deleted',
      };
    }
    // Base pricing pagination
    case 'BASE_SEARCH':
      return { ...state, basePricingSearch: action.value, basePage: 1 };
    case 'BASE_PAGE_SIZE':
      return { ...state, basePageSize: action.size, basePage: 1 };
    case 'BASE_PAGE':
      return { ...state, basePage: action.page };
    // ----- Pricing editor -----
    case 'OPEN_EDITOR':
      return {
        ...state,
        builder: action.policy
          ? clone(action.policy)
          : action.kind === 'quantity'
          ? newQuantityBuilder()
          : newBaseBuilder(),
        ruleEdit: null,
        addRuleMenu: false,
        editorContext: action.context || null,
      };
    // Switch the pricing type of a NEW (unsaved) builder, keeping name/priority/audience.
    case 'SWITCH_KIND': {
      if (!state.builder || state.builder.id) return state;
      const fresh = action.kind === 'quantity' ? newQuantityBuilder() : newBaseBuilder();
      return {
        ...state,
        builder: { ...fresh, name: state.builder.name, priority: state.builder.priority, audienceType: state.builder.audienceType },
        ruleEdit: null,
        addRuleMenu: false,
      };
    }
    case 'CLOSE_EDITOR':
      return { ...state, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null };
    case 'BUILDER_PATCH':
      return { ...state, builder: { ...state.builder, ...action.patch } };
    case 'SET_RULE_EDIT':
      return { ...state, ruleEdit: action.index, addRuleMenu: false };
    case 'TOGGLE_ADD_RULE_MENU':
      return { ...state, addRuleMenu: action.open != null ? action.open : !state.addRuleMenu };
    case 'ADD_RULE': {
      const rules = [...(state.builder.conditionalRules || []), newRule(action.field)];
      return { ...state, builder: { ...state.builder, conditionalRules: rules }, ruleEdit: rules.length - 1, addRuleMenu: false };
    }
    case 'UPDATE_RULE': {
      const rules = (state.builder.conditionalRules || []).map((r, i) =>
        i === action.index ? { ...r, ...action.patch } : r,
      );
      return { ...state, builder: { ...state.builder, conditionalRules: rules } };
    }
    case 'DELETE_RULE': {
      const rules = (state.builder.conditionalRules || []).filter((_, i) => i !== action.index);
      let ruleEdit = state.ruleEdit;
      if (ruleEdit === action.index) ruleEdit = null;
      else if (ruleEdit != null && ruleEdit > action.index) ruleEdit -= 1;
      return { ...state, builder: { ...state.builder, conditionalRules: rules }, ruleEdit };
    }
    case 'MOVE_RULE': {
      const rules = [...(state.builder.conditionalRules || [])];
      const { from, to } = action;
      if (from < 0 || from >= rules.length || to < 0 || to >= rules.length || from === to) return state;
      const edited = state.ruleEdit != null ? rules[state.ruleEdit] : null;
      const [it] = rules.splice(from, 1);
      rules.splice(to, 0, it);
      const ruleEdit = edited ? rules.indexOf(edited) : state.ruleEdit;
      return { ...state, builder: { ...state.builder, conditionalRules: rules }, ruleEdit: ruleEdit >= 0 ? ruleEdit : null };
    }
    case 'SAVE_EDITOR': {
      const b = state.builder;
      // Prune conditional rules with no chosen value or no real adjustment
      // (legacy validConditionalRule), and derive explicitEnabled from overrides.
      const cleanRules = (b.conditionalRules || []).filter(
        (r) =>
          (r.conditions || []).some((c) =>
            Array.isArray(c.values) ? c.values.filter(Boolean).length : c.value != null && c.value !== '',
          ) && r.rule && r.rule !== 'keep',
      );
      const draft = {
        ...b,
        conditionalRules: cleanRules,
        explicitEnabled: Object.keys(b.productAdjustments || {}).length > 0,
      };
      if (!draft.name || !draft.name.trim()) {
        return { ...state, toast: 'Give the pricing a name' };
      }
      const db = clone(state.db);
      const existing = db.policies.find((p) => p.id === b.id);
      if (!existing) {
        const id = `pN${db.policies.length + 1}`;
        db.policies.push({ ...newBaseBuilder(), ...draft, id });
        const c = db.companies.find((x) => x.id === (state.editorContext?.companyId || state.selectedCompany));
        if (c) addCompanyBase(c, id, draft.priority);
        return { ...state, db, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null, toast: 'Pricing saved' };
      }
      // Editing an existing profile. If it is SHARED (assigned beyond the company
      // we are editing from) and we are editing from a company scope, fork an
      // account-specific copy so the edit does not silently change every assignee
      // — unless the merchant explicitly chose "apply to all" (action.applyToAll).
      const scopeCompany = state.editorContext?.companyId
        ? db.companies.find((x) => x.id === state.editorContext.companyId)
        : null;
      const usage = policyUsageCount({ id: b.id }, db);
      const usesHere = scopeCompany ? companyBaseArray(scopeCompany).some((e) => e.id === b.id) : false;
      const sharedElsewhere = usage - (usesHere ? 1 : 0) > 0;
      if (scopeCompany && sharedElsewhere && !action.applyToAll) {
        const fork = JSON.parse(JSON.stringify(existing));
        Object.assign(fork, draft, { id: demoPolicyId(db), type: 'Account-specific' });
        if (fork.name === existing.name) fork.name = `${scopeCompany.name} ${existing.name}`;
        db.policies.push(fork);
        removeCompanyBase(scopeCompany, existing.id);
        addCompanyBase(scopeCompany, fork.id, draft.priority);
        return { ...state, db, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null, toast: `Forked into ${fork.name}` };
      }
      Object.assign(existing, draft, { id: existing.id });
      return { ...state, db, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null, toast: 'Pricing saved' };
    }
    // ----- Pricing library actions -----
    case 'DELETE_POLICY': {
      const db = clone(state.db);
      db.policies = db.policies.filter((p) => p.id !== action.id);
      db.companies.forEach((c) => {
        if (Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base.filter((e) => e.id !== action.id);
        if (c.pricing.quantity === action.id) c.pricing.quantity = null;
        (c.locations || []).forEach((l) => {
          if (l.pricing) {
            if (l.pricing.base === action.id) l.pricing.base = null;
            if (l.pricing.quantity === action.id) l.pricing.quantity = null;
          }
        });
      });
      return { ...state, db, toast: 'Pricing deleted' };
    }
    case 'TOGGLE_POLICY_STATUS': {
      const db = clone(state.db);
      const p = db.policies.find((x) => x.id === action.id);
      if (p) p.status = p.status === 'Inactive' ? 'Active' : 'Inactive';
      return { ...state, db, toast: p && p.status === 'Inactive' ? 'Pricing turned off' : 'Pricing turned on' };
    }
    // Store-wide default pricing (All Companies / All customers) — consulted by
    // the resolution engine's fallback (resolvePricing / companyNeedsPrice).
    case 'SET_DEFAULT_POLICY': {
      const db = clone(state.db);
      db.defaults = { ...(db.defaults || {}), [action.key]: action.value || null };
      return { ...state, db, toast: 'Default pricing updated' };
    }
    // ----- Base pricing card actions -----
    case 'REMOVE_COMPANY_BASE': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      if (c && Array.isArray(c.pricing.base)) {
        c.pricing.base = c.pricing.base.filter((e) => e.id !== action.policyId);
      }
      return { ...state, db, toast: 'Base pricing removed' };
    }
    // ----- Build from closed quotes -----
    case 'OPEN_BUILD_QUOTES':
      return { ...state, buildQuotes: action.payload };
    case 'CLOSE_BUILD_QUOTES':
      return { ...state, buildQuotes: null };
    case 'BUILD_QUOTES_PATCH':
      return { ...state, buildQuotes: { ...state.buildQuotes, ...action.patch } };
    case 'APPLY_BUILD_QUOTES': {
      const db = clone(state.db);
      const companyId = state.buildQuotes?.companyId;
      const co = db.companies.find((c) => c.id === companyId);
      const lines = (action.rows || [])
        .filter((r) => Number(r.proposed) > 0)
        .map((r) => ({ sku: r.sku, quoted: Number(r.proposed) }));
      const transfer = {
        targetId: action.dest,
        newName: action.dest === '__new__' ? `${(co && co.name) || 'Company'} quote prices` : '',
        newPriority: 1,
      };
      // Same engine as the RFQ→B2B handoff: create a scoped base, or merge into
      // the chosen base — forking it first if it is shared with other companies.
      const msg = applyQuotePricingTransfer(db, companyId, lines, transfer) || 'No prices to add';
      return { ...state, db, buildQuotes: null, toast: msg };
    }
    case 'TOAST':
      return { ...state, toast: action.message };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export const currentCompany = (state) =>
  state.db.companies.find((c) => c.id === state.selectedCompany) || null;
