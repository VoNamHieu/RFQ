import React from 'react';
import { Page, Card, Text, BlockStack, InlineGrid, InlineStack, Box, Divider } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money } from '../format.js';

function Scorecard({ label, value, sub }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="span" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="span" variant="headingLg">
          {value}
        </Text>
        {sub ? (
          <Text as="span" tone="subdued" variant="bodySm">
            {sub}
          </Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}

function BarList({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          {title}
        </Text>
        <BlockStack gap="200">
          {rows.map((r) => (
            <BlockStack gap="100" key={r.label}>
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm">
                  {r.label}
                </Text>
                <Text as="span" variant="bodySm" fontWeight="medium">
                  {money(r.value)}
                </Text>
              </InlineStack>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--p-color-bg-surface-secondary)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.round((r.value / max) * 100)}%`,
                    height: '100%',
                    background: 'var(--p-color-bg-fill-brand)',
                    borderRadius: 4,
                  }}
                />
              </div>
            </BlockStack>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

export function Analytics() {
  const { state } = useStore();
  const companies = state.db.companies;
  const quotes = state.db.quotes || [];

  const allOrders = companies.flatMap((c) => c.orders || []);
  const revenue = allOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const closed = quotes.filter((q) => q.status === 'Deal Closed').length;

  const byCompany = companies
    .map((c) => ({ label: c.name, value: (c.orders || []).reduce((s, o) => s + (Number(o.amount) || 0), 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <Page title="Analytics" subtitle="B2B ordering and pricing performance.">
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Scorecard label="B2B revenue" value={money(revenue)} sub="All linked companies" />
          <Scorecard label="Companies" value={String(companies.length)} sub="Linked to B2B" />
          <Scorecard label="Orders" value={String(allOrders.length)} sub="Across all companies" />
          <Scorecard label="Deals closed" value={String(closed)} sub={`of ${quotes.length} quotes`} />
        </InlineGrid>
        <BarList title="Revenue by company" rows={byCompany} />
      </BlockStack>
    </Page>
  );
}
