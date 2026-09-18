import React from 'react';
import { money } from '../utils.js';
import { b2bPriceFor } from '../data/products.js';
import { useStore } from '../store.jsx';

// Renders a product's price for the current session. A logged-in B2B buyer whose
// price list covers the SKU sees the contract price (list struck through); a guest
// sees the plain list price. `size="lg"` for the product page.
export function Price({ sku, list, size }) {
  const { state } = useStore();
  const b2b = b2bPriceFor(sku, state.session);
  const cls = size === 'lg' ? 'price product__price' : 'price';

  if (b2b != null) {
    return (
      <div className={cls}>
        <span className="price__b2b">{money(b2b)}</span>
        <span className="price__was">{money(list)}</span>
        {size === 'lg' && <span className="price__note">Your {state.session.priceListName} price</span>}
      </div>
    );
  }
  return <div className={cls}>{money(list)}</div>;
}
