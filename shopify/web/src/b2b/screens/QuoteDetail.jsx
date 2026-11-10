import React from 'react';
import { useStore } from '../store.jsx';
import { money, money2 } from '../format.js';
import { resolvedPriceFor } from '../pricing.js';
import { openBuildFromQuote } from '../components/BuildFromQuotes.jsx';
import { versionFlags } from '../../shared/versions.js';
import { CdSection, StatusDot, SideBlock, SideRow, CardBanner } from '../components/companyLayout.jsx';

const STATUS_TONE = {
  'New Received': 'attention',
  Read: undefined,
  Updated: 'info',
  'Deal Closed': 'success',
  'Deal Rejected': 'critical',
  Trashed: undefined,
};

export function QuoteDetail() {
  const { state, dispatch } = useStore();
  const quote = (state.db.quotes || []).find((q) => q.id === state.selectedQuote);
  if (!quote) return null;
  const company = state.db.companies.find((c) => c.id === quote.company);
  // The quote's location (by name) — its own pricing, if any, decides the B2B price.
  const quoteLocation = (company?.locations || []).find((l) => l.name === quote.location) || null;
  const products = state.db.products;

  const lines = quote.lines || [];
  const notFullyPriced = lines.some((l) => l.quoted == null);

  // Legacy quoteTotal falls back to the Shopify list price for unpriced lines;
  // quoteListPrice is the all-Shopify baseline; the delta is suppressed unless
  // the two differ (and hidden entirely while any line is unpriced).
  const lineProduct = (l) => products.find((p) => p.sku === l.sku) || { list: 0, title: l.sku };
  const quoteTotalVal = lines.reduce((n, l) => {
    const p = lineProduct(l);
    return n + (l.quoted != null ? Number(l.quoted) : Number(p.list) || 0) * (Number(l.qty) || 0);
  }, 0);
  const listTotal = lines.reduce((n, l) => n + (Number(lineProduct(l).list) || 0) * (Number(l.qty) || 0), 0);
  const delta = !listTotal || quoteTotalVal === listTotal ? null : Math.round(((quoteTotalVal - listTotal) / listTotal) * 1000) / 10;

  const rows = lines.map((l, index) => {
    const product = lineProduct(l);
    const b2b = company ? resolvedPriceFor(company, product, state.db.policies, undefined, quoteLocation) : null;
    return (
      <tr key={index}>
        <td>
          <span className="cd-primary">{product.title || l.sku}</span>
          <span className="cd-sub">{l.sku}</span>
        </td>
        <td className="cd-num">{l.qty}</td>
        <td className="cd-num cd-nowrap cd-muted">{money(product.list)}</td>
        <td className={`cd-num cd-nowrap${b2b == null ? ' cd-muted' : ''}`}>{b2b != null ? money(b2b) : 'No pricing'}</td>
        <td className="cd-num cd-nowrap">{l.quoted != null ? <span className="cd-primary">{money(l.quoted)}</span> : <span className="cd-muted">Not priced yet</span>}</td>
        <td className="cd-num cd-nowrap">{l.quoted != null ? money(Number(l.quoted) * (Number(l.qty) || 0)) : '—'}</td>
      </tr>
    );
  });

  const secondaryActions = [{ content: 'Open in RFQ', onAction: () => dispatch({ type: 'TOAST', message: 'Opens in RFQ' }) }];
  if (quote.status === 'Deal Closed' && versionFlags().priceCrossSync) {
    secondaryActions.push({
      content: 'Turn into pricing',
      onAction: () => openBuildFromQuote(dispatch, company, state.db, quote),
    });
  }
  const back = () => dispatch({ type: 'OPEN_COMPANY', id: quote.company, tab: 'quotes' });
  const subtotal = notFullyPriced ? 'Not priced yet' : money2(quoteTotalVal);

  // The order page's layout: back (to the company's quotes) and the actions on top, then
  // two columns — the quote's products, payment, note and timeline titled above bordered
  // cards; its request details on the side.
  return (
    <div className="cd-page">
      <div className="cd-topbar">
        <button type="button" className="cd-back" onClick={back}>
          <span className="cd-back__circle">
            <s-icon type="chevron-left" />
          </span>
          {company?.name || 'Quotes'}
        </button>
        <div className="cd-list-head__actions">
          {secondaryActions.map((a) => (
            <s-button key={a.content} onClick={a.onAction}>
              {a.content}
            </s-button>
          ))}
        </div>
      </div>

      <div className="cd-layout">
        <div className="cd-main">
          <div className="cd-intro">
            <div>
              <div className="cd-inline">
                <h1 className="cd-title">{quote.id}</h1>
                <StatusDot tone={STATUS_TONE[quote.status]}>{quote.status}</StatusDot>
              </div>
              <p className="cd-subtitle">{`${company?.name || ''} · ${quote.buyer} · ${quote.email}`}</p>
            </div>
          </div>

          <CdSection title="Requested products">
            {notFullyPriced ? (
              <CardBanner tone="warning">Not fully priced yet. Some lines have no quoted price. Finish pricing before turning this into a base pricing.</CardBanner>
            ) : null}
            <div className="cd-card">
              <div className="cd-table-scroll">
                <table className="cd-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="cd-num">Qty</th>
                      <th className="cd-num">Shopify price</th>
                      <th className="cd-num">B2B price</th>
                      <th className="cd-num">Quoted price</th>
                      <th className="cd-num">Line total</th>
                    </tr>
                  </thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
            </div>
          </CdSection>

          {/* Payment information — mirrors the quote app's Payment Information card
              (subtotal, add-discount/shipping/tax/deposit, total). The add rows are demo
              placeholders here. */}
          <CdSection title="Payment information">
            <div className="cd-card">
              <div className="cd-card__body cd-lines">
                <div className="cd-line cd-line--strong">
                  <span>Subtotal</span>
                  <span>{subtotal}</span>
                </div>
                {[['Add discount', `-${money2(0)}`], ['Add shipping', money2(0)], ['Add tax', money2(0)], ['Add deposit', money2(0)]].map(([label, value]) => (
                  <div key={label} className="cd-line">
                    <span className="cd-muted">{label}</span>
                    <span className="cd-line__value">
                      <span className="cd-muted">--</span>
                      <span>{value}</span>
                    </span>
                  </div>
                ))}
                <div className="cd-line cd-line--strong cd-line--total">
                  <span>Total</span>
                  <span>{subtotal}</span>
                </div>
                {!notFullyPriced && delta != null ? <p className="cd-note cd-note--end">{`${delta}% vs Shopify price`}</p> : null}
              </div>
            </div>
          </CdSection>

          {quote.note ? (
            <CdSection title="Buyer note">
              <div className="cd-card">
                <div className="cd-card__body">{quote.note}</div>
              </div>
            </CdSection>
          ) : null}

          {quote.timeline && quote.timeline.length > 0 ? (
            <CdSection title="Timeline">
              <div className="cd-card">
                <div className="cd-card__body cd-lines">
                  {quote.timeline.map((t, i) => (
                    <div key={i} className="cd-line">
                      <span>{t.what}</span>
                      <span className="cd-muted cd-nowrap">{t.when}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CdSection>
          ) : null}
        </div>

        <div className="cd-side">
          <SideBlock title="Request details">
            <SideRow label="Created">{quote.created || '—'}</SideRow>
            <SideRow label="Progress">{quote.progress || '—'}</SideRow>
            <SideRow label="Lead score">{quote.leadScore != null ? String(quote.leadScore) : '—'}</SideRow>
            <SideRow label="Assignee">{quote.assignee || '—'}</SideRow>
            <SideRow label="Location">{quote.location || '—'}</SideRow>
            <SideRow label="Valid until">{quote.expires || '—'}</SideRow>
            <SideRow label="Source">{quote.source || '—'}</SideRow>
          </SideBlock>
        </div>
      </div>
    </div>
  );
}
