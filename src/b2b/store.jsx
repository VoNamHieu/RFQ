import React, { createContext, useContext, useReducer } from 'react';
import { dbSeed, orderSeed } from './data/db.js';
import { shopifyCompanyDirectory } from './data/directory.js';
import { policyById } from './pricing.js';
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

function policyUsageCount(db, policyId) {
  let n = 0;
  (db.companies || []).forEach((c) => {
    const base = c.pricing && c.pricing.base;
    const ids = Array.isArray(base) ? base.map((e) => e.id) : base ? [base] : [];
    if (ids.includes(policyId) || (c.pricing && c.pricing.quantity === policyId)) n += 1;
  });
  return n;
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
  const shared = policyUsageCount(db, base.id) - (usesBase ? 1 : 0) > 0;
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
    // v1 per-location pricing override
    case 'SET_LOCATION_PRICING': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const l = c?.locations?.find((x) => x.id === action.locationId);
      if (l) l.pricing = { base: action.baseId || null, quantity: l.pricing?.quantity || null };
      return { ...state, db, toast: action.baseId ? 'Location pricing overridden' : 'Reverted to company pricing' };
    }
    case 'OPEN_PRICE_BOARD':
      return { ...state, priceBoard: { companyId: action.companyId, search: '' } };
    case 'PRICE_BOARD_PATCH':
      return { ...state, priceBoard: { ...state.priceBoard, ...action.patch } };
    case 'CLOSE_PRICE_BOARD':
      return { ...state, priceBoard: null };
    // ----- Assign / swap base pricing -----
    case 'OPEN_ASSIGN':
      return { ...state, assign: { companyId: action.companyId, mode: action.mode, swapId: action.swapId || null, selectedId: null } };
    case 'ASSIGN_SELECT':
      return { ...state, assign: { ...state.assign, selectedId: action.id } };
    case 'CLOSE_ASSIGN':
      return { ...state, assign: null };
    case 'ASSIGN_CONFIRM': {
      const a = state.assign;
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === a.companyId);
      if (c && a.selectedId) {
        if (!Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base ? [{ id: c.pricing.base, priority: 1 }] : [];
        const pol = db.policies.find((p) => p.id === a.selectedId);
        if (a.mode === 'swap') {
          const idx = c.pricing.base.findIndex((e) => e.id === a.swapId);
          if (idx >= 0) c.pricing.base[idx] = { id: a.selectedId, priority: pol?.priority ?? c.pricing.base[idx].priority };
        } else if (!c.pricing.base.some((e) => e.id === a.selectedId)) {
          c.pricing.base.push({ id: a.selectedId, priority: pol?.priority ?? c.pricing.base.length + 1 });
        }
      }
      return { ...state, db, assign: null, toast: a.mode === 'swap' ? 'Base pricing changed' : 'Base pricing added' };
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
        builder: action.policy ? clone(action.policy) : newBaseBuilder(),
        ruleEdit: null,
        addRuleMenu: false,
        editorContext: action.context || null,
      };
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
      const db = clone(state.db);
      const existing = db.policies.find((p) => p.id === b.id);
      if (existing) {
        Object.assign(existing, {
          name: b.name,
          priority: b.priority,
          conditionalRules: b.conditionalRules,
          productAdjustments: b.productAdjustments,
          volumeRanges: b.volumeRanges,
          pricingRule: b.pricingRule,
          valueType: b.valueType,
          value: b.value,
          displayTitle: b.displayTitle,
          priceBadge: b.priceBadge,
        });
      } else {
        const id = `pN${db.policies.length + 1}`;
        db.policies.push({ ...newBaseBuilder(), ...b, id });
        const c = db.companies.find((x) => x.id === (state.editorContext?.companyId || state.selectedCompany));
        if (c) {
          if (!Array.isArray(c.pricing.base)) c.pricing.base = c.pricing.base ? [{ id: c.pricing.base, priority: 1 }] : [];
          c.pricing.base.push({ id, priority: b.priority || c.pricing.base.length + 1 });
        }
      }
      return { ...state, db, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null, toast: 'Pricing saved' };
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
      const priced = (action.rows || []).filter((r) => Number(r.proposed) > 0);
      const policy = db.policies.find((p) => p.id === action.dest);
      if (policy) {
        policy.productAdjustments = { ...(policy.productAdjustments || {}) };
        priced.forEach((r) => {
          policy.productAdjustments[r.sku] = { rule: 'set', valueType: 'amount', value: Number(r.proposed) };
        });
        policy.explicitEnabled = Object.keys(policy.productAdjustments).length > 0;
      }
      return { ...state, db, buildQuotes: null, toast: 'Prices added to base pricing' };
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
