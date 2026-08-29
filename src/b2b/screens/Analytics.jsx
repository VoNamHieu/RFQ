import React, { useState } from 'react';
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  InlineStack,
  Box,
  Select,
  Tabs,
  IndexTable,
  Badge,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { LineChart, HBarChart, Funnel, VBarChart } from '../components/charts.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (date) => MONTHS[parseInt((date || '').slice(5, 7), 10) - 1] || '';

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

function ChartCard({ title, children }) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          {title}
        </Text>
        {children}
      </BlockStack>
    </Card>
  );
}

export function Analytics() {
  const { state } = useStore();
  const companies = state.db.companies;
  const quotes = state.db.quotes || [];
  const [companyFilter, setCompanyFilter] = useState('all');
  const [period, setPeriod] = useState('90');
  const [tab, setTab] = useState(0);

  const scopedCompanies = companyFilter === 'all' ? companies : companies.filter((c) => c.id === companyFilter);
  const allOrders = scopedCompanies.flatMap((c) => (c.orders || []).map((o) => ({ ...o, companyName: c.name })));
  const scopedQuotes = companyFilter === 'all' ? quotes : quotes.filter((q) => q.company === companyFilter);

  const revenue = allOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const closed = scopedQuotes.filter((q) => q.status === 'Deal Closed').length;

  // Sales & order counts by month.
  const byMonth = {};
  allOrders.forEach((o) => {
    const m = monthLabel(o.date);
    if (!m) return;
    byMonth[m] = byMonth[m] || { revenue: 0, count: 0 };
    byMonth[m].revenue += Number(o.amount) || 0;
    byMonth[m].count += 1;
  });
  const monthOrder = MONTHS.filter((m) => byMonth[m]);
  const salesSeries = monthOrder.map((m) => ({ label: m, value: byMonth[m].revenue }));
  const orderSeries = monthOrder.map((m) => ({ label: m, value: byMonth[m].count }));

  const byCompany = companies
    .map((c) => ({ label: c.name, value: (c.orders || []).reduce((s, o) => s + (Number(o.amount) || 0), 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const funnel = [
    { label: 'Quotes submitted', value: scopedQuotes.length },
    { label: 'Reviewed', value: scopedQuotes.filter((q) => q.status !== 'New Received').length },
    { label: 'Deal closed', value: closed },
  ];

  const companyOptions = [{ label: 'All companies', value: 'all' }, ...companies.map((c) => ({ label: c.name, value: c.id }))];

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'companies', content: 'Companies' },
    { id: 'orders', content: 'Orders' },
    { id: 'quotes', content: 'Quotes' },
  ];

  return (
    <Page title="Analytics" subtitle="B2B ordering and pricing performance.">
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="300" wrap blockAlign="end">
            <div style={{ minWidth: 160 }}>
              <Select
                label="Date range"
                options={[
                  { label: 'Last 30 days', value: '30' },
                  { label: 'Last 60 days', value: '60' },
                  { label: 'Last 90 days', value: '90' },
                  { label: 'All time', value: 'all' },
                ]}
                value={period}
                onChange={setPeriod}
              />
            </div>
            <div style={{ minWidth: 200 }}>
              <Select label="Company" options={companyOptions} value={companyFilter} onChange={setCompanyFilter} />
            </div>
          </InlineStack>
        </Card>

        <Card padding="0">
          <Tabs tabs={tabs} selected={tab} onSelect={setTab} />
          <Box padding="400">
            {tab === 0 && (
              <BlockStack gap="400">
                <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                  <Scorecard label="B2B revenue" value={money(revenue)} sub={`${allOrders.length} orders`} />
                  <Scorecard label="Companies" value={String(scopedCompanies.length)} sub="Linked to B2B" />
                  <Scorecard label="Deals closed" value={String(closed)} sub={`of ${scopedQuotes.length} quotes`} />
                  <Scorecard label="Avg order" value={money(allOrders.length ? revenue / allOrders.length : 0)} sub="Per order" />
                </InlineGrid>
                <ChartCard title="Sales over time">
                  <LineChart data={salesSeries} />
                </ChartCard>
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  <ChartCard title="Revenue by company">
                    <HBarChart rows={byCompany} />
                  </ChartCard>
                  <ChartCard title="RFQ conversion">
                    <Funnel stages={funnel} />
                  </ChartCard>
                </InlineGrid>
              </BlockStack>
            )}

            {tab === 1 && (
              <BlockStack gap="400">
                <ChartCard title="Revenue by company">
                  <HBarChart rows={byCompany} />
                </ChartCard>
                <IndexTable
                  resourceName={{ singular: 'company', plural: 'companies' }}
                  itemCount={companies.length}
                  selectable={false}
                  headings={[{ title: 'Company' }, { title: 'Orders' }, { title: 'Revenue', alignment: 'end' }]}
                >
                  {companies.map((c, i) => (
                    <IndexTable.Row id={c.id} key={c.id} position={i}>
                      <IndexTable.Cell>{c.name}</IndexTable.Cell>
                      <IndexTable.Cell>{(c.orders || []).length}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" alignment="end">
                          {money((c.orders || []).reduce((s, o) => s + (Number(o.amount) || 0), 0))}
                        </Text>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </BlockStack>
            )}

            {tab === 2 && (
              <BlockStack gap="400">
                <ChartCard title="Orders by month">
                  <VBarChart data={orderSeries} />
                </ChartCard>
                <IndexTable
                  resourceName={{ singular: 'order', plural: 'orders' }}
                  itemCount={allOrders.length}
                  selectable={false}
                  headings={[{ title: 'Order' }, { title: 'Company' }, { title: 'Date' }, { title: 'Total', alignment: 'end' }]}
                >
                  {allOrders.map((o, i) => (
                    <IndexTable.Row id={`${o.id}-${i}`} key={`${o.id}-${i}`} position={i}>
                      <IndexTable.Cell>{o.id}</IndexTable.Cell>
                      <IndexTable.Cell>{o.companyName}</IndexTable.Cell>
                      <IndexTable.Cell>{o.date}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" alignment="end">
                          {money(o.amount)}
                        </Text>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </BlockStack>
            )}

            {tab === 3 && (
              <BlockStack gap="400">
                <ChartCard title="RFQ conversion">
                  <Funnel stages={funnel} />
                </ChartCard>
                <IndexTable
                  resourceName={{ singular: 'quote', plural: 'quotes' }}
                  itemCount={scopedQuotes.length}
                  selectable={false}
                  headings={[{ title: 'Quote' }, { title: 'Buyer' }, { title: 'Status' }]}
                >
                  {scopedQuotes.map((q, i) => (
                    <IndexTable.Row id={q.id} key={q.id} position={i}>
                      <IndexTable.Cell>{q.id}</IndexTable.Cell>
                      <IndexTable.Cell>{q.buyer}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={q.status === 'Deal Closed' ? 'success' : q.status === 'Deal Rejected' ? 'critical' : undefined}>
                          {q.status}
                        </Badge>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </BlockStack>
            )}
          </Box>
        </Card>
      </BlockStack>
    </Page>
  );
}
