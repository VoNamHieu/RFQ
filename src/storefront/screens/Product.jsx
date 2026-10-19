import React, { useState, useEffect } from 'react';
import { useStore, unitPrice } from '../store.jsx';
import { productBySku, b2bPriceFor, productRuleForSession, cartProblemsForSession, orderValueLimitsForSession } from '../data/products.js';
import { Price } from '../components/Price.jsx';
import { quantityProblem } from '../quantityProblem.js';
import { money } from '../utils.js';
import { QuoteIcon, InfoIcon, WarningIcon, CheckIcon } from '../components/icons.jsx';

// An order maximum the cart would go over with this quantity added: a review one
// sends the order for the seller's review, the others stop checkout.
const OVER_MAXIMUM = ['maxValue', 'maxQty', 'review'];

// The order counted against the buyer's limits: `total` is the cart plus the
// quantity picked; `over` the first maximum it goes over (cartProblems), if any.
// { tone: 'warn' | 'ok', text }, or null when no order limit applies.
// Limits read as whole dollars ($500), amounts with cents ($171.70).
const whole = (n) => (n % 1 === 0 ? `$${n.toLocaleString('en-US')}` : money(n));
function limitCount(total, limits, over) {
  if (over) {
    const then = over.type === 'review' ? 'needs the seller’s review' : 'over the maximum, can’t check out';
    if (over.type === 'maxQty') return { tone: 'warn', text: over.message };
    if (over.period && over.period !== 'order') return { tone: 'warn', text: `Over your ${whole(over.value)} ${over.period}ly limit · ${then}` };
    const cap = over.type === 'review' ? limits?.review : limits?.block;
    return { tone: 'warn', text: cap ? `${money(total)} / ${whole(cap)} limit · ${then}` : over.message };
  }
  if (!limits) return null;
  if (limits.min != null && total < limits.min) {
    return { tone: 'warn', text: `${money(total)} / ${whole(limits.min)} minimum · add ${money(limits.min - total)} more` };
  }
  const max = [limits.review, limits.block].filter((v) => v != null).sort((a, b) => a - b)[0];
  const parts = [money(total), limits.min != null ? 'minimum met' : null, max != null ? `up to ${whole(max)}` : null];
  return { tone: 'ok', text: parts.filter(Boolean).join(' · ') };
}

