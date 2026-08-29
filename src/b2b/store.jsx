import React, { createContext, useContext, useReducer } from 'react';
import { dbSeed, orderSeed } from './data/db.js';
import { shopifyCompanyDirectory } from './data/directory.js';

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

const initialState = {
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
  const [state, dispatch] = useReducer(reducer, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export const currentCompany = (state) =>
  state.db.companies.find((c) => c.id === state.selectedCompany) || null;
