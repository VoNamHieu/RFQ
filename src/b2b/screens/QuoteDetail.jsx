import React from 'react';
import {
  Page,
  Card,
  Layout,
  IndexTable,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Box,
  Divider,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money, money2 } from '../format.js';
import { resolvedPriceFor } from '../pricing.js';
import { openBuildFromQuote } from '../components/BuildFromQuotes.jsx';
import { versionFlags } from '../../shared/versions.js';

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
    const b2b = company ? resolvedPriceFor(company, product, state.db.policies) : null;
    return (
      <IndexTable.Row id={String(index)} key={index} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {product.title || l.sku}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {l.sku}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{l.qty}</IndexTable.Cell>
        <IndexTable.Cell>{money(product.list)}</IndexTable.Cell>
        <IndexTable.Cell>{b2b != null ? money(b2b) : <Text as="span" tone="subdued">No pricing</Text>}</IndexTable.Cell>
        <IndexTable.Cell>
          {l.quoted != null ? (
            <Text as="span" fontWeight="semibold">{money(l.quoted)}</Text>
          ) : (
            <Text as="span" tone="subdued">Not priced yet</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end">
            {l.quoted != null ? money(Number(l.quoted) * (Number(l.qty) || 0)) : '—'}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const secondaryActions = [{ content: 'Open in RFQ', onAction: () => dispatch({ type: 'TOAST', message: 'Opens the RFQ app' }) }];
  if (quote.status === 'Deal Closed' && versionFlags().priceCrossSync) {
    secondaryActions.push({
      content: 'Turn into pricing',
      onAction: () => openBuildFromQuote(dispatch, company, state.db, quote),
    });
  }

  return (
    <Page
      fullWidth
      backAction={{
        content: 'Quotes',
        onAction: () => dispatch({ type: 'OPEN_COMPANY', id: quote.company, tab: 'quotes' }),
      }}
      title={quote.id}
      subtitle={`${company?.name || ''} · ${quote.buyer} · ${quote.email}`}
      titleMetadata={<Badge tone={STATUS_TONE[quote.status]}>{quote.status}</Badge>}
      secondaryActions={secondaryActions}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {notFullyPriced && (
              <Banner tone="warning" title="Not fully priced yet">
                <p>Some lines have no quoted price. Finish pricing before turning this into a base pricing.</p>
              </Banner>
            )}
            <Card padding="0">
              <Box padding="300">
                <Text as="h2" variant="headingSm">
                  Requested products
                </Text>
              </Box>
              <IndexTable
                resourceName={{ singular: 'line', plural: 'lines' }}
                itemCount={rows.length}
                selectable={false}
                headings={[
                  { title: 'Product' },
                  { title: 'Qty' },
                  { title: 'Shopify price' },
                  { title: 'B2B price' },
                  { title: 'Quoted price' },
                  { title: 'Line total', alignment: 'end' },
                ]}
              >
                {rows}
              </IndexTable>
              <Box padding="300">
                <InlineStack align="end" gap="200">
                  <Text as="span" tone="subdued">Quote total</Text>
                  {notFullyPriced ? (
                    <Text as="span" tone="subdued">Not priced yet</Text>
                  ) : (
                    <Text as="span" fontWeight="semibold">
                      {`${money2(quoteTotalVal)}${delta != null ? ` · ${delta}% vs Shopify price` : ''}`}
                    </Text>
                  )}
                </InlineStack>
              </Box>
            </Card>

            {quote.note && (
              <Card>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingSm">
                    Buyer note
                  </Text>
                  <Text as="p">{quote.note}</Text>
                </BlockStack>
              </Card>
            )}

            {quote.timeline && quote.timeline.length > 0 && (
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingSm">
                    Timeline
                  </Text>
                  <BlockStack gap="150">
                    {quote.timeline.map((t, i) => (
                      <InlineStack key={i} gap="200" align="space-between">
                        <Text as="span" variant="bodySm">
                          {t.what}
                        </Text>
                        <Text as="span" tone="subdued" variant="bodySm">
                          {t.when}
                        </Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                Request details
              </Text>
              <Kv label="Created" value={quote.created} />
              <Kv label="Progress" value={quote.progress} />
              <Kv label="Lead score" value={quote.leadScore != null ? String(quote.leadScore) : '—'} />
              <Divider />
              <Kv label="Assignee" value={quote.assignee} />
              <Kv label="Location" value={quote.location} />
              <Kv label="Valid until" value={quote.expires} />
              <Kv label="Source" value={quote.source} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Kv({ label, value }) {
  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text as="span" tone="subdued" variant="bodySm">
        {label}
      </Text>
      <Text as="span" variant="bodySm">
        {value || '—'}
      </Text>
    </InlineStack>
  );
}