// Product = the theme's main-product section: media gallery + info column
// (vendor, title, price, variant picker, quantity, buy buttons, description).
// The B2B×RFQ touchpoints layer on top: contract-price display and a
// "Request a quote" action for volume/bulk buyers.
export function Product() {
  const { state, dispatch } = useStore();
  const product = productBySku(state.currentSku);
  const [variantId, setVariantId] = useState(product?.variants[0]?.id);
  // The buyer's quantity rule (order limits, B2B or D2C): start at its minimum, step by its pack size.
  const rule = product ? productRuleForSession(product.sku, state.session) : null;
  const step = rule?.increment || 1;
  const startQty = Math.max(rule?.min || 1, step);
  const [qty, setQty] = useState(startQty);
  useEffect(() => { setQty(startQty); }, [startQty]);

  if (!product) {
    return (
      <div className="section page-width empty">
        Product not found. <a className="link" onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}>Back to shop</a>
      </div>
    );
  }

  const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
  const hasB2B = b2bPriceFor(product.sku, state.session) != null;
  const inStock = !!variant?.available;

  // The rule counts this variant in the cart too: what's there plus what's being added.
  const inCart = state.cart.filter((l) => l.sku === product.sku && l.variantId === variant?.id).reduce((n, l) => n + l.qty, 0);
  const qtyProblem = quantityProblem(rule, qty, inCart);
  // The order as it would be with this quantity in the cart, counted against the order limits.
  const withThis = [...state.cart.map((l) => ({ sku: l.sku, title: l.sku, qty: l.qty })), { sku: product.sku, title: product.title, qty }];
  const subtotal = withThis.reduce((s, l) => s + unitPrice(l.sku, state.session) * l.qty, 0);
  const overMax = cartProblemsForSession(withThis, subtotal, state.session).find((p) => OVER_MAXIMUM.includes(p.type));
  const count = limitCount(subtotal, orderValueLimitsForSession(state.session), overMax);

  const addToCart = () => {
    if (!inStock || qtyProblem) return;
    dispatch({ type: 'ADD_TO_CART', line: { sku: product.sku, variantId: variant.id, qty } });
  };

  return (
    <section className="section page-width">
      <a className="link muted" onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}>← Back to products</a>
      <div className="product" style={{ marginTop: '2rem' }}>
        {/* Gallery */}
        <div className="product__gallery">
          <div className="product__media"><img src={product.image} alt={product.title} /></div>
        </div>

        {/* Info */}
        <div className="product__info">
          <div className="product__vendor">{product.vendor}</div>
          <h1>{product.title}</h1>
          {product.tagline && <p className="muted" style={{ marginTop: 0 }}>{product.tagline}</p>}

          <div className="product__price">
            <Price sku={product.sku} list={product.list} size="lg" />
            {rule && <span className="badge badge--amber badge--warn"><WarningIcon /> Order limits apply</span>}
          </div>

          {/* B2B contract-price context or an invitation to log in / request pricing */}
          {hasB2B ? (
            <div className="b2b-callout">
              <InfoIcon />
              <div>
                <h4>Contract price applied</h4>
                <p>You’re seeing {state.session.companyName}’s {state.session.priceListName} price. It’s used at checkout and in your cart.</p>
              </div>
            </div>
          ) : (
            <div className="b2b-callout">
              <QuoteIcon />
              <div>
                <h4>Need volume pricing?</h4>
                <p>Buying in bulk? Request a quote and we’ll send tailored pricing for your quantity.</p>
              </div>
            </div>
          )}

          {/* Variant picker */}
          {product.variants.length > 1 && (
            <div>
              <span className="field-label">Variant: {variant.title}</span>
              <div className="variant-options">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    className={`variant-pill${v.id === variant.id ? ' is-active' : ''}`}
                    disabled={!v.available}
                    onClick={() => setVariantId(v.id)}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <span className="field-label">Quantity</span>
          <div className="qty">
            <button onClick={() => setQty((q) => Math.max(step, q - step))}>−</button>
            <input value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            <button onClick={() => setQty((q) => q + step)}>+</button>
          </div>
          {(rule || count) && (
            <div className="qty-feedback">
              {rule &&
                (qtyProblem ? (
                  <p className="qty-note qty-note--warn"><WarningIcon /> {qtyProblem}</p>
                ) : (
                  <p className="qty-note">
                    {[step > 1 ? `Sold in packs of ${step}` : null, rule.min ? `Minimum ${rule.min}` : null, rule.max ? `Maximum ${rule.max}` : null].filter(Boolean).join(' · ')}
                  </p>
                ))}
              {count && (
                <p className={`limit-count limit-count--${count.tone}`} aria-live="polite">
                  {count.tone === 'ok' ? <CheckIcon /> : <WarningIcon />} {count.text}
                </p>
              )}
            </div>
          )}

          {/* Buy buttons + RFQ touchpoint */}
          <div className="buy-stack">
            <button className="button button--full" disabled={!inStock || !!qtyProblem} onClick={addToCart}>
              {inStock ? 'Add to cart' : 'Out of stock'}
            </button>
            <button className="button button--b2b button--full" onClick={() => dispatch({ type: 'OPEN_QUOTE', sku: product.sku })}>
              <QuoteIcon style={{ width: '1.9rem', height: '1.9rem' }} /> Request a quote
            </button>
            <span className="muted" style={{ fontSize: '1.3rem' }}>
              {inStock ? 'In stock' : 'Backorder available on request'}
            </span>
          </div>

          {/* Merchant-authored description HTML from the store, as the theme renders it */}
          {product.descriptionHtml && <div className="product__desc" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />}
        </div>
      </div>
    </section>
  );
}
