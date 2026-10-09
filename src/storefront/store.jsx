import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { accountForEmail, productBySku, b2bPriceFor } from './data/products.js';
import { ORDER_LIMITS_KEY } from '../shared/persistence.js';

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
  orderQuote: null, // { orderId } — "Request a quote" from a past order
  quotes: [], // the signed-in account's quote requests + the seller's offers
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
    // Demo sign-in: the email picks which of the two demo accounts you get
    // (not applied vs. approved B2B buyer) — see DEMO_ACCOUNTS.
    case 'LOGIN': {
      const account = accountForEmail(action.email);
      return { ...state, session: account, quotes: account.quotes || [], toast: 'Signed in' };
    }
    case 'LOGOUT':
      return { ...state, session: null, quotes: [], view: state.view === 'account' ? 'home' : state.view, toast: 'Signed out' };
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
    // Over the review threshold: the cart goes to the merchant as an order request
    // (a draft order) instead of checking out (see Order limits in the B2B app).
    case 'SUBMIT_FOR_REVIEW':
      return { ...state, cart: [], cartOpen: false, toast: 'Order request sent' };
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
        orderQuote: null,
        quotes: [action.request, ...state.quotes],
        toast: 'Quote request sent',
      };
    // Seller's offer accepted: the agreed price is saved back as company pricing,
    // so the buyer can reorder at it without asking for another quote.
    case 'ACCEPT_QUOTE':
      return {
        ...state,
        quotes: state.quotes.map((q) => (q.id === action.id ? { ...q, status: 'Accepted', savedToPricing: true } : q)),
        toast: 'Offer accepted',
      };
    case 'COUNTER_QUOTE':
      return {
        ...state,
        quotes: state.quotes.map((q) => (q.id === action.id
          ? { ...q, status: 'Counter sent', counterUnitPrice: Number(action.unitPrice), message: 'Your counter offer is with the seller.' }
          : q)),
        toast: 'Counter sent',
      };
    // "Request a quote" from a past order — reuses that order's products.
    case 'OPEN_ORDER_QUOTE':
      return { ...state, orderQuote: { orderId: action.orderId } };
    case 'CLOSE_ORDER_QUOTE':
      return { ...state, orderQuote: null };
    case 'SUBMIT_B2B_APPLICATION':
      // Self-serve registration → lands in the merchant's approval queue. Here we
      // just record it and confirm; approval/tagging happens on the admin side.
      return {
        ...state,
        b2bApplications: [action.application, ...state.b2bApplications],
        toast: 'Application submitted',
      };
    // The B2B app saved its order limits (e.g. from the docked Order limits screen):
    // re-render so the cart and product page check against them.
    case 'LIMITS_CHANGED':
      return { ...state, limitsVersion: (state.limitsVersion || 0) + 1 };
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
  useEffect(() => {
    const onStorage = (e) => e.key === ORDER_LIMITS_KEY && dispatch({ type: 'LIMITS_CHANGED' });
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
