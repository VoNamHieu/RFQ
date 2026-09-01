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
  Checkbox,
  Tabs,
  IndexTable,
  Badge,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { LineChart, RankBars, StackedBar, Funnel, FunnelV2, VBarChart, moneyShort } from '../components/charts.jsx';
import {
  analyticsApprovalQueue,
  analyticsCompanyActivation,
  analyticsQuantityEvents,
  analyticsPricingChanges,
} from '../data/analytics.js';

// Fixed demo "today" anchor for the analytics window (legacy demoToday).
const TODAY = '2026-08-24';
const COMPLETED = ['Fulfilled', 'Paid'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (d) => MONTHS[parseInt((d || '').slice(5, 7), 10) - 1] || '';
const dayMinus = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const pctDelta = (now, prev) => (prev ? Math.round(((now - prev) / prev) * 1000) / 10 : now ? 100 : 0);

function DeltaChip({ now, prev, invert = false }) {
  const d = pctDelta(now, prev);
  if (!prev && !now) return null;
  const up = d >= 0;
  const good = invert ? !up : up;
  return (
    <Text as="span" variant="bodySm" tone={good ? 'success' : 'critical'}>
      {`${up ? '▲' : '▼'} ${Math.abs(d)}% vs prev`}
    </Text>
  );
}

function Scorecard({ label, value, sub, now, prev, invert }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="span" tone="subdued" variant="bodySm">{label}</Text>
        <Text as="span" variant="headingLg">{value}</Text>
        {now != null && prev != null ? <DeltaChip now={now} prev={prev} invert={invert} /> : sub ? (
          <Text as="span" tone="subdued" variant="bodySm">{sub}</Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}

function ChartCard({ title, action, children }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">{title}</Text>
          {action}
        </InlineStack>
        {children}
      </BlockStack>
    </Card>
  );
}

export function Analytics({ embeddedCompanyId = null }) {
  const { state } = useStore();
  const companies = state.db.companies;
  const allQuotes = state.db.quotes || [];
  const [companyFilter, setCompanyFilter] = useState(embeddedCompanyId || 'all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [period, setPeriod] = useState('90');
  const [compare, setCompare] = useState(false);
  const [tab, setTab] = useState(0);

  const activeCompanyId = embeddedCompanyId || companyFilter;
  const scopedCompanies = activeCompanyId === 'all' ? companies : companies.filter((c) => c.id === activeCompanyId);
  const theCompany = activeCompanyId === 'all' ? null : companies.find((c) => c.id === activeCompanyId);

  // Period windows (selected + previous of equal length).
  const days = period === 'all' ? null : Number(period);
  const curFrom = days ? dayMinus(TODAY, days) : null;
  const prevFrom = days ? dayMinus(TODAY, days * 2) : null;
  const inCur = (d) => (!curFrom ? true : d >= curFrom && d <= TODAY);
  const inPrev = (d) => (!prevFrom ? false : d >= prevFrom && d < curFrom);

  const matchesLoc = (loc) => locationFilter === 'all' || loc === locationFilter;

  // Orders (with company name), split by window.
  const rawOrders = scopedCompanies.flatMap((c) => (c.orders || []).map((o) => ({ ...o, companyName: c.name, companyId: c.id })));
  const curOrders = rawOrders.filter((o) => matchesLoc(o.location) && inCur(o.date));
  const prevOrders = rawOrders.filter((o) => matchesLoc(o.location) && inPrev(o.date));
  const completed = (list) => list.filter((o) => COMPLETED.includes(o.status));
  const sum = (list) => list.reduce((s, o) => s + (Number(o.amount) || 0), 0);

  const curRevenue = sum(completed(curOrders));
  const prevRevenue = sum(completed(prevOrders));
  const curCount = completed(curOrders).length;
  const prevCount = completed(prevOrders).length;
  const curAov = curCount ? curRevenue / curCount : 0;
  const prevAov = prevCount ? prevRevenue / prevCount : 0;

  const scopedQuotes = allQuotes.filter(
    (q) => (activeCompanyId === 'all' || q.company === activeCompanyId) && matchesLoc(q.location),
  );

  // Sales over time — by month within the completed current orders (+ compare).
  const monthAgg = (orders) => {
    const by = {};
    completed(orders).forEach((o) => {
      const m = monthLabel(o.date);
      if (!m) return;
      by[m] = (by[m] || 0) + (Number(o.amount) || 0);
    });
    return by;
  };
  const curBy = monthAgg(curOrders);
  const prevBy = monthAgg(prevOrders);
  const monthKeys = MONTHS.filter((m) => curBy[m] != null);
  const salesSeries = monthKeys.map((m) => ({ label: m, value: curBy[m] }));
  const compareSeries = compare ? monthKeys.map((m) => ({ value: prevBy[m] || 0 })) : null;
  const orderVolume = monthKeys.map((m) => ({ label: m, value: completed(curOrders).filter((o) => monthLabel(o.date) === m).length }));

  const companyOptions = [{ label: 'All companies', value: 'all' }, ...companies.map((c) => ({ label: c.name, value: c.id }))];
  const locationOptions = theCompany
    ? [{ label: 'All locations', value: 'all' }, ...(theCompany.locations || []).map((l) => ({ label: l.name, value: l.name }))]
    : null;

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'companies', content: 'Companies' },
    { id: 'orders', content: 'Orders' },
    { id: 'quotes', content: 'Quotes' },
    { id: 'pricing', content: 'Pricing' },
  ];

  // ---- Overview data ----
  const revByCompany = companies
    .map((c) => ({
      key: c.id,
      name: c.name,
      value: sum(completed((c.orders || []).filter((o) => inCur(o.date)))),
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((r) => ({ ...r, valueLabel: money(r.value) }));

  // New vs existing revenue: a company is "new" if its first order fell in the window.
  const firstOrderById = {};
  analyticsCompanyActivation.forEach((a) => { if (a.companyId) firstOrderById[a.companyId] = a.firstOrder; });
  let newRev = 0;
  let existRev = 0;
  completed(curOrders).forEach((o) => {
    const fo = firstOrderById[o.companyId];
    if (fo && inCur(fo)) newRev += Number(o.amount) || 0;
    else existRev += Number(o.amount) || 0;
  });

  // Activation funnel (registered → approved → first order) within scope.
  const act = analyticsCompanyActivation.filter((a) => activeCompanyId === 'all' || a.companyId === activeCompanyId);
  const activationStages = [
    { name: 'Registered', count: act.length, value: `${act.length} companies` },
    { name: 'Approved', count: act.filter((a) => a.approved).length, value: `${act.filter((a) => a.approved).length} approved` },
    { name: 'First order placed', count: act.filter((a) => a.firstOrder).length, value: `${act.filter((a) => a.firstOrder).length} activated` },
  ];

  // ---- Companies tab: lifecycle / health ----
  const HEALTH = { Active: 'success', 'At risk': 'warning', Inactive: 'critical', New: 'info', Never: undefined };
  const classify = (c) => {
    const dates = (c.orders || []).filter((o) => COMPLETED.includes(o.status)).map((o) => o.date).sort();
    const last = dates[dates.length - 1];
    const fo = firstOrderById[c.id];
    if (!last) return 'Never';
    if (fo && inCur(fo)) return 'New';
    if (last >= dayMinus(TODAY, 30)) return 'Active';
    if (last >= dayMinus(TODAY, 90)) return 'At risk';
    return 'Inactive';
  };
  const healthRows = ['Active', 'At risk', 'New', 'Inactive', 'Never'].map((h) => ({
    key: h,
    name: h,
    value: companies.filter((c) => classify(c) === h).length,
    valueLabel: String(companies.filter((c) => classify(c) === h).length),
  })).filter((r) => r.value > 0);

  // ---- Orders tab: motion + relationship stacks ----
  const motion = {};
  completed(curOrders).forEach((o) => {
    const k = o.source || 'Direct checkout';
    motion[k] = (motion[k] || 0) + (Number(o.amount) || 0);
  });
  const motionSeg = Object.entries(motion).map(([name, value]) => ({ name, value }));
  const relSeg = [
    { name: 'New customers', value: newRev },
    { name: 'Returning', value: existRev },
  ];
  const approvals = analyticsApprovalQueue.filter((a) => activeCompanyId === 'all' || a.companyId === activeCompanyId);

  // ---- Quotes tab: 4-stage funnel off progress ----
  const progressHas = (needles) => scopedQuotes.filter((q) => needles.some((n) => (q.progress || '').toLowerCase().includes(n))).length;
  const quoteFunnel = [
    { label: 'RFQ received', value: scopedQuotes.length },
    { label: 'Priced', value: progressHas(['priced', 'quote', 'sent', 'order']) },
    { label: 'Sent', value: progressHas(['sent', 'order']) },
    { label: 'Order created', value: scopedQuotes.filter((q) => q.status === 'Deal Closed').length },
  ];
  const won = scopedQuotes.filter((q) => q.status === 'Deal Closed').length;
  const lost = scopedQuotes.filter((q) => q.status === 'Deal Rejected').length;
  const openQ = scopedQuotes.filter((q) => !['Deal Closed', 'Deal Rejected'].includes(q.status)).length;
  const winRate = won + lost ? Math.round((won / (won + lost)) * 100) : 0;

  // ---- Pricing tab ----
  const pchanges = analyticsPricingChanges.filter((p) => activeCompanyId === 'all' || p.companyId === activeCompanyId);
  const qevents = analyticsQuantityEvents.filter((e) => activeCompanyId === 'all' || e.companyId === activeCompanyId);
  const moqBlocked = qevents.filter((e) => e.type === 'moq_blocked');
  const tierEvents = qevents.filter((e) => e.type === 'tier_observed');
  const tierReached = tierEvents.filter((e) => e.reached).length;
  const blockedValue = moqBlocked.reduce((s, e) => s + (Number(e.attemptedValue) || 0), 0);
  const recovered = moqBlocked.filter((e) => e.laterCompleted).length;
  // Price realization: average realized price delta after the latest changes.
  const avgAfter = pchanges.length ? pchanges.reduce((s, p) => s + p.after.priceDelta, 0) / pchanges.length : 0;
  const provenance = [
    { name: 'Location price', value: sum(completed(curOrders).filter((o) => o.pricingSource === 'Location price')) },
    { name: 'Company price', value: sum(completed(curOrders).filter((o) => o.pricingSource === 'Company price')) },
    { name: 'Shopify price', value: sum(completed(curOrders).filter((o) => !o.pricingSource || o.pricingSource === 'Shopify price')) },
  ].filter((s) => s.value > 0);

  const content = (
    <BlockStack gap="400">
      {/* Filters */}
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
          {!embeddedCompanyId && (
            <div style={{ minWidth: 200 }}>
              <Select label="Company" options={companyOptions} value={companyFilter} onChange={(v) => { setCompanyFilter(v); setLocationFilter('all'); }} />
            </div>
          )}
          {locationOptions && (
            <div style={{ minWidth: 180 }}>
              <Select label="Location" options={locationOptions} value={locationFilter} onChange={setLocationFilter} />
            </div>
          )}
          <Box paddingBlockEnd="150">
            <Checkbox label="Compare to previous period" checked={compare} onChange={setCompare} disabled={period === 'all'} />
          </Box>
        </InlineStack>
      </Card>

      <Card padding="0">
        <Tabs tabs={tabs} selected={tab} onSelect={setTab} />
        <Box padding="400">
          {tab === 0 && (
            <BlockStack gap="400">
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                <Scorecard label="B2B revenue" value={money(curRevenue)} now={curRevenue} prev={compare ? prevRevenue : curRevenue} sub={`${curCount} completed orders`} />
                <Scorecard label="Completed orders" value={String(curCount)} now={curCount} prev={compare ? prevCount : curCount} sub="Fulfilled or paid" />
                <Scorecard label="Avg order value" value={money(curAov)} now={curAov} prev={compare ? prevAov : curAov} sub="Per completed order" />
                <Scorecard label="Active companies" value={String(scopedCompanies.length)} sub="In scope" />
              </InlineGrid>
              <ChartCard title="Sales over time">
                <LineChart data={salesSeries} compare={compareSeries} />
              </ChartCard>
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <ChartCard title="Revenue by company"><RankBars rows={revByCompany} /></ChartCard>
                <ChartCard title="New vs returning revenue"><StackedBar segments={relSeg} /></ChartCard>
              </InlineGrid>
              <ChartCard title="B2B activation funnel"><FunnelV2 stages={activationStages} /></ChartCard>
            </BlockStack>
          )}

          {tab === 1 && (
            <BlockStack gap="400">
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                <Scorecard label="New revenue" value={money(newRev)} sub="First order in period" />
                <Scorecard label="Returning revenue" value={money(existRev)} sub="Repeat companies" />
                <Scorecard label="Active" value={String(companies.filter((c) => classify(c) === 'Active').length)} sub="Ordered in 30 days" />
                <Scorecard label="At risk" value={String(companies.filter((c) => classify(c) === 'At risk').length)} sub="No order in 30-90 days" />
              </InlineGrid>
              <ChartCard title="Company health"><RankBars rows={healthRows} empty="No companies in scope." /></ChartCard>
              <IndexTable
                resourceName={{ singular: 'company', plural: 'companies' }}
                itemCount={scopedCompanies.length}
                selectable={false}
                headings={[{ title: 'Company' }, { title: 'Health' }, { title: 'Orders' }, { title: 'Revenue', alignment: 'end' }]}
              >
                {scopedCompanies.map((c, i) => {
                  const h = classify(c);
                  const rev = sum(completed((c.orders || []).filter((o) => inCur(o.date))));
                  return (
                    <IndexTable.Row id={c.id} key={c.id} position={i}>
                      <IndexTable.Cell>{c.name}</IndexTable.Cell>
                      <IndexTable.Cell><Badge tone={HEALTH[h]}>{h}</Badge></IndexTable.Cell>
                      <IndexTable.Cell>{completed((c.orders || []).filter((o) => inCur(o.date))).length}</IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{money(rev)}</Text></IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            </BlockStack>
          )}

          {tab === 2 && (
            <BlockStack gap="400">
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <ChartCard title="Purchasing motion"><StackedBar segments={motionSeg} /></ChartCard>
                <ChartCard title="Order volume"><VBarChart data={orderVolume} /></ChartCard>
              </InlineGrid>
              <ChartCard title={`Approval queue · ${money(approvals.reduce((s, a) => s + a.value, 0))} held`}>
                <IndexTable
                  resourceName={{ singular: 'order', plural: 'orders' }}
                  itemCount={approvals.length}
                  selectable={false}
                  headings={[{ title: 'Order' }, { title: 'Company' }, { title: 'Location' }, { title: 'Value', alignment: 'end' }, { title: 'Approver' }]}
                  emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">Nothing awaiting approval.</Text></Box>}
                >
                  {approvals.map((a, i) => (
                    <IndexTable.Row id={a.id} key={a.id} position={i}>
                      <IndexTable.Cell>{a.id}</IndexTable.Cell>
                      <IndexTable.Cell>{a.company}</IndexTable.Cell>
                      <IndexTable.Cell>{a.location}</IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{money(a.value)}</Text></IndexTable.Cell>
                      <IndexTable.Cell>{a.approver}</IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </ChartCard>
            </BlockStack>
          )}

          {tab === 3 && (
            <BlockStack gap="400">
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                <Scorecard label="Open quotes" value={String(openQ)} sub="Awaiting a decision" />
                <Scorecard label="Won" value={String(won)} sub="Deal closed" />
                <Scorecard label="Lost" value={String(lost)} sub="Deal rejected" />
                <Scorecard label="Win rate" value={`${winRate}%`} sub="Of decided quotes" />
              </InlineGrid>
              <ChartCard title="RFQ conversion funnel"><Funnel stages={quoteFunnel} /></ChartCard>
              <IndexTable
                resourceName={{ singular: 'quote', plural: 'quotes' }}
                itemCount={scopedQuotes.length}
                selectable={false}
                headings={[{ title: 'Quote' }, { title: 'Buyer' }, { title: 'Progress' }, { title: 'Status' }]}
              >
                {scopedQuotes.map((q, i) => (
                  <IndexTable.Row id={q.id} key={q.id} position={i}>
                    <IndexTable.Cell>{q.id}</IndexTable.Cell>
                    <IndexTable.Cell>{q.buyer}</IndexTable.Cell>
                    <IndexTable.Cell>{q.progress}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={q.status === 'Deal Closed' ? 'success' : q.status === 'Deal Rejected' ? 'critical' : undefined}>{q.status}</Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </BlockStack>
          )}

          {tab === 4 && (
            <BlockStack gap="400">
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                <Scorecard label="Avg price realization" value={`${avgAfter.toFixed(1)}%`} sub="Discount off Shopify after changes" />
                <Scorecard label="MOQ-blocked demand" value={money(blockedValue)} sub={`${moqBlocked.length} attempts below minimum`} />
                <Scorecard label="Recovered later" value={`${recovered}/${moqBlocked.length}`} sub="Blocked then completed" />
                <Scorecard label="Volume tiers reached" value={`${tierReached}/${tierEvents.length}`} sub="Orders hitting a break" />
              </InlineGrid>
              {provenance.length > 0 && (
                <ChartCard title="Revenue by pricing used"><StackedBar segments={provenance} /></ChartCard>
              )}
              <ChartCard title="Quantity-rule performance">
                <IndexTable
                  resourceName={{ singular: 'event', plural: 'events' }}
                  itemCount={tierEvents.length}
                  selectable={false}
                  headings={[{ title: 'Date' }, { title: 'Policy' }, { title: 'Qty / threshold' }, { title: 'Reached' }, { title: 'Discount' }]}
                  emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No quantity-tier events.</Text></Box>}
                >
                  {tierEvents.map((e, i) => (
                    <IndexTable.Row id={`t${i}`} key={i} position={i}>
                      <IndexTable.Cell>{e.date}</IndexTable.Cell>
                      <IndexTable.Cell>{e.policy}</IndexTable.Cell>
                      <IndexTable.Cell>{`${e.qty} / ${e.threshold}`}</IndexTable.Cell>
                      <IndexTable.Cell><Badge tone={e.reached ? 'success' : e.near ? 'warning' : undefined}>{e.reached ? 'Reached' : e.near ? 'Near' : 'Below'}</Badge></IndexTable.Cell>
                      <IndexTable.Cell>{e.realizedDiscount ? `${e.realizedDiscount}%` : '—'}</IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </ChartCard>
              <ChartCard title="Pricing-change outcomes">
                <IndexTable
                  resourceName={{ singular: 'change', plural: 'changes' }}
                  itemCount={pchanges.length}
                  selectable={false}
                  headings={[{ title: 'Date' }, { title: 'Scope' }, { title: 'Change' }, { title: 'Sales before → after' }, { title: 'AOV before → after' }]}
                  emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No pricing changes recorded.</Text></Box>}
                >
                  {pchanges.map((p, i) => (
                    <IndexTable.Row id={`p${i}`} key={i} position={i}>
                      <IndexTable.Cell>{p.date}</IndexTable.Cell>
                      <IndexTable.Cell>{p.scope}</IndexTable.Cell>
                      <IndexTable.Cell>{p.change}</IndexTable.Cell>
                      <IndexTable.Cell>{`${moneyShort(p.before.sales)} → ${moneyShort(p.after.sales)}`}</IndexTable.Cell>
                      <IndexTable.Cell>{`${moneyShort(p.before.aov)} → ${moneyShort(p.after.aov)}`}</IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </ChartCard>
            </BlockStack>
          )}
        </Box>
      </Card>
    </BlockStack>
  );

  if (embeddedCompanyId) return content;
  return (
    <Page title="Analytics" subtitle="B2B ordering and pricing performance.">
      {content}
    </Page>
  );
}
