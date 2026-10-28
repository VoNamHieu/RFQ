import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { DEMO_ACCOUNTS, BUSINESS_SUMMARY, QUOTE_STATUS, REQUEST_STATUS, agreementForSession, orderRequestsForSession, productBySku } from '../data/products.js';
import { ApplyForm } from '../components/ApplyForm.jsx';
import { readRegistrationForm } from '../../shared/registrationForm.js';
import { addInvoiceCheckout } from '../../shared/persistence.js';
import { money } from '../utils.js';
import { PinIcon, MailIcon, ChevronRightIcon, ChevronDownIcon, CardIcon, BoxIcon, CloseIcon } from '../components/icons.jsx';

const toneClass = (t) => (t === 'green' ? 'badge--green' : t === 'blue' ? 'badge--blue' : t === 'amber' ? 'badge--amber' : '');
const quoteTone = (status) => toneClass(QUOTE_STATUS[status]?.tone);
const lineSummary = (lines) => lines.map((l) => `${l.title} ×${l.quantity}`).join(', ');

// My account = Shopify's new customer-account portal: its own header (logo +
// company/location switcher + avatar) and a left nav. Orders and Profile are
// Shopify's own pages — the app can't add to Orders' list, so order requests sent
// for review are on the B2B Portal; B2B Portal and Quotes are the app's
// customer-account extension pages (qs-b2b-portal / qs-b2b-quotes), and the B2B
// blocks on Profile are its profile-block targets.
const NAV = [
  { id: 'orders', label: 'Orders' },
  { id: 'profile', label: 'Profile' },
  { id: 'portal', label: 'B2B Portal' },
  { id: 'quotes', label: 'Quotes' },
];

