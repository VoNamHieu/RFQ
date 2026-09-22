import React, { createContext, useContext, useReducer } from 'react';
import { DEMO_ACCOUNT, productBySku, b2bPriceFor } from './data/products.js';

// Storefront state machine. Deliberately small — three pages (home / product /
// account) plus the cross-cutting bits a Dawn storefront needs: a cart, a
// customer session (guest vs. logged-in B2B buyer), and the RFQ "Request a quote"
// flow that is this project's storefront touchpoint.

const initialState = {
  view: 'home', // 'home' | 'product' | 'account' | 'register'
  currentSku: null,
  session: null, // null = guest (D2C); else DEMO_ACCOUNT (logged-in B2B buyer)
  cart: [], // [{ sku, variantId, qty }]
  cartOpen: false,
  quoteModal: null, // { sku } — the Request-a-quote modal
  quoteRequests: [], // quotes submitted from the storefront this session
  b2bApplications: [], // self-serve B2B account applications awaiting merchant approval
  toast: null,
};

function addToCart(cart, { sku, variantId, qty }) {
  const i = cart.findIndex((l) => l.sku === sku && l.variantId === variantId);
  if (i >= 0) {
    const next = cart.slice();
    next[i] = { ...next[i], qty: next[i].qty + qty };
    return next;
  }
  return [...cart, { sku, variantId, qty }];
}

function reducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, view: action.view, currentSku: action.sku ?? state.currentSku, cartOpen: false };
    case 'OPEN_PRODUCT':
      return { ...state, view: 'product', currentSku: action.sku, cartOpen: false };
    case 'LOGIN':
      return { ...state, session: DEMO_ACCOUNT, toast: 'Signed in' };
    case 'LOGOUT':
      return { ...state, session: null, view: state.view === 'account' ? 'home' : state.view, toast: 'Signed out' };
    case 'ADD_TO_CART':
      return {
        ...state,
        cart: addToCart(state.cart, action.line),
        cartOpen: true,
        toast: `Added to cart`,
      };
    case 'SET_QTY': {
      const cart = state.cart
        .map((l, i) => (i === action.index ? { ...l, qty: Math.max(0, action.qty) } : l))
        .filter((l) => l.qty > 0);
      return { ...state, cart };
    }
    case 'REMOVE_LINE':
      return { ...state, cart: state.cart.filter((_, i) => i !== action.index) };
    case 'TOGGLE_CART':
      return { ...state, cartOpen: action.open ?? !state.cartOpen };
    case 'OPEN_QUOTE':
      return { ...state, quoteModal: { sku: action.sku } };
    case 'CLOSE_QUOTE':
      return { ...state, quoteModal: null };
    case 'SUBMIT_QUOTE':
      return {
        ...state,
        quoteModal: null,
        quoteRequests: [action.request, ...state.quoteRequests],
        toast: 'Quote request sent',
      };
    case 'SUBMIT_B2B_APPLICATION':
      // Self-serve registration → lands in the merchant's approval queue. Here we
      // just record it and confirm; approval/tagging happens on the admin side.
      return {
        ...state,
        b2bApplications: [action.application, ...state.b2bApplications],
        toast: 'Application submitted',
      };
    case 'TOAST':
      return { ...state, toast: action.message };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

// Effective unit price for a SKU given the session: contract price if the buyer's
// B2B price list covers it, otherwise the D2C list price.
export function unitPrice(sku, session) {
  const p = productBySku(sku);
  if (!p) return 0;
  const b2b = b2bPriceFor(sku, session);
  return b2b != null ? b2b : p.list;
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
