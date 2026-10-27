import React from 'react';
import { useStore } from '../store.jsx';
import { useCartCheckout, LineLimits, OrderLimits } from '../components/CartCheckout.jsx';
import { money } from '../utils.js';

// Cart page = the theme's main-cart-items + main-cart-footer: the lines as
// Product · Quantity · Total, then Subtotal and Check out. The order limits show as
// soon as the page opens — a product's under its line, the order's at the top;
// Check out works as in the cart drawer (useCartCheckout).
export function Cart() {
  const { dispatch } = useStore();
  const { lines, subtotal, blocking, orderProblems, lineProblems, review, checkoutHint, checkout, dialogs } = useCartCheckout();
  const shop = () => dispatch({ type: 'NAVIGATE', view: 'home' });

  if (!lines.length) {
    return (
      <section className="section page-width cart-page cart-page--empty">
        <h1>Your cart is empty</h1>
        <button className="button" onClick={shop}>Continue shopping</button>
      </section>
    );
  }

  return (
    <section className="section page-width cart-page">
      <div className="cart-page__head">
        <h1>Your cart</h1>
        <a className="link" onClick={shop}>Continue shopping</a>
      </div>

      <OrderLimits problems={orderProblems} review={!!review} />

      <div className="cart-items">
        <div className="cart-items__head">
          <span>Product</span>
          <span>Quantity</span>
          <span>Total</span>
        </div>
        {lines.map((l, i) => (
          <div className="cart-item" key={`${l.sku}-${l.variantId}`}>
            <div className="cart-item__media"><img src={l.product?.image} alt="" /></div>
            <div className="cart-item__info">
              <a className="cart-item__name" onClick={() => dispatch({ type: 'OPEN_PRODUCT', sku: l.sku })}>{l.product?.title}</a>
              <div>{money(l.price)}</div>
              <div className="cart-line__meta">{l.variant?.title}</div>
            </div>
            <div className="cart-item__qty">
              <div className="qty">
                <button onClick={() => dispatch({ type: 'SET_QTY', index: i, qty: l.qty - l.step })}>−</button>
                <input readOnly value={l.qty} />
                <button onClick={() => dispatch({ type: 'SET_QTY', index: i, qty: l.qty + l.step })}>+</button>
              </div>
              <button className="link cart-line__meta" onClick={() => dispatch({ type: 'REMOVE_LINE', index: i })}>Remove</button>
            </div>
            <div className="cart-item__total">{money(l.price * l.qty)}</div>
            <LineLimits problems={lineProblems(l, i)} />
          </div>
        ))}
      </div>

      <div className="cart-page__footer">
        <div className="cart-page__summary">
          <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <p className="muted" style={{ fontSize: '1.3rem', marginTop: 0 }}>Taxes and shipping calculated at checkout.</p>
          {checkoutHint && <p className="checkout-hint">{checkoutHint}</p>}
          <button className="button button--full" disabled={blocking.length > 0} onClick={checkout}>
            Check out
          </button>
        </div>
      </div>
      {dialogs}
    </section>
  );
}
