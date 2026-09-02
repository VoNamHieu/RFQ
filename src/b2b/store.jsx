import React, { createContext, useContext, useReducer } from 'react';
import { shopifyCompanyDirectory } from './data/directory.js';
import { policyUsageCount } from './pricing.js';
import { newRule, newBaseBuilder, newQuantityBuilder } from './builders.js';
import { buildInitialState } from './initialState.js';
import {
  clone,
  companyBaseArray,
  addCompanyBase,
  removeCompanyBase,
  demoPolicyId,
  recomputeBuyers,
  applyQuotePricingTransfer,
} from './dbHelpers.js';

// The B2B god file rebuilt #app from a single `state` on every action. Here that
// is a reducer over a view state machine + the mutable demo db. The db helpers,
// builders and initial-state assembly live in sibling modules (dbHelpers.js,
// builders.js, initialState.js).

// Re-exported so screens keep one import surface (e.g. BuildFromQuotes needs newBaseBuilder).
export { newRule, newBaseBuilder, newQuantityBuilder } from './builders.js';

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
    case 'ADD_LOCATION': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      if (c) {
        c.locations = c.locations || [];
        const id = `${c.id}-l${c.locations.length + 1}`;
        const approval = action.purchasingMode === 'REQUIRE_APPROVAL';
        c.locations.push({
          id,
          name: action.name,
          status: 'Active',
          paymentTerms: action.paymentTerms || 'No payment terms',
          purchasingMode: action.purchasingMode || 'DIRECT',
          ordering: approval ? 'You approve first' : 'Buys directly',
          terms: action.paymentTerms || 'Not set',
          externalId: action.externalId || '',
          shipping: { country: 'VN', address1: '', address2: '', city: '', postal: '', phone: '' },
          billingSameAsShipping: true,
          editableShipping: false,
          taxId: '',
          taxSettings: 'collect',
          pricing: { base: null, quantity: null },
          buyers: 0,
          lastOrder: null,
        });
      }
      return { ...state, db, toast: 'Location added' };
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
    // "Show the app with no data": clear app-owned records (companies, pricing,
    // customers, tags, defaults, quotes) to reveal the fresh-install empty states;
    // toggling off restores the sample data (legacy setEmptyMode / demoBackup).
    case 'SET_EMPTY_MODE': {
      if (action.on && !state.emptyMode) {
        const emptyBackup = state.db;
        const db = clone(state.db);
        db.companies = [];
        db.policies = [];
        db.customers = [];
        db.tagPricing = [];
        db.quotes = [];
        db.defaults = { b2bPolicyId: null, wholesalePolicyId: null };
        return { ...state, db, emptyBackup, emptyMode: true, view: 'customers', selectedCompany: null, toast: 'Showing the app with no data' };
      }
      if (!action.on && state.emptyMode) {
        return { ...state, db: state.emptyBackup || state.db, emptyBackup: null, emptyMode: false, view: 'customers', toast: 'Sample data restored' };
      }
      return state;
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
