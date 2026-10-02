import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { DEMO_ACCOUNTS, BUSINESS_SUMMARY, QUOTE_STATUS } from '../data/products.js';
import { ApplyForm } from '../components/ApplyForm.jsx';
import { readRegistrationForm } from '../../shared/registrationForm.js';
import { money } from '../utils.js';
import { PinIcon, MailIcon, ChevronRightIcon, ChevronDownIcon, CardIcon, BoxIcon, CloseIcon } from '../components/icons.jsx';

const toneClass = (t) => (t === 'green' ? 'badge--green' : t === 'blue' ? 'badge--blue' : t === 'amber' ? 'badge--amber' : '');
const quoteTone = (status) => toneClass(QUOTE_STATUS[status]?.tone);
const lineSummary = (lines) => lines.map((l) => `${l.title} ×${l.quantity}`).join(', ');

// My account = Shopify's new customer-account portal: its own header (logo +
// company/location switcher + avatar) and a left nav. Orders and Profile are
// Shopify's own pages; B2B Portal and Quotes are the app's customer-account
// extension pages (qs-b2b-portal / qs-b2b-quotes), and the B2B blocks on Profile
// are its profile-block targets.
const NAV = [
  { id: 'orders', label: 'Orders' },
  { id: 'profile', label: 'Profile' },
  { id: 'portal', label: 'B2B Portal' },
  { id: 'quotes', label: 'Quotes' },
];

export function Account() {
  const { state, dispatch } = useStore();
  const session = state.session;
  const [section, setSection] = useState('profile');
  const [mktEmail, setMktEmail] = useState(session?.marketing?.email ?? false);
  const [openQuoteId, setOpenQuoteId] = useState(null);

  if (!session) return <AccountLogin dispatch={dispatch} />;

  const initial = (session.contact || '?').charAt(0).toUpperCase();
  const company = session.companyName ? { name: session.companyName, location: session.locationLabel } : null;
  const go = (id, quoteId = null) => { setSection(id); setOpenQuoteId(quoteId); };

  return (
    <div className="acct">
      {/* Portal header */}
      <header className="acct-header">
        <div className="acct-logo" onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}>221baker</div>
        <div className="acct-header-right">
          {session.locationLabel && <button className="acct-switcher">{session.locationLabel} <ChevronDownIcon /></button>}
          <button className="acct-avatar" title="Log out" onClick={() => dispatch({ type: 'LOGOUT' })}>{initial}</button>
        </div>
      </header>

      <div className="acct-body page-width">
        {/* Left nav */}
        <nav className="acct-nav">
          {NAV.map((n) => (
            <a key={n.id} className={section === n.id ? 'is-active' : ''} onClick={() => go(n.id)}>{n.label}</a>
          ))}
        </nav>

        {/* Content */}
        <div className="acct-content">
          {section === 'profile' && (
            <Profile
              session={session}
              company={company}
              application={state.b2bApplications[0]}
              mktEmail={mktEmail}
              onToggleMkt={() => setMktEmail((v) => !v)}
              go={go}
              dispatch={dispatch}
            />
          )}
          {section === 'orders' && <Orders orders={session.orders || []} dispatch={dispatch} />}
          {section === 'portal' && (
            <Portal session={session} company={company} application={state.b2bApplications[0]} go={go} dispatch={dispatch} />
          )}
          {section === 'apply' && <Apply session={session} go={go} dispatch={dispatch} />}
          {section === 'quotes' && (
            <Quotes quotes={state.quotes} company={company} openQuoteId={openQuoteId} setOpenQuoteId={setOpenQuoteId} dispatch={dispatch} />
          )}
        </div>
      </div>

      {state.orderQuote && <OrderQuoteModal orderQuote={state.orderQuote} orders={session.orders || []} go={go} dispatch={dispatch} />}
    </div>
  );
}

