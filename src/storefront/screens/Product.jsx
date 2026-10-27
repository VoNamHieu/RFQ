import React, { useState } from 'react';
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

// This product, under its quantity rule (productRuleForSession): the quantity
// picked only — not the variants already in the cart (Check out counts those).
// One status, the first that applies: under the minimum, over the maximum, not a
// multiple of the pack, over a maximum sent for review.
function productRow(rule, qty) {
  const step = rule.increment || 1;
  const parts = [step > 1 && `Sold in packs of ${step}`, rule.min && `Min ${rule.min}`, rule.max && (rule.review ? `Review above ${rule.max}` : `Max ${rule.max}`)];
  const row = { rule: parts.filter(Boolean).join(' · '), tone: 'info', status: null, detail: null };
  const at = (tone, status) => ({ ...row, tone, status });
  if (rule.min != null && qty < rule.min) return at('warn', `${qty} of ${rule.min} minimum · add ${rule.min - qty} more`);
  if (rule.max != null && !rule.review && qty > rule.max) return at('warn', `${qty} of ${rule.max} maximum · remove ${qty - rule.max}`);
  if (qty % step) {
    // The quantities to pick instead: the pack multiples either side.
    const choices = [Math.floor(qty / step) * step, Math.ceil(qty / step) * step].filter((n) => n > 0);
    return at('warn', `${qty} isn’t a multiple of ${step} · choose ${choices.join(' or ')}`);
  }
  if (rule.review && qty > rule.max) return at('review', `${qty} of ${rule.max} · the seller will review this order`);
  return row;
}

// Your order, under the order limits (orderLimitsForSession): `subtotal` and
// `units` with the quantity picked. A weekly or monthly maximum counts the orders
// so far in the period too. One status, the first that applies: under a minimum
// (value, then quantity), over a maximum (value, then quantity), over a maximum
// sent for review (value, then quantity).
function orderRow(limits, subtotal, units) {
  const per = (p) => (p === 'order' ? '' : ` per ${p}`);
  const parts = [
    limits.minValue && `Min ${whole(limits.minValue)}`,
    ...PERIODS.map((p) => limits[keyFor('maxValue', p)] && `Max ${whole(limits[keyFor('maxValue', p)])}${per(p)}`),
    ...PERIODS.map((p) => limits[keyFor('threshold', p)] && `Review above ${whole(limits[keyFor('threshold', p)])}${per(p)}`),
    limits.minQty && `Min ${limits.minQty} items`,
    limits.maxQty && `Max ${limits.maxQty} items`,
    limits.thresholdQty && `Review above ${limits.thresholdQty} items`,
  ];
  const row = { rule: parts.filter(Boolean).join(' · '), tone: 'info', status: `${money(subtotal)} · within your order limits`, detail: null };
  const at = (tone, status, detail = null) => ({ ...row, tone, status, detail });
  const sofar = (p) => (p === 'order' ? 0 : Number(limits.spent?.[p]) || 0);
  const sofarDetail = (p, total) => (sofar(p) ? `${money(total)} = ${money(sofar(p))} ordered this ${p} + ${money(subtotal)} this order` : null);
  if (limits.minValue && subtotal < limits.minValue) return at('warn', `${money(subtotal)} of ${whole(limits.minValue)} minimum · add ${money(limits.minValue - subtotal)} more`);
  if (limits.minQty && units < limits.minQty) return at('warn', `${units} of ${limits.minQty} items minimum · add ${limits.minQty - units} more`);
  for (const p of PERIODS) {
    const cap = limits[keyFor('maxValue', p)];
    const total = sofar(p) + subtotal;
    if (cap && total > cap) return at('warn', `${money(total)} of ${whole(cap)} ${p === 'order' ? '' : `${p}ly `}maximum · remove ${money(total - cap)} to check out`, sofarDetail(p, total));
  }
  if (limits.maxQty && units > limits.maxQty) return at('warn', `${units} of ${limits.maxQty} items maximum · remove ${units - limits.maxQty} to check out`);
  for (const p of PERIODS) {
    const t = limits[keyFor('threshold', p)];
    const total = sofar(p) + subtotal;
    if (t && total > t) return at('review', `${money(total)} of ${whole(t)}${p === 'order' ? '' : ` this ${p}`} · the seller will review this order`, sofarDetail(p, total));
  }
  if (limits.thresholdQty && units > limits.thresholdQty) return at('review', `${units} of ${limits.thresholdQty} items · the seller will review this order`);
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
  // The buyer's quantity rule (order limits, B2B or D2C). The quantity starts at 1;
  // + and − step to the pack's multiples (pack of 5: 1 → 5 → 10, and back).
  const rule = product ? productRuleForSession(product.sku, state.session) : null;
  const step = rule?.increment || 1;
  const [qty, setQty] = useState(1);
  const up = (q) => (q % step ? Math.ceil(q / step) * step : q + step);
  const down = (q) => Math.max(1, q % step ? Math.floor(q / step) * step : q - step);

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

  // A quantity that isn't a multiple of the pack can't be added (the block says why);
  // under the minimum or over the maximum it can — Check out stops those.
  const offPack = qty % step !== 0;
  // The order as it would be with this quantity in the cart, counted against the order limits.
  const withThis = [...state.cart.map((l) => ({ sku: l.sku, qty: l.qty })), { sku: product.sku, qty }];
  const subtotal = withThis.reduce((s, l) => s + unitPrice(l.sku, state.session) * l.qty, 0);
  const units = withThis.reduce((n, l) => n + l.qty, 0);
  const orderLimits = orderLimitsForSession(state.session);
  const rows = [
    rule && { label: 'This product', ...productRow(rule, qty) },
    orderLimits && { label: 'Your order', ...orderRow(orderLimits, subtotal, units) },
  ].filter(Boolean);
  // Buy Now goes straight to checkout, so a limit that blocks checkout (a 'warn' row) turns it off.
  const blocked = rows.some((r) => r.tone === 'warn');

  const addToCart = () => {
    if (!inStock || offPack) return;
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
            <button onClick={() => setQty(down)}>−</button>
            <input value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            <button onClick={() => setQty(up)}>+</button>
          </div>
          {rows.length > 0 && (
            <div className="limit-block" aria-live="polite">
              {rows.map((r) => (
                <div key={r.label} className={`limit-row limit-row--${r.tone}`}>
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
            <button className="button button--full" disabled={!inStock || offPack} onClick={addToCart}>
              {inStock ? 'Add to cart' : 'Out of stock'}
            </button>
            <button className="button button--secondary button--full" disabled={!inStock || blocked} onClick={() => dispatch({ type: 'TOAST', message: 'Demo only' })}>
              Buy Now
            </button>
            <button className="button button--secondary button--full" onClick={() => dispatch({ type: 'NAVIGATE', view: 'cart' })}>
              Open cart page
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