export function Account() {
  const { state, dispatch } = useStore();
  const session = state.session;
  const [section, setSection] = useState(state.accountSection || 'profile');
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
            <Portal session={session} company={company} application={state.b2bApplications[0]} requests={orderRequestsForSession(session)} go={go} dispatch={dispatch} />
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
// terms that apply, and their orders — the ones sent for review among them — which
// they can turn into a quote request.
function Portal({ session, company, application, requests, go, dispatch }) {
  const s = BUSINESS_SUMMARY;
  const agreement = agreementForSession(session);
  const orders = session.orders || [];
  // An order opened from the Orders panel, by its key.
  const [openKey, setOpenKey] = useState(null);
  const items = portalOrderItems(orders, requests);
  const open = items.find((it) => it.key === openKey);
  if (open) return <OrderDetail item={open} session={session} onBack={() => setOpenKey(null)} dispatch={dispatch} />;
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

      {/* The company's agreement with the merchant (B2B app → Agreements), read-only. */}
      {company && agreement && (
        <section className="acct-panel acct-contract">
          <div className="acct-panel-head">
            <h3>Contract</h3>
            <span className="badge badge--green">Active</span>
          </div>
          <div className="acct-contract-id">
            <strong>{agreement.name}</strong>
            <span className="muted">{`${agreement.number} · Version ${agreement.version}`}</span>
          </div>
          <div className="acct-contract-dates">
            {agreement.start || agreement.end ? (
              <>
                <div className="acct-contract-date">
                  <span>Start date</span>
                  <strong>{agreement.start || '—'}</strong>
                </div>
                <div className="acct-contract-date">
                  <span>End date</span>
                  <strong>{agreement.end || 'No end date'}</strong>
                </div>
              </>
            ) : (
              <div className="acct-contract-date">
                <span>Dates</span>
                <strong>{agreement.dates}</strong>
              </div>
            )}
          </div>
          {(agreement.pricing.length > 0 || agreement.limits.length > 0) && (
            <div className="acct-contract-terms">
              {agreement.pricing.length > 0 && (
                <div>
                  <h4 className="acct-contract-label">Pricing</h4>
                  <div className="acct-chips">
                    {agreement.pricing.map((p) => <span className="acct-chip" key={p}>{p}</span>)}
                  </div>
                </div>
              )}
              {agreement.limits.length > 0 && (
                <div>
                  <h4 className="acct-contract-label">Order limits</h4>
                  <ul className="acct-contract-limits">
                    {agreement.limits.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <PortalOrders
        items={items}
        location={session.locationLabel}
        hasRequests={requests.length > 0}
        onOpen={(key) => { setOpenKey(key); window.scrollTo(0, 0); }}
        dispatch={dispatch}
      />
    </>
  );
}

// The portal's Orders: the account's orders and its order requests — orders over
// the buyer's limit sent to the seller for review (see orderRequestsForSession) —
// in one list, newest first, one card each (its products' images, status, number
// and total), scrolling inside the panel. An approved request waits for
// the buyer to check out from the invoice the seller sent (Awaiting checkout ·
// Complete checkout); checked out, it's an order. One the account has is that order,
// marked as approved after review. The status views
// (All, Waiting for review, Fulfilled…, each with its count) show one status.
// Clicking one opens its page (OrderDetail).
const STATUS_ORDER = ['Waiting for review', 'Awaiting checkout', 'Unfulfilled', 'Paid', 'Fulfilled', 'Declined'];
const statusRank = (status) => (STATUS_ORDER.includes(status) ? STATUS_ORDER.indexOf(status) : STATUS_ORDER.length);
// A day as a number: account orders say "Aug 28, 2026", requests 2026-08-28.
const dayValue = (s) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s).getTime() || 0;

// The orders and order requests as the portal lists them. `rows`: the products
// ({ sku, title, qty, price? }); a request from the B2B app has only a `count`.
function portalOrderItems(orders, requests) {
  const approved = new Map(requests.filter((r) => r.status === 'approved' && r.number).map((r) => [r.number, r]));
  return [
    ...orders.map((o) => ({
      key: o.id, number: o.id, title: `Order ${o.id}`, day: dayValue(o.date), date: o.date, status: o.status, tone: o.statusTone, total: o.total,
      rows: o.lines.map((l) => ({ sku: l.sku, title: l.title, qty: l.quantity, price: l.price })),
      note: approved.has(o.id) ? `Approved after review · ${requestReason(approved.get(o.id))}` : null, order: o,
    })),
    ...requests.filter((r) => !(r.status === 'approved' && orders.some((o) => o.id === r.number))).map((r) => {
      const st = REQUEST_STATUS[r.status] || REQUEST_STATUS.waiting;
      // A request sent from this storefront has its lines; one from the B2B app, a count.
      const listed = Array.isArray(r.lines);
      return {
        // Waiting for review or for checkout it's still a request; after, it has its order number.
        key: r.number || r.id, number: r.number || null, title: r.number && !['waiting', 'invoiced'].includes(r.status) ? `Order ${r.number}` : 'Order request', day: dayValue(r.date), date: requestDate(r.date), status: st.label, tone: st.tone, total: r.amount,
        rows: listed ? r.lines : null, count: listed ? null : r.lines, note: requestReason(r), order: null, request: r,
        message: r.status === 'declined' ? r.message || null : null,
        invoice: r.status === 'invoiced' ? r.number : null,
      };
    }),
  ].sort((a, b) => b.day - a.day);
}

// Approved: check out from the seller's invoice (the link in its email).
const completeCheckout = (number, dispatch) => {
  addInvoiceCheckout(number);
  dispatch({ type: 'TOAST', message: 'Order placed (demo only)' });
};

// Up to four product images, the fourth with "+N" for the rest, as on Shopify's
// order cards. A request from the B2B app has only a count: blank tiles.
function OrderImages({ rows, count }) {
  const n = rows ? rows.length : count || 0;
  const tiles = rows ? rows.map((l) => productBySku(l.sku)?.image || null) : Array.from({ length: n }, () => null);
  return (
    <div className="acct-order-images">
      {tiles.slice(0, 4).map((src, i) => (
        <span className="acct-order-image" key={i}>
          {src && <img src={src} alt="" />}
          {i === 3 && n > 4 && <span className="acct-order-image__more">{`+${n - 4}`}</span>}
        </span>
      ))}
    </div>
  );
}

function PortalOrders({ items, location, hasRequests, onOpen, dispatch }) {
  const [view, setView] = useState('all');
  // The statuses there are, in order; a view whose last order left (approved, say) falls back to All.
  const statuses = [...new Set(items.map((it) => it.status))].sort((a, b) => statusRank(a) - statusRank(b));
  const current = statuses.includes(view) ? view : 'all';
  const shown = current === 'all' ? items : items.filter((it) => it.status === current);
  const viewButton = (id, label, n) => (
    <button key={id} aria-pressed={current === id} onClick={() => setView(id)}>
      {label} <span className="acct-views-count">{n}</span>
    </button>
  );

  return (
    <section className="acct-panel">
      <div className="acct-panel-head">
        <h3>Orders</h3>
      </div>
      {items.length === 0 ? (
        <p className="muted">No orders yet. Orders placed for your account will appear here.</p>
      ) : (
        <>
          <p className="muted">
            Open an order and choose Request a quote to reuse its products in a new quote request.
            {hasRequests && ' Orders over your limit wait for the seller’s review before they’re placed.'}
          </p>
          {statuses.length > 1 && (
            <div className="acct-views" role="group" aria-label="Show orders by status">
              {viewButton('all', 'All', items.length)}
              {statuses.map((st) => viewButton(st, st, items.filter((it) => it.status === st).length))}
            </div>
          )}
          <div className="acct-order-grid">
            {shown.map((it) => (
              <article
                className="acct-order-card"
                key={it.key}
                role="button"
                tabIndex={0}
                aria-label={`Open ${it.title}`}
                onClick={() => onOpen(it.key)}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpen(it.key); }}
              >
                <OrderImages rows={it.rows} count={it.count} />
                <div className="acct-order-card__body">
                  <strong className="acct-order-card__status">{it.status}</strong>
                  <span className="muted">{`${it.number || 'Order request'} · ${money(it.total)} USD`}</span>
                  <div className="acct-order-card__foot">
                    <span className="muted">{location}</span>
                    {it.invoice && (
                      <button
                        className="acct-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          completeCheckout(it.invoice, dispatch);
                        }}
                      >
                        Complete checkout
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ── Order page ───────────────────────────────────────────────────────────────
// One order or order request, laid out like Shopify's order page: where it stands,
// its products and totals, then contact, address and payment. Before it's placed
// (waiting for review, awaiting checkout, declined) it was sent, not placed; an
// approved one is checked out here as from the invoice.
const STATUS_DETAIL = {
  'Waiting for review': 'It’s over your limit, so the seller reviews it before it’s placed. You’ll get an email when they decide.',
  'Awaiting checkout': 'The seller approved it and emailed you an invoice. Complete checkout to place the order.',
  Unfulfilled: 'We’re preparing these items for shipping.',
  Paid: 'Payment received. We’re preparing these items for shipping.',
  Fulfilled: 'All items in this order have shipped.',
  Declined: 'The seller declined it, so it wasn’t placed and you weren’t charged.',
};
const NOT_PLACED = ['Waiting for review', 'Awaiting checkout', 'Declined'];

function OrderDetail({ item, session, onBack, dispatch }) {
  const placed = !NOT_PLACED.includes(item.status);
  const toCheckout = ['Waiting for review', 'Awaiting checkout'].includes(item.status);
  const address = session.shippingAddress;
  // Why it went for review; once placed (Unfulfilled, Fulfilled) only that it was approved after review.
  const approvedAfterReview = item.request?.status === 'approved' || !!(item.order && item.note);
  const note = ['Unfulfilled', 'Fulfilled'].includes(item.status) ? (approvedAfterReview ? 'Approved after review' : null)
    : item.request?.status === 'approved' && item.note ? `Approved after review · ${item.note}` : item.note;
  const buyerNote = item.request?.note;
  return (
    <>
      <header className="order-head">
        <button className="order-back" aria-label="Back to B2B Portal" onClick={onBack}>←</button>
        <div>
          <h2>{item.title}</h2>
          <p className="muted">{`${placed ? 'Placed' : 'Sent'} ${item.date}`}</p>
        </div>
        {item.invoice && <button className="acct-btn" onClick={() => completeCheckout(item.invoice, dispatch)}>Complete checkout</button>}
      </header>

      <section className="acct-panel">
        <h3>{item.status}</h3>
        <p className="muted">{STATUS_DETAIL[item.status]}</p>
        {note && <p className="muted">{note}</p>}
        {item.message && (
          <div className="acct-order-message">
            <span className="acct-order-message-label">Message from the seller</span>
            <p>{item.message}</p>
          </div>
        )}
      </section>

      <section className="acct-panel">
        {item.rows ? (
          <div className="order-lines">
            {item.rows.map((l) => {
              const image = productBySku(l.sku)?.image;
              return (
                <div className="order-line" key={`${l.sku}-${l.title}`}>
                  <span className="order-line__media">
                    {image && <img src={image} alt="" />}
                    <span className="order-line__qty">{l.qty}</span>
                  </span>
                  <span>{l.title}</span>
                  <span>{l.price != null ? money(l.price * l.qty) : ''}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">{`${item.count} product${item.count === 1 ? '' : 's'}`}</p>
        )}
        <div className="order-totals">
          <div><span>Subtotal</span><span>{money(item.total)}</span></div>
          {toCheckout && <div><span>Shipping</span><span className="muted">Calculated at checkout</span></div>}
          {toCheckout && <div><span>Taxes</span><span className="muted">Calculated at checkout</span></div>}
          <div className="order-totals__total"><strong>Total</strong><span><small className="muted">USD</small> <strong>{money(item.total)}</strong></span></div>
        </div>
      </section>

      <section className="acct-panel order-info">
        <div><span className="muted">Contact</span><span>{session.email}</span></div>
        {address && <div><span className="muted">Ship to</span><span>{address.name}<br />{address.line}</span></div>}
        <div><span className="muted">Payment</span><span>{BUSINESS_SUMMARY.paymentTerms}</span></div>
        {buyerNote && <div><span className="muted">Your note</span><span>{buyerNote}</span></div>}
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

const requestDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
// Why a request waits: the maximum it went over, e.g. "Over your $10,000 monthly limit"
// or, for a product, "Industrial filter, XL over your maximum of 48".
const requestReason = (r) => {
  if (r.threshold == null) return null;
  if (r.item) return `${r.item} over your maximum of ${r.threshold}`;
  if (r.basis === 'qty') return `Over your ${r.threshold}-unit limit`;
  return `Over your ${money(r.threshold)}${r.period && r.period !== 'order' ? ` ${r.period}ly` : ''} limit`;
};

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
