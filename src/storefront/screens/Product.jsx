import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { productBySku, b2bPriceFor } from '../data/products.js';
import { Price } from '../components/Price.jsx';
import { QuoteIcon, InfoIcon } from '../components/icons.jsx';

// Product = the theme's main-product section: media gallery + info column
// (vendor, title, price, variant picker, quantity, buy buttons, description).
// The B2B×RFQ touchpoints layer on top: contract-price display and a
// "Request a quote" action for volume/bulk buyers.
export function Product() {
  const { state, dispatch } = useStore();
  const product = productBySku(state.currentSku);
  const [variantId, setVariantId] = useState(product?.variants[0]?.id);
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <div className="section page-width empty">
        Product not found. <a className="link" onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}>Back to shop</a>
      </div>
    );
  }

  const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
  const hasB2B = b2bPriceFor(product.sku, state.session) != null;
  const inStock = (variant?.stock ?? 0) > 0;

  const addToCart = () => {
    if (!inStock) return;
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
          <p className="muted" style={{ marginTop: 0 }}>{product.tagline}</p>

          <div className="product__price"><Price sku={product.sku} list={product.list} size="lg" /></div>

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
                    disabled={v.stock === 0}
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
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <input value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            <button onClick={() => setQty((q) => q + 1)}>+</button>
          </div>

          {/* Buy buttons + RFQ touchpoint */}
          <div className="buy-stack">
            <button className="button button--full" disabled={!inStock} onClick={addToCart}>
              {inStock ? 'Add to cart' : 'Out of stock'}
            </button>
            <button className="button button--b2b button--full" onClick={() => dispatch({ type: 'OPEN_QUOTE', sku: product.sku })}>
              <QuoteIcon style={{ width: '1.9rem', height: '1.9rem' }} /> Request a quote
            </button>
            <span className="muted" style={{ fontSize: '1.3rem' }}>
              {inStock ? `${variant.stock} in stock` : 'Backorder available on request'}
            </span>
          </div>

          <div className="product__desc"><p>{product.description}</p></div>
        </div>
      </div>
    </section>
  );
}