// Guest account entry — a stand-in for Shopify's hosted new-customer-accounts
// login: work email + a one-time code (passwordless), branding only. We do NOT
// put the B2B "apply" entry here — Shopify's login page can't carry custom
// content — it lives on the storefront (announcement bar / footer / apply page).
function AccountLogin({ dispatch }) {
  const [email, setEmail] = useState('');
  const go = (view) => dispatch({ type: 'NAVIGATE', view });
  const login = (value = email) => dispatch({ type: 'LOGIN', email: value });

  return (
    <div className="acct">
      <header className="acct-header">
        <div className="acct-logo" onClick={() => go('home')}>221 Baker</div>
      </header>

      <div className="acct-login">
        <h1>Log in</h1>
        <p className="muted">Enter your work email and we’ll send a one-time code — no password needed.</p>

        <div className="form-row">
          <label className="field-label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            onKeyDown={(e) => e.key === 'Enter' && login()}
          />
        </div>
        <button className="button button--full" onClick={() => login()}>Continue</button>

        {/* Dev note: which demo account shows which B2B state. */}
        <div className="acct-devnote">
          <span className="badge badge--blue">Dev</span>
          <p className="muted">Two demo accounts — any other email signs in as the not-applied buyer.</p>
          {DEMO_ACCOUNTS.map((a) => (
            <button className="acct-devnote-row" key={a.id} onClick={() => { setEmail(a.email); login(a.email); }}>
              <strong>{a.email}</strong>
              <span className="acct-row-sub">{a.devNote}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── B2B Portal (customer-account.page.render) ────────────────────────────────
// The app's own page in the customer account: who the buyer purchases for, the
// terms that apply, and the last orders they can turn into a quote request.
function Portal({ session, company, application, go, dispatch }) {
  const s = BUSINESS_SUMMARY;
  const orders = session.orders || [];
  const terms = [
    { label: 'Pricing', value: session.priceListName || s.priceListName },
    { label: 'Payment terms', value: s.paymentTerms },
    { label: 'Ordering', value: s.purchasingMode },
    { label: 'Negotiated products', value: `${s.negotiatedProductCount} products` },
  ].filter((t) => t.value);

  return (
    <>
      <PageHead
        title="B2B Portal"
        sub={company ? `${company.name} · ${company.location}` : 'Quotes, business pricing and purchasing in one place'}
        actions={
          <>
            <button className="button button--b2b button--sm" onClick={() => go('quotes')}>View all quotes</button>
            <button className="acct-btn" onClick={() => go('orders')}>View orders</button>
            <button className="acct-btn" onClick={() => go('profile')}>Business profile</button>
          </>
        }
      />

      {company ? (
        <section className="acct-panel">
          <div className="acct-panel-head">
            <h3>Business account</h3>
            {s.pricingActive && <span className="badge badge--green">Company pricing active</span>}
          </div>
          <p className="muted">Purchasing for {company.name} · {company.location}</p>
          <div className="acct-terms">
            {terms.map((t) => (
              <div className="acct-term" key={t.label}>
                <span className="muted">{t.label}</span>
                <strong>{t.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <BusinessRegistration application={application} go={go} />
      )}

      <section className="acct-panel">
        <div className="acct-panel-head">
          <h3>Recent orders</h3>
          {orders.length > 0 && <button className="acct-btn" onClick={() => go('orders')}>View all</button>}
        </div>
        {orders.length === 0 ? (
          <p className="muted">No orders yet. Orders placed for your account will appear here.</p>
        ) : (
        <>
        <p className="muted">Open an order and choose Request a quote to reuse its products in a new quote request.</p>
        <div className="acct-order-grid">
          {orders.map((o) => (
            <article className="acct-order-card" key={o.id}>
              <div className="acct-panel-head">
                <strong>Order {o.id}</strong>
                <span className={`badge ${toneClass(o.statusTone)}`}>{o.status}</span>
              </div>
              <p className="muted">{o.date}</p>
              <ul className="acct-lines">
                {o.lines.map((l) => <li key={l.sku}>{l.title} ×{l.quantity}</li>)}
              </ul>
              <strong>{money(o.total)}</strong>
              <button className="acct-btn" onClick={() => dispatch({ type: 'OPEN_ORDER_QUOTE', orderId: o.id })}>Request a quote</button>
            </article>
          ))}
        </div>
        </>
        )}
      </section>
    </>
  );
}

// ── Quotes (customer-account.page.render) ────────────────────────────────────
// List → detail, with the two things a buyer does with an offer: accept it, or
// counter it. An accepted offer is saved back as company pricing.
const QUOTE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Needs your action' },
  { id: 'progress', label: 'In progress' },
  { id: 'closed', label: 'Accepted / closed' },
];

function Quotes({ quotes, company, openQuoteId, setOpenQuoteId, dispatch }) {
  const [filter, setFilter] = useState('all');
  const selected = quotes.find((q) => q.id === openQuoteId) || null;
  const sub = company ? `${company.name} · ${company.location}` : 'Your requests and negotiated offers';

  if (selected) return <QuoteDetail quote={selected} sub={sub} onBack={() => setOpenQuoteId(null)} dispatch={dispatch} />;

  const shown = quotes.filter((q) => filter === 'all' || QUOTE_STATUS[q.status]?.group === filter);

  return (
    <>
      <PageHead title="Quotes" sub={sub} />
      <div className="form-row">
        <label className="field-label">Show quotes</label>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {QUOTE_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="acct-card acct-empty">Quote requests matching this filter will appear here.</div>
      ) : (
        shown.map((q) => (
          <section className="acct-panel" key={q.id}>
            <div className="acct-panel-head">
              <strong>{q.id}</strong>
              <span className={`badge ${quoteTone(q.status)}`}>{q.status}</span>
            </div>
            <p>{lineSummary(q.lines)}</p>
            <p className="muted">{q.date}{q.total != null ? ` · ${money(q.total)}` : ''}</p>
            {q.savedToPricing && <p className="muted">Agreed price is available for future orders.</p>}
            <button className="acct-btn" onClick={() => setOpenQuoteId(q.id)}>View quote</button>
          </section>
        ))
      )}
    </>
  );
}

function QuoteDetail({ quote, sub, onBack, dispatch }) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [counter, setCounter] = useState('');
  const send = () => {
    if (!(Number(counter) > 0)) return;
    dispatch({ type: 'COUNTER_QUOTE', id: quote.id, unitPrice: counter });
    setCounterOpen(false);
    setCounter('');
  };

  return (
    <>
      <button className="acct-back" onClick={onBack}>← Back to quotes</button>
      <PageHead title={`Quote ${quote.id}`} sub={sub} />

      {quote.savedToPricing && (
        <div className="acct-note acct-note--success">
          <strong>Price available for future orders</strong>
          <p className="muted">Your company can reuse the agreed price without requesting another quote.</p>
        </div>
      )}

      <section className="acct-panel">
        <div className="acct-panel-head">
          <strong>{quote.id}</strong>
          <span className={`badge ${quoteTone(quote.status)}`}>{quote.status}</span>
        </div>
        <p className="muted">{quote.date}</p>
        {quote.message && <p>{quote.message}</p>}
      </section>

      <section className="acct-panel">
        <h3>Products</h3>
        {quote.lines.map((l) => (
          <div className="acct-quote-line" key={l.sku}>
            <div>
              <strong>{l.title}</strong>
              <span className="acct-row-sub">{l.quantity} units · {l.sku}</span>
            </div>
            <div className="acct-quote-price">
              <strong>{l.unitPrice == null ? 'Waiting for seller price' : `${money(l.unitPrice)} each`}</strong>
              {l.listPrice != null && l.unitPrice != null && <span className="acct-row-sub">Store price {money(l.listPrice)}</span>}
            </div>
          </div>
        ))}
        {quote.total != null && (
          <div className="acct-quote-total"><strong>Total</strong><strong>{money(quote.total)}</strong></div>
        )}
      </section>

      {quote.status === 'Quoted' && (
        <section className="acct-panel">
          <h3>Respond to offer</h3>
          <div className="acct-page-actions">
            <button className="button button--b2b button--sm" onClick={() => dispatch({ type: 'ACCEPT_QUOTE', id: quote.id })}>Accept offer</button>
            <button className="acct-btn" onClick={() => setCounterOpen((v) => !v)}>Send counter offer</button>
          </div>
          {counterOpen && (
            <div className="form-row" style={{ marginTop: '1.6rem' }}>
              <label className="field-label">Counter offer per unit (USD)</label>
              <input className="input" value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="110" />
              <button className="button button--sm" style={{ marginTop: '1.2rem' }} onClick={send}>Send counter</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

// ── Profile (Shopify's page + the app's profile blocks) ─────────────────────
function Profile({ session, company, application, mktEmail, onToggleMkt, go, dispatch }) {
  const toast = (message) => dispatch({ type: 'TOAST', message });
  const s = BUSINESS_SUMMARY;
  const addresses = session.addresses || [];

  return (
    <>
      {/* Portal link block (customer-account.profile.block.render) — B2B only */}
      {company && (
        <div className="acct-banner">
          {`Quotes and business pricing for ${company.name} · ${company.location}`}
          <a className="link" onClick={() => go('portal')}>Open B2B Portal</a>
        </div>
      )}

      {/* Registration block: the apply entry, or the application's status. */}
      {!company && <BusinessRegistration application={application} go={go} />}

      {/* Person */}
      <div className="acct-section-head">
        <h2>{session.contact}</h2>
        <button className="acct-btn acct-btn--link" onClick={() => toast('Demo only')}>Edit</button>
      </div>
      <div className="acct-field">
        <span className="acct-field-label">Email</span>
        <span className="acct-field-value">{session.email}</span>
      </div>

      {/* Company (Shopify's company details) — only for a B2B buyer */}
      {company && (
        <div className="acct-company">
          <h2>{company.name}</h2>
          <p className="muted">{company.location}</p>
        </div>
      )}

      {/* Business purchasing block (profile.company-details.render-after) */}
      {company && (
        <section className="acct-panel">
          <div className="acct-panel-head">
            <h3>Business purchasing</h3>
            {s.pricingActive && <span className="badge badge--green">Company pricing active</span>}
          </div>
          <p>{company.name} · {company.location}</p>
          <p className="muted">Pricing: {s.priceListName}</p>
          <p className="muted">{s.negotiatedProductCount} products have reusable negotiated pricing.</p>
          <div className="acct-page-actions">
            <button className="button button--b2b button--sm" onClick={() => go('portal')}>Open B2B Portal</button>
            <button className="acct-btn" onClick={() => go('quotes')}>View quotes</button>
            <button className="acct-btn" onClick={() => go('orders')}>View orders</button>
          </div>
        </section>
      )}

      {/* Addresses — a plain customer keeps one list; a company buyer gets the
          company's shipping and billing addresses. */}
      {company ? (
        <>
          <h3 className="acct-h">Shipping address</h3>
          <AddressCard address={session.shippingAddress} onClick={() => toast('Demo only')} />
          <h3 className="acct-h">Billing address</h3>
          <AddressCard address={session.billingAddress} onClick={() => toast('Demo only')} />
        </>
      ) : (
        <>
          <div className="acct-section-head">
            <h3 className="acct-h" style={{ margin: 0 }}>Addresses</h3>
            <button className="acct-btn acct-btn--link" onClick={() => toast('Demo only')}>Add</button>
          </div>
          {addresses.length === 0 ? (
            <div className="acct-card acct-empty">No addresses saved.</div>
          ) : (
            addresses.map((a, i) => (
              <AddressCard key={i} address={a} tag={a.default ? 'Default' : null} onClick={() => toast('Demo only')} />
            ))
          )}
        </>
      )}

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

      {/* Payment methods — only where the account has any */}
      {session.paymentMethods.length > 0 && (
        <>
          <div className="acct-section-head">
            <h3 className="acct-h" style={{ margin: 0 }}>Payment methods</h3>
            <button className="acct-btn acct-btn--link" onClick={() => toast('Demo only')}>Add</button>
          </div>
          {session.paymentMethods.map((pm, i) => (
            <div className="acct-row" key={i}>
              <span className="acct-row-icon"><CardIcon /></span>
              <span className="acct-row-main">
                <strong>{pm.brand} ending in {pm.last4}</strong>
                <span className="muted"> · Expires {pm.expires}</span>
              </span>
            </div>
          ))}
        </>
      )}

      {/* Purchasing terms block (profile.company-location-payment.render-after) */}
      {company && (
        <section className="acct-panel">
          <h3>Purchasing terms</h3>
          <p className="muted">Payment terms: {s.paymentTerms}</p>
          <p className="muted">Ordering: {s.purchasingMode}</p>
          {s.pricingActive && <p className="muted">Company pricing is active for this location.</p>}
        </section>
      )}

      <div className="acct-signout">
        <button className="acct-btn" onClick={() => dispatch({ type: 'LOGOUT' })}>Sign out</button>
        <a className="link" onClick={() => dispatch({ type: 'LOGOUT' })}>Sign out of all devices</a>
      </div>
    </>
  );
}

// ── Apply for a business account (the app's registration page) ───────────────
// The fields come from the merchant's form builder in the B2B app, so whatever
// they configure there is what a buyer fills in here.
function Apply({ session, go, dispatch }) {
  const form = readRegistrationForm();
  return (
    <>
      <button className="acct-back" onClick={() => go('profile')}>← {form.heading}</button>
      <p className="muted acct-apply-sub">{form.subheading}</p>
      <ApplyForm session={session} dispatch={dispatch} onSubmitted={() => go('profile')} />
    </>
  );
}

// Profile / portal block for a buyer with no company yet: apply, or the status
// of the application they already sent.
function BusinessRegistration({ application, go }) {
  if (application) {
    return (
      <section className="acct-panel">
        <div className="acct-panel-head">
          <h3>Business account application</h3>
          <span className="badge badge--amber">{application.status}</span>
        </div>
        <p className="muted">Ref {application.ref} · Submitted {application.date} · we’ll email you once approved</p>
      </section>
    );
  }
  return (
    <section className="acct-panel acct-apply-cta">
      <h3>Apply for a business account</h3>
      <p className="muted">Ordering for a business? Unlock contract pricing, volume discounts, and quote requests.</p>
      <button className="button button--b2b button--sm" onClick={() => go('apply')}>Apply</button>
    </section>
  );
}

function PageHead({ title, sub, actions }) {
  return (
    <header className="acct-page-head">
      <div>
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="acct-page-actions">{actions}</div>}
    </header>
  );
}

function AddressCard({ address, tag, onClick }) {
  return (
    <button className="acct-row acct-row--button" onClick={onClick}>
      <span className="acct-row-icon"><PinIcon /></span>
      <span className="acct-row-main">
        <strong>{address.name}{tag && <span className="acct-tag">{tag}</span>}</strong>
        <span className="acct-row-sub">{address.line}</span>
      </span>
      <span className="acct-row-chevron"><ChevronRightIcon /></span>
    </button>
  );
}

function Orders({ orders, dispatch }) {
  if (orders.length === 0) {
    return (
      <>
        <PageHead title="Orders" />
        <div className="acct-card acct-empty">No orders yet. Orders placed for your account will appear here.</div>
      </>
    );
  }
  return (
    <>
      <PageHead title="Orders" />
      {orders.map((o) => (
        <div className="acct-row acct-row--order" key={o.id}>
          <span className="acct-row-icon"><BoxIcon /></span>
          <span className="acct-row-main">
            <strong>Order {o.id}</strong>
            <span className="acct-row-sub">{o.date} · {money(o.total)}</span>
          </span>
          <span className={`badge ${toneClass(o.statusTone)}`}>{o.status}</span>
          {/* Order action extension (customer-account.order.action.menu-item) */}
          <button className="acct-btn" onClick={() => dispatch({ type: 'OPEN_ORDER_QUOTE', orderId: o.id })}>Request a quote</button>
        </div>
      ))}
    </>
  );
}

// "Request a quote" from an order — the order's products become the new request.
function OrderQuoteModal({ orderQuote, orders, go, dispatch }) {
  const order = orders.find((o) => o.id === orderQuote.orderId);
  const [note, setNote] = useState('');
  const [created, setCreated] = useState(null);
  const close = () => dispatch({ type: 'CLOSE_ORDER_QUOTE' });

  const submit = () => {
    const id = `Q-${Math.floor(2100 + Math.random() * 800)}`;
    setCreated(id);
    dispatch({
      type: 'SUBMIT_QUOTE',
      request: {
        id,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: 'Pending',
        total: null,
        savedToPricing: false,
        message: note.trim() || `Requested from order ${order.id}.`,
        lines: order.lines.map((l) => ({ ...l, unitPrice: null, listPrice: null })),
      },
    });
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{created ? 'Quote request created' : 'Request a quote from this order'}</h3>
          <button className="icon-btn" aria-label="Close" onClick={close}><CloseIcon /></button>
        </div>
        {created ? (
          <>
            <div className="modal__body">
              <div className="acct-note acct-note--success">
                <strong>{created} has been sent to the seller.</strong>
                <p className="muted">You can track the request from Quotes in your account.</p>
              </div>
            </div>
            <div className="modal__foot">
              <button className="acct-btn" onClick={close}>Close</button>
              <button className="button button--b2b button--sm" onClick={() => { close(); go('quotes'); }}>View quotes</button>
            </div>
          </>
        ) : (
          <>
            <div className="modal__body">
              <p className="muted" style={{ marginTop: 0 }}>
                We’ll use the products from order {order.id} as the starting point for a new quote request.
              </p>
              <ul className="acct-lines">
                {order.lines.map((l) => <li key={l.sku}>{l.title} ×{l.quantity}</li>)}
              </ul>
              <div className="form-row">
                <label className="field-label">Message to seller (optional)</label>
                <textarea className="textarea" rows="3" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <div className="modal__foot">
              <button className="acct-btn" onClick={close}>Cancel</button>
              <button className="button button--b2b button--sm" onClick={submit}>Create quote request</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
