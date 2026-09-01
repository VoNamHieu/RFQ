import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { quoteRecords, DEFAULT_QUOTE_ID } from './data/quotes.js';
import { submissionMeta, SUBMISSION_ORDER, DEFAULT_SUBMISSION_TAB } from './data/submissions.js';
import { shopifyCompanyDirectory } from './data/companies.js';
import { activeVersion } from '../shared/versions.js';
import { DEMO_STATE_KEY, HANDOFF_KEY, readJSON, writeJSON } from '../shared/persistence.js';

// The RFQ app was one page toggling `.hidden` on `.app-shell` divs (spec §1/§4).
// Here that becomes a single view-state machine plus the mutable quote data
// (so "Create a quote" can prepend a real record to the submission list).

export const emptyCreateQuote = () => ({
  customerKey: null,
  lines: [],
  dueDate: '',
  message: '',
});

const clone = (obj) =>
  typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

const initialState = {
  view: 'submissionList', // 'submissionList' | 'quoteDetail' | 'createQuote' | 'b2bCreateCompany' | 'createLocation' | 'b2bCompany'
  currentQuoteId: DEFAULT_QUOTE_ID,
  submissionTab: DEFAULT_SUBMISSION_TAB,
  quotes: clone(quoteRecords),
  meta: clone(submissionMeta),
  order: [...SUBMISSION_ORDER],
  createQuote: emptyCreateQuote(),
  cqSeq: 0,
  syncFlow: null, // { step:'sync'|'review'|'success', quoteId, companyKey, autoSync, location, role }
  createCompany: null, // { quoteId, name, externalId, shipCity, shipAddress, autoSync, contactName, contactEmail }
  createdCompanies: {}, // created_<quoteId> → snapshot of the company created from a quote (mirrors legacy shopifyCompanyDirectory[created_*])
  toast: null,
};

// ── Demo-state persistence (shared with the B2B app) ─────────────────────────
// Mirror of the god file's saveDemoState/loadDemoState (index.html §4124-4174):
// persist the mutated quote states + companies created from a quote, plus a
// B2B-app-ready payload per synced/linked/created company so the B2B app can
// rebuild them after a reload/tab-switch.

// The company key a quote resolves to (synced > fixed > linked > recommended > preview).
function quoteCompanyKey(quote) {
  return (
    quote.syncedCompanyKey ||
    quote.fixedCompanyKey ||
    quote.linkedCompanyKey ||
    quote.recommendedKey ||
    quote.previewCompanyKey ||
    null
  );
}

// Build the B2B-app-ready payload for a quote's company (legacy b2bPayloadFor).
export function b2bPayloadForQuote(state, quoteId) {
  const quote = state.quotes[quoteId];
  if (!quote) return null;
  const key = quoteCompanyKey(quote);
  if (!key) return null;
  const created = state.createdCompanies[key] || null;
  const dir = shopifyCompanyDirectory[key] || {};
  const company = created || dir;
  const locSummary = company.locationSummary && company.locationSummary !== 'Company location' ? company.locationSummary : '';
  return {
    id: key,
    name: company.name || quote.customer?.name || '',
    mainContact: company.mainContact || created?.contactName || quote.customer?.name || '',
    contactEmail: company.contactEmail || created?.contactEmail || quote.customer?.email || '',
    externalId: company.externalId || '',
    locationName: locSummary || created?.locationName || '',
    terms: created?.terms || 'Not set',
    assignedLocation: quote.assignedLocation || '',
    locationList: company.locationList || null,
    buyerList: company.buyerList || null,
    quote: {
      id: quote.number,
      buyer: quote.customer?.name || '',
      email: quote.customer?.email || '',
      created: (quote.received || '').replace(/^Received by /, '') || 'Today',
    },
  };
}

function serializeDemoState(state) {
  const quotes = {};
  const b2bCompanies = {};
  Object.keys(state.quotes).forEach((id) => {
    const q = state.quotes[id];
    quotes[id] = {
      state: q.state,
      syncedCompanyKey: q.syncedCompanyKey || null,
      assignedLocation: q.assignedLocation || null,
      assignedRole: q.assignedRole || null,
      createdCompanyName: q.createdCompanyName || null,
      quoteAutoSyncEnabled: !!q.quoteAutoSyncEnabled,
    };
    if (q.syncedCompanyKey) {
      const payload = b2bPayloadForQuote(state, id);
      if (payload) b2bCompanies[q.syncedCompanyKey] = payload;
    }
  });
  return { currentQuoteId: state.currentQuoteId, quotes, createdCompanies: state.createdCompanies, b2bCompanies };
}

function hydrate(base) {
  const s = readJSON(DEMO_STATE_KEY);
  if (!s) return base;
  const quotes = { ...base.quotes };
  if (s.quotes) {
    Object.keys(s.quotes).forEach((id) => {
      if (quotes[id]) quotes[id] = { ...quotes[id], ...s.quotes[id] };
    });
  }
  return {
    ...base,
    quotes,
    createdCompanies: s.createdCompanies || {},
    currentQuoteId: s.currentQuoteId && quotes[s.currentQuoteId] ? s.currentQuoteId : base.currentQuoteId,
  };
}

