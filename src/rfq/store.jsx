import React, { createContext, useContext, useReducer } from 'react';
import { quoteRecords, DEFAULT_QUOTE_ID } from './data/quotes.js';
import { submissionMeta, SUBMISSION_ORDER, DEFAULT_SUBMISSION_TAB } from './data/submissions.js';

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
  toast: null,
};

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
