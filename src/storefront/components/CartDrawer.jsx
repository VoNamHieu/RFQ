import React from 'react';
import { useStore, unitPrice } from '../store.jsx';
import { productBySku, productRuleForSession, cartProblemsForSession } from '../data/products.js';
import { money } from '../utils.js';
import { CloseIcon } from './icons.jsx';

// Dawn-style cart drawer. Prices reflect the session (contract price for a B2B
// buyer, list price for a guest).
export function CartDrawer() {
  const { state, dispatch } = useStore();
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
  // review problem blocks checkout; over the review threshold, the buyer sends
  // the order for review instead.
  const problems = cartProblemsForSession(lines.map((l) => ({ sku: l.sku, title: l.product?.title || l.sku, qty: l.qty })), subtotal, state.session);
  const blocking = problems.filter((p) => p.type !== 'review');
  const review = problems.find((p) => p.type === 'review');
  const close = () => dispatch({ type: 'TOGGLE_CART', open: false });

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
            {!blocking.length && review && <div className="limit-notice limit-notice--review">{review.message}</div>}
            <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <p className="muted" style={{ fontSize: '1.3rem', marginTop: 0 }}>Taxes and shipping calculated at checkout.</p>
            {!blocking.length && review ? (
              <button className="button button--b2b button--full" onClick={() => dispatch({ type: 'SUBMIT_FOR_REVIEW' })}>
                Submit order for review
              </button>
            ) : (
              <button className="button button--full" disabled={blocking.length > 0} onClick={() => dispatch({ type: 'TOAST', message: 'Demo only' })}>
                Check out
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