// Hand the quote's company off to the B2B app and navigate there (legacy
// showB2BCompany / saveQuotePricesToB2B). `pricingTransfer` + `lines` carry a
// "save quoted prices" instruction the B2B app applies on arrival.
export function handoffToB2B(state, quoteId, { pricingTransfer = null, lines = null } = {}) {
  const payload = b2bPayloadForQuote(state, quoteId);
  if (!payload) return;
  if (lines) payload.quote.lines = lines;
  if (pricingTransfer) payload.pricingTransfer = pricingTransfer;
  writeJSON(HANDOFF_KEY, payload);
  // Keep the shared demo state fresh so B2B can also rebuild the company on load.
  writeJSON(DEMO_STATE_KEY, serializeDemoState(state));
  const v = activeVersion();
  const target = v === 'latest' ? '/b2b' : `/b2b?v=${v}`;
  try {
    window.location.href = target;
  } catch {
    /* ignore */
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, view: action.view };
    case 'OPEN_QUOTE':
      return { ...state, view: 'quoteDetail', currentQuoteId: action.id };
    case 'SET_TAB':
      return { ...state, submissionTab: action.tab };
    case 'START_CREATE_QUOTE':
      return { ...state, view: 'createQuote', createQuote: emptyCreateQuote() };
    case 'CQ_PATCH':
      return { ...state, createQuote: { ...state.createQuote, ...action.patch } };
    case 'CREATE_QUOTE':
      return {
        ...state,
        quotes: { ...state.quotes, [action.id]: action.quote },
        meta: { ...state.meta, [action.id]: action.meta },
        order: [action.id, ...state.order],
        cqSeq: state.cqSeq + 1,
        view: 'submissionList',
      };
    // ----- B2B relationship / sync flow -----
    case 'INSTALL_B2B': {
      const q = { ...state.quotes[action.id], state: 'new', syncMode: 'selector' };
      return { ...state, quotes: { ...state.quotes, [action.id]: q } };
    }
    case 'SYNC_OPEN': {
      const q = state.quotes[action.id];
      const companyKey = q.recommendedKey || q.fixedCompanyKey || q.previewCompanyKey || 'abc';
      return {
        ...state,
        syncFlow: { step: 'sync', quoteId: action.id, companyKey, autoSync: false, location: '', role: 'Ordering only' },
      };
    }
    case 'SYNC_PATCH':
      return { ...state, syncFlow: { ...state.syncFlow, ...action.patch } };
    case 'SYNC_GOTO':
      return { ...state, syncFlow: { ...state.syncFlow, step: action.step } };
    case 'SYNC_CLOSE':
      return { ...state, syncFlow: null };
    case 'OPEN_CREATE_COMPANY': {
      const q = state.quotes[action.quoteId];
      const email = q?.customer?.email || '';
      const domain = (email.split('@')[1] || '').split('.')[0];
      const derived = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : '';
      return {
        ...state,
        syncFlow: null,
        createCompany: {
          quoteId: action.quoteId,
          name: q?.customer?.company || derived,
          externalId: '',
          shipCity: '',
          shipAddress: '',
          autoSync: false,
          contactName: q?.customer?.name || '',
          contactEmail: q?.customer?.email || '',
        },
      };
    }
    case 'CREATE_COMPANY_PATCH':
      return { ...state, createCompany: { ...state.createCompany, ...action.patch } };
    case 'CLOSE_CREATE_COMPANY':
      return { ...state, createCompany: null };
    case 'CREATE_COMPANY_CONFIRM': {
      const cc = state.createCompany;
      const key = `created_${cc.quoteId}`;
      const q = {
        ...state.quotes[cc.quoteId],
        state: 'shopifySynced',
        syncedCompanyKey: key,
        createdCompanyName: cc.name,
        quoteAutoSyncEnabled: cc.autoSync,
      };
      // Snapshot the created company (mirrors legacy shopifyCompanyDirectory[created_*])
      // so it survives reloads and can be handed to / rebuilt by the B2B app.
      const locationName = [cc.shipAddress, cc.shipCity].filter(Boolean).join(', ');
      const snapshot = {
        name: cc.name,
        externalId: cc.externalId || '',
        mainContact: cc.contactName || '',
        contactName: cc.contactName || '',
        contactEmail: cc.contactEmail || '',
        locationName: cc.shipCity || locationName || '',
        locationSummary: cc.shipCity || locationName || '',
        terms: cc.terms || 'Not set',
        createdInB2B: true,
        autoSyncEnabled: !!cc.autoSync,
      };
      return {
        ...state,
        quotes: { ...state.quotes, [cc.quoteId]: q },
        createdCompanies: { ...state.createdCompanies, [key]: snapshot },
        createCompany: null,
        toast: `${cc.name || 'Company'} created in the B2B app`,
      };
    }
    case 'SYNC_CONFIRM': {
      const sf = state.syncFlow;
      const q = {
        ...state.quotes[sf.quoteId],
        state: 'shopifySynced',
        syncedCompanyKey: sf.companyKey,
        assignedLocation: sf.location,
        assignedRole: sf.role,
        quoteAutoSyncEnabled: sf.autoSync,
      };
      return { ...state, quotes: { ...state.quotes, [sf.quoteId]: q }, syncFlow: { ...sf, step: 'success' } };
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
  const [state, dispatch] = useReducer(reducer, initialState, hydrate);
  // Persist the mutated demo state on every change so it survives a reload / the
  // switch to the B2B app (legacy saveDemoState, called after every action).
  useEffect(() => {
    writeJSON(DEMO_STATE_KEY, serializeDemoState(state));
  }, [state]);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
