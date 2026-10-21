import React, { useState, useEffect } from 'react';
import { useStore, unitPrice } from '../store.jsx';
import { productBySku, b2bPriceFor, productRuleForSession, orderLimitsForSession } from '../data/products.js';
import { Price } from '../components/Price.jsx';
import { money } from '../utils.js';
import { QuoteIcon, InfoIcon, WarningIcon } from '../components/icons.jsx';

// Order limits on the product page: one block, a row for this product's quantity
// rule and one for the order (the cart plus the quantity picked). Each row is
// { rule, tone, status, detail }: what applies, and live where the quantity or the
// order stands. `tone`: 'info' (grey), 'warn' (amber: it can't check out like
// this) or 'review' (blue: the seller will review the order). `detail`: how a
// count that takes in the cart, or the orders so far, adds up.
// Limits read as whole dollars ($500), amounts with cents ($171.70).
const whole = (n) => (n % 1 === 0 ? `$${n.toLocaleString('en-US')}` : money(n));
const PERIODS = ['order', 'week', 'month'];
const keyFor = (base, p) => (p === 'order' ? base : `${base}@${p}`);

// This product, under its quantity rule (productRuleForSession), with `inCart`
// units of the variant already in the cart.
function productRow(rule, qty, inCart) {
  const step = rule.increment || 1;
  const total = qty + inCart;
  const parts = [step > 1 && `Sold in packs of ${step}`, rule.min && `Min ${rule.min}`, rule.max && `Max ${rule.max}${rule.review ? ' without review' : ''}`];
  const row = { rule: parts.filter(Boolean).join(' · '), tone: 'info', status: null, detail: null };
  const at = (tone, status) => ({ ...row, tone, status, detail: inCart ? `${total} = ${inCart} already in your cart + ${qty} selected` : null });
  if (rule.min != null && total < rule.min) return at('warn', `${total} of ${rule.min} minimum · add ${rule.min - total} more`);
  if (rule.max != null && !rule.review && total > rule.max) return at('warn', `${total} of ${rule.max} maximum · remove ${total - rule.max}`);
  if (total % step) {
    // The quantities to pick instead: the pack multiples either side, less what's in the cart.
    const choices = [Math.floor(total / step) * step - inCart, Math.ceil(total / step) * step - inCart].filter((n) => n > 0);
    return at('warn', `${total} isn’t a multiple of ${step} · choose ${choices.join(' or ')}`);
  }
  if (rule.review && total > rule.max) return at('review', `${total} of ${rule.max} maximum · the seller will review this order`);
  return row;
}

// Your order, under the order limits (orderLimitsForSession): `subtotal` and
// `units` with the quantity picked. A weekly or monthly maximum counts the orders
// so far in the period too. One status: a maximum, then a minimum, then review.
function orderRow(limits, subtotal, units) {
  const per = (p) => (p === 'order' ? '' : ` per ${p}`);
  const parts = [
    limits.minValue && `Min ${whole(limits.minValue)}`,
    ...PERIODS.map((p) => limits[keyFor('maxValue', p)] && `Max ${whole(limits[keyFor('maxValue', p)])}${per(p)}`),
    ...PERIODS.map((p) => limits[keyFor('threshold', p)] && `Review above ${whole(limits[keyFor('threshold', p)])}${per(p)}`),
    limits.minQty && `Min ${limits.minQty} items`,
    limits.maxQty && `Max ${limits.maxQty} items`,
  ];
  const row = { rule: parts.filter(Boolean).join(' · '), tone: 'info', status: `${money(subtotal)} · within your order limits`, detail: null };
  const at = (tone, status, detail = null) => ({ ...row, tone, status, detail });
  const sofar = (p) => (p === 'order' ? 0 : Number(limits.spent?.[p]) || 0);
  const sofarDetail = (p, total) => (sofar(p) ? `${money(total)} = ${money(sofar(p))} ordered this ${p} + ${money(subtotal)} this order` : null);
  for (const p of PERIODS) {
    const cap = limits[keyFor('maxValue', p)];
    const total = sofar(p) + subtotal;
    if (cap && total > cap) return at('warn', `${money(total)} of ${whole(cap)} ${p === 'order' ? '' : `${p}ly `}maximum · remove ${money(total - cap)} to check out`, sofarDetail(p, total));
  }
  if (limits.maxQty && units > limits.maxQty) return at('warn', `${units} of ${limits.maxQty} items maximum · remove ${units - limits.maxQty} to check out`);
  if (limits.minValue && subtotal < limits.minValue) return at('warn', `${money(subtotal)} of ${whole(limits.minValue)} minimum · add ${money(limits.minValue - subtotal)} more`);
  if (limits.minQty && units < limits.minQty) return at('warn', `${units} of ${limits.minQty} items minimum · add ${limits.minQty - units} more`);
  for (const p of PERIODS) {
    const t = limits[keyFor('threshold', p)];
    const total = sofar(p) + subtotal;
    if (t && total > t) return at('review', `${money(total)} of ${whole(t)}${p === 'order' ? '' : ` this ${p}`} · the seller will review this order`, sofarDetail(p, total));
  }
  return row;
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
  // Only a quantity under the minimum stops Add to cart; the cart checks the rest.
  const belowMin = rule?.min != null && qty + inCart < rule.min;
  // The order as it would be with this quantity in the cart, counted against the order limits.
  const withThis = [...state.cart.map((l) => ({ sku: l.sku, qty: l.qty })), { sku: product.sku, qty }];
  const subtotal = withThis.reduce((s, l) => s + unitPrice(l.sku, state.session) * l.qty, 0);
  const units = withThis.reduce((n, l) => n + l.qty, 0);
  const orderLimits = orderLimitsForSession(state.session);
  const rows = [
    rule && { label: 'This product', hook: 'qty-note', ...productRow(rule, qty, inCart) },
    orderLimits && { label: 'Your order', hook: 'limit-count', ...orderRow(orderLimits, subtotal, units) },
  ].filter(Boolean);

  const addToCart = () => {
    if (!inStock || belowMin) return;
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
          {rows.length > 0 && (
            <div className="limit-block" aria-live="polite">
              {/* qty-note / limit-count: the rows the order-limit walkthrough reads. */}
              {rows.map((r) => (
                <div key={r.label} className={`limit-row limit-row--${r.tone} ${r.hook}`}>
                  <span className="limit-row__label">{r.label}</span>
                  <div className="limit-row__body">
                    {r.rule && <p className="limit-row__rule">{r.rule}</p>}
                    {r.status && (
                      <p className="limit-row__status">
                        {r.tone === 'warn' ? <WarningIcon /> : r.tone === 'review' ? <InfoIcon /> : null}
                        {r.status}
                      </p>
                    )}
                    {r.detail && <p className="limit-row__detail">{r.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Buy buttons + RFQ touchpoint */}
          <div className="buy-stack">
            <button className="button button--full" disabled={!inStock || belowMin} onClick={addToCart}>
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
