import React, { useState } from 'react';
import { useStore, unitPrice } from '../store.jsx';
import { productBySku, productRuleForSession, cartProblemsForSession } from '../data/products.js';
import { addOrderRequest } from '../../shared/persistence.js';
import { money } from '../utils.js';
import { CloseIcon } from './icons.jsx';

// Today as YYYY-MM-DD in local time.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Dawn-style cart drawer. Prices reflect the session (contract price for a B2B
// buyer, list price for a guest).
export function CartDrawer() {
  const { state, dispatch } = useStore();
  // Check out on a cart over the review threshold: it doesn't go to checkout.
  const [overLimit, setOverLimit] = useState(false);
  if (!state.cartOpen) return null;

  const lines = state.cart.map((l) => {
    const p = productBySku(l.sku);
    const variant = p?.variants.find((v) => v.id === l.variantId) || p?.variants[0];
    const price = unitPrice(l.sku, state.session);
    // Quantity buttons step by the product's pack size (order limits).
    const step = productRuleForSession(l.sku, state.session)?.increment || 1;
    return { ...l, product: p, variant, price, step };
  });
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  // Order limits, as the validation function would report them: anything but a
  // review problem blocks checkout. Over the review threshold, Check out asks the
  // buyer to reduce the order or send it as an order request — a draft order the
  // merchant reviews in the B2B app.
  // One line per variant (product limits count each variant on its own), named
  // with the variant when the product has several.
  const lineTitle = (l) => (l.product?.variants?.length > 1 && l.variant ? `${l.product.title} (${l.variant.title})` : l.product?.title || l.sku);
  const problems = cartProblemsForSession(lines.map((l) => ({ sku: l.sku, title: lineTitle(l), qty: l.qty })), subtotal, state.session);
  const blocking = problems.filter((p) => p.type !== 'review');
  const review = problems.find((p) => p.type === 'review');
  const close = () => dispatch({ type: 'TOGGLE_CART', open: false });
  const checkout = () => (review ? setOverLimit(true) : dispatch({ type: 'TOAST', message: 'Demo only' }));
  const sendRequest = () => {
    const s = state.session;
    addOrderRequest({
      id: `req-${Date.now()}`, companyId: s.companyKey, locationId: s.locationId, buyer: s.contact, date: today(),
      amount: subtotal, threshold: review.limit.threshold, limitId: review.limit.id, priceList: s.priceListName,
      lines: lines.map((l) => ({ sku: l.sku, title: lineTitle(l), qty: l.qty, price: l.price })),
    });
    setOverLimit(false);
    dispatch({ type: 'SUBMIT_FOR_REVIEW' });
  };

  return (
    <>
      <div className="drawer-scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Cart">
        <div className="drawer__head">
          <h3>Your cart</h3>
          <button className="icon-btn" aria-label="Close" onClick={close}><CloseIcon /></button>
        </div>
        <div className="drawer__body">
          {lines.length === 0 && <div className="empty">Your cart is empty.</div>}
          {lines.map((l, i) => (
            <div className="cart-line" key={`${l.sku}-${l.variantId}`}>
              <div className="cart-line__media"><img src={l.product?.image} alt="" /></div>
              <div>
                <div className="cart-line__title">{l.product?.title}</div>
                <div className="cart-line__meta">{l.variant?.title}</div>
                <div className="qty" style={{ marginTop: '0.8rem' }}>
                  <button onClick={() => dispatch({ type: 'SET_QTY', index: i, qty: l.qty - l.step })}>−</button>
                  <input readOnly value={l.qty} />
                  <button onClick={() => dispatch({ type: 'SET_QTY', index: i, qty: l.qty + l.step })}>+</button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>{money(l.price * l.qty)}</div>
                <button className="link cart-line__meta" onClick={() => dispatch({ type: 'REMOVE_LINE', index: i })}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        {lines.length > 0 && (
          <div className="drawer__foot">
            {blocking.length > 0 && (
              <div className="limit-notice" role="alert">
                <ul>{blocking.map((p, i) => <li key={i}>{p.message}</li>)}</ul>
              </div>
            )}
            <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <p className="muted" style={{ fontSize: '1.3rem', marginTop: 0 }}>Taxes and shipping calculated at checkout.</p>
            <button className="button button--full" disabled={blocking.length > 0} onClick={checkout}>
              Check out
            </button>
          </div>
        )}
      </aside>
      {overLimit && review && (
        <div className="overlay" onClick={() => setOverLimit(false)}>
          <div className="modal" role="dialog" aria-label="Your order is over the limit" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Your order is over the limit</h3>
              <button className="icon-btn" aria-label="Close" onClick={() => setOverLimit(false)}><CloseIcon /></button>
            </div>
            <div className="modal__body">
              <p style={{ margin: 0 }}>{review.message}</p>
            </div>
            <div className="modal__foot">
              <button className="button button--secondary" onClick={() => setOverLimit(false)}>Reduce order</button>
              <button className="button button--b2b" onClick={sendRequest}>Send order request</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
