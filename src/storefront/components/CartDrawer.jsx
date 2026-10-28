import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { CART_CASES, applyCartCase } from '../data/products.js';
import { versionFlags } from '../../shared/versions.js';
import { useCartCheckout, LineLimits, OrderLimits } from './CartCheckout.jsx';
import { money } from '../utils.js';
import { CloseIcon } from './icons.jsx';

// Dawn-style cart drawer. The lines, the order limits and Check out come from
// useCartCheckout (shared with the cart page). Prototype-only: for the B2B demo
// account, a Demo case picks a cart and the limits it needs (CART_CASES).
export function CartDrawer() {
  const { state, dispatch } = useStore();
  const { lines, subtotal, blocking, orderProblems, orderReviews, lineProblems, review, keepForReview, checkoutHint, checkout, dialogs } = useCartCheckout();
  const [cartCase, setCartCase] = useState('');
  if (!state.cartOpen) return null;
  const close = () => dispatch({ type: 'TOGGLE_CART', open: false });
  const pickCase = (id) => {
    setCartCase(id);
    dispatch({ type: 'SET_CART', cart: applyCartCase(CART_CASES.find((c) => c.id === id)) });
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
          {versionFlags().orderLimits && state.session?.id === 'b2b' && (
            <label className="demo-case">
              <span>Demo case</span>
              <select className="select" value={cartCase} onChange={(e) => pickCase(e.target.value)}>
                <option value="" disabled>Pick a case</option>
                {CART_CASES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          )}
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
              <LineLimits problems={lineProblems(l, i)} />
            </div>
          ))}
        </div>
        {lines.length > 0 && (
          <div className="drawer__foot">
            <OrderLimits problems={orderProblems} reviews={orderReviews} review={!!review} keepForReview={keepForReview} />
            <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <p className="muted" style={{ fontSize: '1.3rem', marginTop: 0 }}>Taxes and shipping calculated at checkout.</p>
            {checkoutHint && <p className="checkout-hint">{checkoutHint}</p>}
            <button className="button button--full" disabled={blocking.length > 0} onClick={checkout}>
              Check out
            </button>
          </div>
        )}
      </aside>
      {dialogs}
    </>
  );
}
