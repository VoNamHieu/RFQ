import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { productBySku } from '../data/products.js';
import { CloseIcon } from './icons.jsx';

// "Request a quote" — the storefront entry point into the RFQ app. In the real
// product this posts to the merchant's Request-a-Quote submission list; here it
// records the request in session state and confirms. Prefilled from the B2B
// session when the buyer is signed in.
export function QuoteRequestModal() {
  const { state, dispatch } = useStore();
  const open = state.quoteModal;
  const product = open ? productBySku(open.sku) : null;
  const session = state.session;

  const [form, setForm] = useState(() => ({
    name: session?.contact || '',
    email: session?.email || '',
    company: session?.companyName || '',
    qty: 50,
    note: '',
  }));

  if (!open || !product) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && form.email.trim() && Number(form.qty) > 0;

  const submit = () => {
    if (!valid) return;
    dispatch({
      type: 'SUBMIT_QUOTE',
      request: {
        id: `Q-${Math.floor(2100 + Math.random() * 800)}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        items: `${product.title} ×${form.qty}`,
        status: 'Pending',
        statusTone: 'amber',
      },
    });
  };

  return (
    <div className="overlay" onClick={() => dispatch({ type: 'CLOSE_QUOTE' })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Request a quote</h3>
          <button className="icon-btn" aria-label="Close" onClick={() => dispatch({ type: 'CLOSE_QUOTE' })}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal__body">
          <p className="muted" style={{ marginTop: 0 }}>
            Get volume pricing for <strong>{product.title}</strong>. We’ll reply with a tailored quote.
          </p>
          <div className="form-row">
            <label className="field-label">Full name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Your name" />
          </div>
          <div className="form-row">
            <label className="field-label">Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" />
          </div>
          <div className="form-row">
            <label className="field-label">Company</label>
            <input className="input" value={form.company} onChange={set('company')} placeholder="Company name" />
          </div>
          <div className="form-row">
            <label className="field-label">Quantity needed</label>
            <input className="input" type="number" min="1" value={form.qty} onChange={set('qty')} />
          </div>
          <div className="form-row">
            <label className="field-label">Notes (optional)</label>
            <textarea className="textarea" value={form.note} onChange={set('note')} placeholder="Target price, delivery date, variants…" />
          </div>
        </div>
        <div className="modal__foot">
          <button className="button button--secondary" onClick={() => dispatch({ type: 'CLOSE_QUOTE' })}>Cancel</button>
          <button className="button button--b2b" disabled={!valid} onClick={submit}>Send request</button>
        </div>
      </div>
    </div>
  );
}
