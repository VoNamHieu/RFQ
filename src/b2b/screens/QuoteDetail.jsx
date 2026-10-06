import React from 'react';
import { useStore } from '../store.jsx';
import { money, money2 } from '../format.js';
import { resolvedPriceFor } from '../pricing.js';
import { openBuildFromQuote } from '../components/BuildFromQuotes.jsx';
import { versionFlags } from '../../shared/versions.js';
import { wcTone, PageHeader } from '../../shared/wc.jsx';

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
      <s-table-row key={index}>
        <s-table-cell>
          <s-stack gap="small-500">
            <s-text fontWeight="medium">{product.title || l.sku}</s-text>
            <s-text color="subdued" fontSize="small">
              {l.sku}
            </s-text>
          </s-stack>
        </s-table-cell>
        <s-table-cell>{l.qty}</s-table-cell>
        <s-table-cell>{money(product.list)}</s-table-cell>
        <s-table-cell>{b2b != null ? money(b2b) : <s-text color="subdued">No pricing</s-text>}</s-table-cell>
        <s-table-cell>
          {l.quoted != null ? <s-text fontWeight="semibold">{money(l.quoted)}</s-text> : <s-text color="subdued">Not priced yet</s-text>}
        </s-table-cell>
        <s-table-cell>{l.quoted != null ? money(Number(l.quoted) * (Number(l.qty) || 0)) : '—'}</s-table-cell>
      </s-table-row>
    );
  });

  const secondaryActions = [{ content: 'Open in RFQ', onAction: () => dispatch({ type: 'TOAST', message: 'Opens in RFQ' }) }];
  if (quote.status === 'Deal Closed' && versionFlags().priceCrossSync) {
    secondaryActions.push({
      content: 'Turn into pricing',
      onAction: () => openBuildFromQuote(dispatch, company, state.db, quote),
    });
  }

  return (
    <>
    <PageHeader
      inlineSize="large"
      heading={quote.id}
      backAction={{
        content: 'Quotes',
        onAction: () => dispatch({ type: 'OPEN_COMPANY', id: quote.company, tab: 'quotes' }),
      }}
      subtitle={`${company?.name || ''} · ${quote.buyer} · ${quote.email}`}
      titleMetadata={<s-badge tone={wcTone(STATUS_TONE[quote.status])}>{quote.status}</s-badge>}
      secondaryActions={secondaryActions}
    />
    <s-page inlineSize="large">
      <s-stack gap="base">
        {/* Two columns (Polaris React Layout + a oneThird section). s-page only renders an
            aside at its base width, and this page is full width, so the columns are a grid. */}
        <s-query-container>
          <s-grid gridTemplateColumns="@container (inline-size > 768px) 2fr 1fr, 1fr" gap="base" alignItems="start">
            <s-stack gap="base">
              {notFullyPriced && (
                <s-banner tone="warning" heading="Not fully priced yet">
                  <s-paragraph>Some lines have no quoted price. Finish pricing before turning this into a base pricing.</s-paragraph>
                </s-banner>
              )}

              <s-section padding="none">
                <s-box padding="small">
                  <s-heading>Requested products</s-heading>
                </s-box>
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Product</s-table-header>
                    <s-table-header listSlot="labeled" format="numeric">Qty</s-table-header>
                    <s-table-header listSlot="labeled" format="currency">Shopify price</s-table-header>
                    <s-table-header listSlot="labeled" format="currency">B2B price</s-table-header>
                    <s-table-header listSlot="labeled" format="currency">Quoted price</s-table-header>
                    <s-table-header listSlot="labeled" format="currency">Line total</s-table-header>
                  </s-table-header-row>
                  <s-table-body>{rows}</s-table-body>
                </s-table>
              </s-section>

              {/* Payment information — mirrors the quote app's Payment Information card
                  (subtotal, add-discount/shipping/tax/deposit, total). Replaces the bare
                  "Quote total" line. The add rows are demo placeholders here. */}
              <s-section heading="Payment information">
                <s-box border="base" borderRadius="base" padding="small">
                  <s-stack gap="small-200">
                    <s-grid gridTemplateColumns="1fr auto" gap="small-200">
                      <s-text fontWeight="semibold">Subtotal</s-text>
                      <s-text fontWeight="semibold">{notFullyPriced ? 'Not priced yet' : money2(quoteTotalVal)}</s-text>
                    </s-grid>
                    {[['Add discount', `-${money2(0)}`], ['Add shipping', money2(0)], ['Add tax', money2(0)], ['Add deposit', money2(0)]].map(([label, value]) => (
                      <s-grid key={label} gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
                        <s-text color="subdued">{label}</s-text>
                        <s-stack direction="inline" gap="large-200" alignItems="center">
                          <s-text color="subdued" fontSize="small">
                            --
                          </s-text>
                          <div style={{ minWidth: 72, textAlign: 'end' }}>
                            <s-text>{value}</s-text>
                          </div>
                        </s-stack>
                      </s-grid>
                    ))}
                    <s-divider />
                    <s-grid gridTemplateColumns="1fr auto" gap="small-200">
                      <s-text fontWeight="semibold">Total</s-text>
                      <s-text fontWeight="semibold">{notFullyPriced ? 'Not priced yet' : money2(quoteTotalVal)}</s-text>
                    </s-grid>
                    {!notFullyPriced && delta != null && (
                      <div style={{ textAlign: 'end' }}>
                        <s-text color="subdued" fontSize="small">{`${delta}% vs Shopify price`}</s-text>
                      </div>
                    )}
                  </s-stack>
                </s-box>
              </s-section>

              {quote.note && (
                <s-section heading="Buyer note">
                  <s-paragraph>{quote.note}</s-paragraph>
                </s-section>
              )}

              {quote.timeline && quote.timeline.length > 0 && (
                <s-section heading="Timeline">
                  <s-stack gap="small-300">
                    {quote.timeline.map((t, i) => (
                      <s-grid key={i} gridTemplateColumns="1fr auto" gap="small-200">
                        <s-text fontSize="small">{t.what}</s-text>
                        <s-text color="subdued" fontSize="small">
                          {t.when}
                        </s-text>
                      </s-grid>
                    ))}
                  </s-stack>
                </s-section>
              )}
            </s-stack>
            <s-stack gap="base">
              <s-section heading="Request details">
                <s-stack gap="small">
                  <Kv label="Created" value={quote.created} />
                  <Kv label="Progress" value={quote.progress} />
                  <Kv label="Lead score" value={quote.leadScore != null ? String(quote.leadScore) : '—'} />
                  <s-divider />
                  <Kv label="Assignee" value={quote.assignee} />
                  <Kv label="Location" value={quote.location} />
                  <Kv label="Valid until" value={quote.expires} />
                  <Kv label="Source" value={quote.source} />
                </s-stack>
              </s-section>
            </s-stack>
          </s-grid>
        </s-query-container>
      </s-stack>
    </s-page>
    </>
  );
}

function Kv({ label, value }) {
  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
      <s-text color="subdued" fontSize="small">
        {label}
      </s-text>
      <s-text fontSize="small">{value || '—'}</s-text>
    </s-stack>
  );
}
