import React from 'react';
import { useStore } from '../store.jsx';
import { PRODUCTS } from '../data/products.js';
import { ProductCard } from '../components/ProductCard.jsx';

// Home = the theme's index.json: an image banner ("Browse our latest products")
// over a featured-collection grid.
export function Home() {
  const { state, dispatch } = useStore();

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <h1>Browse our latest products</h1>
          <button className="button button--secondary" style={{ color: '#fff', borderColor: '#fff' }} onClick={() => {}}>
            Shop all
          </button>
        </div>
      </section>

      {!state.session && (
        <div className="b2b-bar">
          <div className="page-width">
            <span>Buying for a business? <strong>Log in</strong> to see your contract prices, or request a quote on any product.</span>
            <button className="button button--b2b button--sm b2b-tag" onClick={() => dispatch({ type: 'LOGIN' })}>Log in to trade account</button>
          </div>
        </div>
      )}

      <section className="section page-width">
        <div className="section-head">
          <h2>Featured products</h2>
          <a className="link" onClick={() => {}}>View all</a>
        </div>
        <div className="product-grid">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.sku} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
