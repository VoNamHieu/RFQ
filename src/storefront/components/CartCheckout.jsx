import React, { useState } from 'react';
import { useStore, unitPrice } from '../store.jsx';
import { productBySku, productRuleForSession, cartProblemsForSession } from '../data/products.js';
import { addOrderRequest } from '../../shared/persistence.js';
import { CloseIcon, InfoIcon, WarningIcon } from './icons.jsx';

// A product's order limits under its cart line (lineProblems): red when it blocks
// checkout, blue when the order can go as an order request.
export function LineLimits({ problems }) {
  if (!problems.length) return null;
  return (
    <div className="line-limit" role="alert">
      {problems.map((p, i) => <p key={i} className={p.review ? 'line-limit--review' : undefined}>{p.message}</p>)}
    </div>
  );
}

// The order's own limits above the lines: in red the ones that block (orderProblems)
// — when the cart could go as an order request (`review`), they say to fix them
// first, over a maximum the products for review fit under (`keepForReview`) by
// lowering the others — then in blue its maximums sent for review (orderReviews).
export function OrderLimits({ problems, reviews = [], review, keepForReview = false }) {
  if (!problems.length && !reviews.length) return null;
  return (
    <div className="order-limits">
      {problems.length > 0 && (
        <div className="limit-notice" role="alert">
          <WarningIcon />
          <div>
            <ul>{problems.map((p, i) => <li key={i}>{p.message}</li>)}</ul>
            {keepForReview ? (
              <p>Consider removing products that can’t go for review, then send an order request.</p>
            ) : review ? (
              <p>{`Fix ${problems.length > 1 ? 'these' : 'this'} first to send an order request.`}</p>
            ) : null}
          </div>
        </div>
      )}
      {reviews.length > 0 && (
        <div className="limit-notice limit-notice--review" role="status">
          <InfoIcon />
          <ul>{reviews.map((p, i) => <li key={i}>{p.message}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// Today as YYYY-MM-DD in local time.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// The cart and its Check out, shared by the cart drawer and the cart page. Prices
// reflect the session (contract price for a B2B buyer, list price for a guest).
// Order limits, as the validation function would report them: anything but a
// review problem blocks checkout — the cart says why as soon as it opens (a
// product's under its line, the order's above) and Check out is off. Over a maximum
// sent for review, Check out asks the buyer to reduce the order or send it as an
// order request — a draft order the merchant reviews in the B2B app. One line per
// variant, named by the product: a product limit counts all its variants together
// (its pack holds for each variant). `dialogs`: render it once, next to the cart.
export function useCartCheckout() {
  const { state, dispatch } = useStore();
  // Check out on a cart over a maximum sent for review: it doesn't go to checkout.
  const [overLimit, setOverLimit] = useState(false);
  // A D2C customer (no company) leaves an email with the order request; any buyer
  // can add a message.
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const isD2C = !state.session?.companyKey;

  const lines = state.cart.map((l) => {
    const p = productBySku(l.sku);
    const variant = p?.variants.find((v) => v.id === l.variantId) || p?.variants[0];
    const price = unitPrice(l.sku, state.session);
    // Quantity buttons step by the product's pack size (order limits).
    const step = productRuleForSession(l.sku, state.session)?.increment || 1;
    return { ...l, product: p, variant, price, step };
  });
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const lineTitle = (l) => (l.product?.variants?.length > 1 && l.variant ? `${l.product.title} (${l.variant.title})` : l.product?.title || l.sku);
  const problems = cartProblemsForSession(lines.map((l) => ({ sku: l.sku, title: l.product?.title || l.sku, qty: l.qty })), subtotal, state.session);
  const blocking = problems.filter((p) => p.type !== 'review');
  // The order's own problems (no `sku`), shown above the lines.
  const orderProblems = blocking.filter((p) => !p.sku);
  // Every maximum sent for review the order is over; the request records one — the
  // order value's, else the first product's (`sku`).
  const reviews = problems.filter((p) => p.type === 'review');
  const review = reviews.find((p) => !p.sku) || reviews[0];
  // The order's own maximums sent for review (no `sku`), shown above the lines in blue.
  const orderReviews = reviews.filter((p) => !p.sku);
  // A product's problems, blocking or sent for review, under its line: a minimum or
  // maximum under its first line (they count all its variants), a pack under each
  // variant not in packs. Without the product's name, which the line shows. When the
  // cart could go as an order request, a blocking one says to fix it first.
  const lineProblems = (l, i) => {
    const title = l.product?.title || l.sku;
    return problems
      .filter((p) => p.sku === l.sku && (p.field === 'pack' ? l.qty % l.step !== 0 : lines.findIndex((x) => x.sku === l.sku) === i))
      .map((p) => {
        const own = p.message.startsWith(`${title}: `) ? p.message.slice(title.length + 2) : p.message;
        const first = p.type !== 'review' && reviews.length ? ` ${p.field === 'max' ? 'Reduce' : 'Fix'} it first to send an order request.` : '';
        return { review: p.type === 'review', message: own.charAt(0).toUpperCase() + own.slice(1) + first };
      });
  };
  // Over an order maximum that blocks, with products that can go for review and
  // others that can't: lowering the others keeps the ones for review (OrderLimits)
  // — when those alone fit under every maximum the order is over.
  const reviewSkus = new Set(reviews.filter((p) => p.sku).map((p) => p.sku));
  const forReview = lines.filter((l) => reviewSkus.has(l.sku));
  const overMax = orderProblems.filter((p) => p.type === 'maxValue' || p.type === 'maxQty');
  const fits = (p) => p.period === 'order' && (p.type === 'maxValue' ? forReview.reduce((s, l) => s + l.price * l.qty, 0) : forReview.reduce((n, l) => n + l.qty, 0)) <= p.value;
  const keepForReview = forReview.length > 0 && forReview.length < lines.length && overMax.length > 0 && overMax.every(fits);
  // Check out is off while a limit blocks; when the cart could then go as an order
  // request, the footer says what to do first — unless the order's own limits show,
  // which say it themselves (OrderLimits).
  const checkoutHint = blocking.length && review && !orderProblems.length
    ? `${blocking.every((p) => p.field === 'max') ? 'Reduce' : 'Fix'} what’s marked in red first. Then Check out lets you send an order request.`
    : null;
  const checkout = () => {
    if (blocking.length) return;
    if (review) {
      setEmail(state.session?.email || '');
      setNote('');
      setOverLimit(true);
    } else dispatch({ type: 'TOAST', message: 'Demo only' });
  };
  const sendRequest = () => {
    const s = state.session || {};
    addOrderRequest({
      id: `req-${Date.now()}`, companyId: s.companyKey, locationId: s.locationId, buyer: s.contact, date: today(),
      ...(isD2C ? { email: email.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      amount: subtotal, threshold: review.value, period: review.period, limitId: review.limit.id, limitName: review.limit.name, priceList: s.priceListName,
      ...(review.sku ? { sku: review.sku, item: review.item } : {}),
      ...(review.basis ? { basis: review.basis } : {}),
      lines: lines.map((l) => ({ sku: l.sku, title: lineTitle(l), qty: l.qty, price: l.price })),
    });
    setOverLimit(false);
    dispatch({ type: 'SUBMIT_FOR_REVIEW' });
  };

  const dialogs = (
    <>
      {overLimit && review && (
        <div className="overlay" onClick={() => setOverLimit(false)}>
          <div className="modal" role="dialog" aria-label="Your order is over the limit" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Your order is over the limit</h3>
              <button className="icon-btn" aria-label="Close" onClick={() => setOverLimit(false)}><CloseIcon /></button>
            </div>
            <div className="modal__body">
              {reviews.map((p, i) => <p key={i} style={{ margin: i ? '0.8rem 0 0' : 0 }}>{p.message}</p>)}
              <div style={{ marginTop: '1.6rem' }}>
                {isD2C && (
                  <div className="form-row">
                    <label className="field-label">Email</label>
                    <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                )}
                <div className="form-row">
                  <label className="field-label">Note for the seller (optional)</label>
                  <textarea className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="muted" style={{ fontSize: '1.3rem', display: 'flex', justifyContent: 'space-between', gap: '1.2rem' }}>
                    <span>Add a note for the seller about this order, like a delivery date or why you need this quantity.</span>
                    <span>{`${note.length}/500`}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal__foot">
              <button className="button button--secondary" onClick={() => setOverLimit(false)}>Reduce order</button>
              <button className="button button--b2b" disabled={isD2C && !email.trim()} onClick={sendRequest}>Send order request</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return { lines, subtotal, blocking, orderProblems, orderReviews, lineProblems, review, keepForReview, checkoutHint, checkout, dialogs };
}
