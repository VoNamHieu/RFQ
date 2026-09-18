import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { ACCOUNT_ORDERS, ACCOUNT_QUOTES } from '../data/products.js';
import { money } from '../utils.js';
import { PinIcon, MailIcon, ChevronRightIcon, ChevronDownIcon, CardIcon, BoxIcon, CloseIcon } from '../components/icons.jsx';

const toneClass = (t) => (t === 'green' ? 'badge--green' : t === 'blue' ? 'badge--blue' : t === 'amber' ? 'badge--amber' : '');

// My account = Shopify's new customer-account portal: its own header (logo +
// company/location switcher + avatar) and a left nav with two sections —
// Profile (built to the provided design) and Orders. The B2B×RFQ touchpoint
// lives at the top of Profile as "Manage your quote list".
export function Account() {
  const { state, dispatch } = useStore();
  const session = state.session;
  const [section, setSection] = useState('profile');
  const [mktEmail, setMktEmail] = useState(session?.marketing?.email ?? false);
  const [quotesOpen, setQuotesOpen] = useState(false);

  if (!session) {
    return (
      <section className="section page-width empty">
        <p>You’re signed out.</p>
        <button className="button" onClick={() => dispatch({ type: 'LOGIN' })}>Log in</button>
      </section>
    );
  }

  const initial = (session.contact || '?').charAt(0).toUpperCase();
  const quotes = [...state.quoteRequests, ...ACCOUNT_QUOTES];

  return (
    <div className="acct">
      {/* Portal header */}
      <header className="acct-header">
        <div className="acct-logo" onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}>221baker</div>
        <div className="acct-header-right">
          <button className="acct-switcher">{session.locationLabel} <ChevronDownIcon /></button>
          <button className="acct-avatar" title="Log out" onClick={() => dispatch({ type: 'LOGOUT' })}>{initial}</button>
        </div>
      </header>

      <div className="acct-body page-width">
        {/* Left nav */}
        <nav className="acct-nav">
          <a className={section === 'orders' ? 'is-active' : ''} onClick={() => setSection('orders')}>Orders</a>
          <a className={section === 'profile' ? 'is-active' : ''} onClick={() => setSection('profile')}>Profile</a>
        </nav>

        {/* Content */}
        <div className="acct-content">
          {section === 'profile' ? (
            <Profile
              session={session}
              mktEmail={mktEmail}
              onToggleMkt={() => setMktEmail((v) => !v)}
              onViewQuote={() => setQuotesOpen(true)}
              dispatch={dispatch}
            />
          ) : (
            <Orders />
          )}
        </div>
      </div>

      {quotesOpen && <QuotesModal quotes={quotes} onClose={() => setQuotesOpen(false)} />}
    </div>
  );
}

function Profile({ session, mktEmail, onToggleMkt, onViewQuote, dispatch }) {
  const toast = (message) => dispatch({ type: 'TOAST', message });
  return (
    <>
      {/* Quote-list banner — the RFQ touchpoint */}
      <div className="acct-banner">
        Manage your quote list <a className="link" onClick={onViewQuote}>View quote</a>
      </div>

      {/* Person */}
      <div className="acct-section-head">
        <h2>{session.contact}</h2>
        <button className="acct-btn" onClick={() => toast('Edit profile is not wired up in this prototype')}>Edit</button>
      </div>
      <div className="acct-field">
        <span className="acct-field-label">Email</span>
        <span className="acct-field-value">{session.email}</span>
      </div>

      {/* Marketing preferences */}
      <h3 className="acct-h">Marketing preferences</h3>
      <div className="acct-row">
        <span className="acct-row-icon"><MailIcon /></span>
        <span className="acct-row-main">Email</span>
        <button
          className={`acct-toggle${mktEmail ? ' is-on' : ''}`}
          role="switch"
          aria-checked={mktEmail}
          aria-label="Email marketing"
          onClick={onToggleMkt}
        >
          <span className="acct-toggle-knob" />
        </button>
      </div>

      {/* Company */}
      <div className="acct-company">
        <h2>{session.companyName}</h2>
        <p className="muted">{session.locationLabel}</p>
      </div>

      {/* Shipping address */}
      <h3 className="acct-h">Shipping address</h3>
      <AddressCard address={session.shippingAddress} onClick={() => toast('Address editing is not wired up in this prototype')} />

      {/* Billing address */}
      <h3 className="acct-h">Billing address</h3>
      <AddressCard address={session.billingAddress} onClick={() => toast('Address editing is not wired up in this prototype')} />

      {/* Payment methods */}
      <div className="acct-section-head">
        <h3 className="acct-h" style={{ margin: 0 }}>Payment methods</h3>
        <button className="acct-btn" onClick={() => toast('Add payment method is not wired up in this prototype')}>Add</button>
      </div>
      {session.paymentMethods.length === 0 ? (
        <div className="acct-card acct-empty">No payment methods saved.</div>
      ) : (
        session.paymentMethods.map((pm, i) => (
          <div className="acct-row" key={i}>
            <span className="acct-row-icon"><CardIcon /></span>
            <span className="acct-row-main">
              <strong>{pm.brand} ending in {pm.last4}</strong>
              <span className="muted"> · Expires {pm.expires}</span>
            </span>
          </div>
        ))
      )}
    </>
  );
}

function AddressCard({ address, onClick }) {
  return (
    <button className="acct-row acct-row--button" onClick={onClick}>
      <span className="acct-row-icon"><PinIcon /></span>
      <span className="acct-row-main">
        <strong>{address.name}</strong>
        <span className="acct-row-sub">{address.line}</span>
      </span>
      <span className="acct-row-chevron"><ChevronRightIcon /></span>
    </button>
  );
}

function Orders() {
  return (
    <>
      <h2 style={{ marginBottom: '2rem' }}>Orders</h2>
      {ACCOUNT_ORDERS.map((o) => (
        <div className="acct-row acct-row--order" key={o.id}>
          <span className="acct-row-icon"><BoxIcon /></span>
          <span className="acct-row-main">
            <strong>Order {o.id}</strong>
            <span className="acct-row-sub">{o.date} · {money(o.total)}</span>
          </span>
          <span className={`badge ${toneClass(o.statusTone)}`}>{o.status}</span>
        </div>
      ))}
    </>
  );
}

function QuotesModal({ quotes, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Your quote list</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal__body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Quote</th><th>Date</th><th>Items</th><th>Status</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.id}</strong></td>
                  <td className="muted">{q.date}</td>
                  <td>{q.items}</td>
                  <td><span className={`badge ${toneClass(q.statusTone)}`}>{q.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
