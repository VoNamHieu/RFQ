import React from 'react';
import {
  Page,
  Card,
  Layout,
  IndexTable,
  Text,
  BlockStack,
  InlineStack,
  Divider,
  Badge,
  Select,
  Box,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money, money2, subtotalOf } from '../utils.js';
import { shopifyCompanyDirectory } from '../data/companies.js';

function quoteCompanyKey(quote) {
  return (
    quote.linkedCompanyKey ||
    quote.fixedCompanyKey ||
    quote.syncedCompanyKey ||
    quote.recommendedKey ||
    quote.previewCompanyKey ||
    null
  );
}

// §5.4: the locked, read-only Customer Information card (BASIC vs COMPANY).
function CustomerCard({ quote }) {
  const customer = quote.customer || {};
  const hasCompany =
    quote.syncMode === 'fixed' ||
    quote.state === 'shopifySynced' ||
    quote.state === 'linked' ||
    !!quote.previewCompanyKey;
  const companyKey = quoteCompanyKey(quote);
  const company = companyKey ? shopifyCompanyDirectory[companyKey] : null;
  const locations = company?.locationList || (company?.locationSummary ? [company.locationSummary] : []);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          Customer
        </Text>
        <BlockStack gap="100">
          <Text as="span" tone="subdued" variant="bodySm">
            Email address
          </Text>
          <Text as="span" variant="bodyMd">
            {customer.email || 'Not provided'}
          </Text>
        </BlockStack>
        <Divider />
        {hasCompany && company ? (
          <BlockStack gap="300">
            {locations.length > 0 && (
              <Select
                label="Location"
                options={locations.map((l) => ({ label: l, value: l }))}
                value={locations[0]}
                onChange={() => {}}
              />
            )}
            <Field label="Contact person" value={customer.name} sub={customer.email} />
            <Field label="Company" value={company.name} sub={String(company.shopifyId || '')} />
            <Field label="Shipping address" value={customer.shipping} multiline />
            <Field label="Billing address" value={customer.shipping} multiline />
          </BlockStack>
        ) : (
          <BlockStack gap="300">
            <Field label="Customer" value={customer.name} sub={customer.email} />
            {customer.phone && <Field label="Phone" value={customer.phone} />}
            <Field label="Shipping address" value={customer.shipping || 'Not provided'} multiline />
          </BlockStack>
        )}
        {quote.customer?.message && (
          <>
            <Divider />
            <BlockStack gap="100">
              <Text as="span" tone="subdued" variant="bodySm">
                Message
              </Text>
              <Text as="span" variant="bodyMd">
                {quote.customer.message}
              </Text>
            </BlockStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
}

function Field({ label, value, sub, multiline }) {
  return (
    <BlockStack gap="050">
      <Text as="span" tone="subdued" variant="bodySm">
        {label}
      </Text>
      <Text as="span" variant="bodyMd">
        {multiline
          ? String(value || '')
              .split('\n')
              .map((line, i) => <div key={i}>{line}</div>)
          : value}
      </Text>
      {sub ? (
        <Text as="span" tone="subdued" variant="bodySm">
          {sub}
        </Text>
      ) : null}
    </BlockStack>
  );
}

export function QuoteDetail() {
  const { state, dispatch } = useStore();
  const quote = state.quotes[state.currentQuoteId];
  if (!quote) return null;

  const lines =
    quote.lines && quote.lines.length
      ? quote.lines
      : [
          {
            title: quote.product?.name,
            sku: quote.product?.sku,
            price: quote.product?.price,
            qty: quote.product?.quantity ?? 1,
          },
        ];
  const subtotal = subtotalOf(
    lines.map((l) => ({ price: l.price, qty: l.qty ?? l.quantity ?? 1 })),
  );

  const rows = lines.map((l, index) => {
    const qty = l.qty ?? l.quantity ?? 1;
    return (
      <IndexTable.Row id={String(index)} key={index} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {l.title || 'Custom item'}
            </Text>
            {l.sku ? (
              <Text as="span" tone="subdued" variant="bodySm">
                {l.sku}
              </Text>
            ) : null}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{qty}</IndexTable.Cell>
        <IndexTable.Cell>{money(l.price)}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end">
            {money((Number(l.price) || 0) * qty)}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      backAction={{ content: 'Submission list', onAction: () => dispatch({ type: 'NAVIGATE', view: 'submissionList' }) }}
      title={`Quote No.${quote.number}`}
      subtitle={quote.received || undefined}
      primaryAction={{ content: 'Create draft order' }}
      secondaryActions={[
        { content: 'Duplicate' },
        { content: 'More actions', disclosure: true },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card padding="0">
              <Box padding="300">
                <Text as="h2" variant="headingSm">
                  Products
                </Text>
              </Box>
              <IndexTable
                resourceName={{ singular: 'line', plural: 'lines' }}
                itemCount={rows.length}
                selectable={false}
                headings={[
                  { title: 'Product' },
                  { title: 'Quantity' },
                  { title: 'Quoted price' },
                  { title: 'Total', alignment: 'end' },
                ]}
              >
                {rows}
              </IndexTable>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">
                  Payment information
                </Text>
                <InlineStack align="space-between">
                  <Text as="span" tone="subdued">
                    Subtotal
                  </Text>
                  <Text as="span">{money2(subtotal)}</Text>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Total
                  </Text>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {money2(subtotal)}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <CustomerCard quote={quote} />
            <Card>
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">
                  B2B
                </Text>
                <Badge tone={quote.state === 'linked' || quote.state === 'shopifySynced' ? 'success' : undefined}>
                  {quote.state === 'linked' || quote.state === 'shopifySynced'
                    ? 'Managed in B2B'
                    : quote.state === 'uninstalled'
                      ? 'App not installed'
                      : 'Not in B2B yet'}
                </Badge>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
