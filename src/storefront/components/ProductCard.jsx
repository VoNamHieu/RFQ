import React from 'react';
import { useStore } from '../store.jsx';
import { b2bPriceFor } from '../data/products.js';
import { Price } from './Price.jsx';

// Dawn card-product: media, vendor, title, price. Shows a small "B2B price" badge
// when the current buyer has a contract price for this product.
export function ProductCard({ product }) {
  const { state, dispatch } = useStore();
  const hasB2B = b2bPriceFor(product.sku, state.session) != null;

  return (
    <div className="card" onClick={() => dispatch({ type: 'OPEN_PRODUCT', sku: product.sku })}>
      <div className="card__media">
        {hasB2B && <span className="card__badge">B2B price</span>}
        <img src={product.image} alt={product.title} loading="lazy" />
      </div>
      <div className="stack-sm">
        <div className="card__vendor">{product.vendor}</div>
        <div className="card__title">{product.title}</div>
        <Price sku={product.sku} list={product.list} />
      </div>
    </div>
  );
}
