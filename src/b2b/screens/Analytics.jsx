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
  Button,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { LineChart, VBarChart, StackedBar, FunnelV2, RankBars, Timeline, moneyShort } from '../components/charts.jsx';
import {
  analyticsOrderItems,
  analyticsApprovalQueue,
  analyticsCompanyActivation,
  analyticsQuantityEvents,
  analyticsPricingChanges,
} from '../data/analytics.js';

// Fixed demo anchors (legacy renderAnalytics: analyticsToday / analyticsNow).
const TODAY = new Date('2026-08-24T00:00:00');
const NOW = new Date('2026-08-24T16:43:00');
const DAY = 86400000;
const COMPLETED = new Set(['Fulfilled', 'Paid']);

// ── small numeric helpers (ported verbatim from the god file) ────────────────
const toDate = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00') : null);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const pctChange = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / DAY);
const daysAgo = (d) => (d ? Math.round((TODAY - toDate(d)) / DAY) : null);
const median = (arr) => {
  const a = arr.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const monthLabel = (d) => d.toLocaleString('en-US', { month: 'short' });
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthsBetween = (startDate, endDate) => {
  const out = [];
  const s = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), 1) : new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);
  const e = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  for (const d = new Date(s); d <= e; d.setMonth(d.getMonth() + 1)) out.push(new Date(d));
  return out;
};
const formatTypicalTime = (d) => {
  if (d == null || !Number.isFinite(d)) return '—';
  if (d < 1) return `${Math.max(1, Math.round(d * 24))}h`;
  const whole = Math.floor(d);
  const h = Math.round((d - whole) * 24);
  return h ? `${whole}d ${h}h` : `${whole}d`;
};

// ── presentational helpers ───────────────────────────────────────────────────
function DeltaChip({ v, suffix = '%' }) {
  if (v == null) return null;
  const up = v > 0;
  const down = v < 0;
  return (
    <Text as="span" variant="bodySm" tone={up ? 'success' : down ? 'critical' : 'subdued'}>
      {`${up ? '↑ ' : down ? '↓ ' : ''}${Math.abs(v)}${suffix}`}
    </Text>
  );
}

// A row of KPI scorecards (label / big value / delta+foot).
function ScoreGrid({ items }) {
  const n = items.length;
  return (
    <InlineGrid columns={{ xs: 1, sm: Math.min(n, 2), md: n }} gap="400">
      {items.map((it) => (
        <Card key={it.label}>
          <BlockStack gap="100">
            <Text as="span" tone="subdued" variant="bodySm">{it.label}</Text>
            <Text as="span" variant="headingLg">{it.value}</Text>
            {(it.delta || it.foot) && (
              <InlineStack gap="150" blockAlign="center" wrap={false}>
                {it.delta || null}
                {it.foot ? <Text as="span" tone="subdued" variant="bodySm">{it.foot}</Text> : null}
              </InlineStack>
            )}
          </BlockStack>
        </Card>
      ))}
    </InlineGrid>
  );
}

// A bordered strip of secondary metrics (legacy .analytics-mini-compare).
function MiniCompare({ items }) {
  const n = items.length;
  return (
    <Box borderColor="border" borderWidth="025" borderRadius="200" padding="300">
      <InlineGrid columns={{ xs: 1, sm: Math.min(n, 2), md: n }} gap="300">
        {items.map((it) => (
          <BlockStack gap="050" key={it.label}>
            <Text as="span" tone="subdued" variant="bodySm">{it.label}</Text>
            <Text as="span" variant="headingMd">{it.value}</Text>
            {it.sub ? <Text as="span" tone="subdued" variant="bodySm">{it.sub}</Text> : null}
          </BlockStack>
        ))}
      </InlineGrid>
    </Box>
  );
}

function ReportCard({ title, subtitle, controls, children }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="300" wrap>
          <BlockStack gap="050">
            <Text as="h3" variant="headingSm">{title}</Text>
            {subtitle ? <Text as="p" tone="subdued" variant="bodySm">{subtitle}</Text> : null}
          </BlockStack>
          {controls || null}
        </InlineStack>
        {children}
      </BlockStack>
    </Card>
  );
}

function SectionTitle({ kicker, title, subtitle }) {
  return (
    <BlockStack gap="050">
      {kicker ? <Text as="span" tone="subdued" variant="bodySm" fontWeight="medium">{kicker}</Text> : null}
      <Text as="h2" variant="headingMd">{title}</Text>
      {subtitle ? <Text as="p" tone="subdued" variant="bodySm">{subtitle}</Text> : null}
    </BlockStack>
  );
}

// Small inline share bar for the breakdown table's "Share" cell.
function ShareBar({ share }) {
  return (
    <InlineStack gap="150" blockAlign="center" wrap={false}>
      <div style={{ flex: '1 1 auto', minWidth: 56, height: 6, borderRadius: 3, background: 'var(--p-color-bg-fill-tertiary, var(--p-color-bg-surface-secondary))', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, Math.round(share || 0))}%`, height: '100%', background: 'var(--p-color-bg-fill-brand)' }} />
      </div>
      <Text as="span" variant="bodySm" tone="subdued">{Math.round(share || 0)}%</Text>
    </InlineStack>
  );
}

// Ranked-magnitude bars from god-file rankRows(rows, measure, limit).
function rankRowsFor(rows, measure, limit = 8) {
  const sorted = rows.slice().sort((a, b) => (Number(b[measure]) || 0) - (Number(a[measure]) || 0)).slice(0, limit);
  return sorted.map((r) => ({
    key: r.id || r.name,
    name: r.name,
    sub: r.sub,
    value: Number(r[measure]) || 0,
    valueLabel: measure === 'orders' ? String(r.orders || 0) : money(r.revenue || 0),
    secondary: r.share != null ? `· ${Math.round(r.share)}%` : undefined,
  }));
}

export function Analytics({ embeddedCompanyId = null }) {
  const { state } = useStore();
  const companies = state.db.companies;
  const products = state.db.products;
  const allQuotes = state.db.quotes || [];

  const [companyFilter, setCompanyFilter] = useState(embeddedCompanyId || 'all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [period, setPeriod] = useState('90'); // 30 | 60 | 90 | 9999
  const [compare, setCompare] = useState('none'); // none | previous
  const [tab, setTab] = useState(0);
  const [primaryMode, setPrimaryMode] = useState('trend'); // trend | breakdown
  const [measure, setMeasure] = useState('revenue'); // revenue | orders
  const [breakdown, setBreakdown] = useState('company'); // company | location | pricing | source

  const activeCompanyId = embeddedCompanyId || companyFilter;
  const scopedCompanies = activeCompanyId === 'all' ? companies.slice() : companies.filter((c) => c.id === activeCompanyId);
  const selected = activeCompanyId === 'all' ? null : scopedCompanies[0] || null;
  const scopedIds = new Set(scopedCompanies.map((c) => c.id));

  const productBySku = (sku) => products.find((p) => p.sku === sku);

  // ── period windows ─────────────────────────────────────────────────────────
  const periodDays = Number(period);
  const cutoff = periodDays === 9999 ? null : new Date(TODAY.getTime() - periodDays * DAY);
  const inPeriod = (d) => !cutoff || (toDate(d) && toDate(d) >= cutoff);
  const inDateRange = (d, start, end) => {
    const dt = toDate(d);
    return !!dt && (!start || dt >= start) && (!end || dt <= end);
  };
  const hasPrev = periodDays !== 9999;
  const currentPeriodStart = cutoff;
  const currentPeriodEnd = TODAY;
  const previousPeriodEnd = hasPrev ? new Date(cutoff.getTime() - DAY) : null;
  const previousPeriodStart = hasPrev ? new Date(previousPeriodEnd.getTime() - (periodDays - 1) * DAY) : null;
  const compareEnabled = compare === 'previous' && hasPrev;
  const sumRevenueInRange = (rows, start, end) => rows.filter((o) => inDateRange(o.date, start, end)).reduce((a, o) => a + (Number(o.amount) || 0), 0);

  // ── orders / quotes in scope ────────────────────────────────────────────────
  const attach = (o, c) => ({ ...o, companyId: c.id, companyName: c.name, items: analyticsOrderItems[o.id] || [] });
  let allScopedOrders = scopedCompanies.flatMap((c) => (c.orders || []).map((o) => attach(o, c))).filter((o) => COMPLETED.has(o.status));
  if (locationFilter !== 'all') allScopedOrders = allScopedOrders.filter((o) => `${o.companyId}::${o.location}` === locationFilter);
  const orders = allScopedOrders.filter((o) => inPeriod(o.date));
  const previousOrders = compareEnabled ? allScopedOrders.filter((o) => inDateRange(o.date, previousPeriodStart, previousPeriodEnd)) : [];

  let quotes = allQuotes.filter((q) => scopedIds.has(q.company) && inPeriod(q.created));
  if (locationFilter !== 'all') {
    const loc = locationFilter.split('::')[1];
    quotes = quotes.filter((q) => q.location === loc);
  }

  const sales = orders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const orderCount = orders.length;
  const aov = orderCount ? sales / orderCount : 0;
  const activeCompanyIds = new Set(orders.map((o) => o.companyId));

  // Repeat = every completed order after a company's first completed order.
  const repeatKeys = new Set();
  scopedCompanies.forEach((c) => {
    const hist = (c.orders || []).filter((o) => COMPLETED.has(o.status)).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
    hist.slice(1).forEach((o) => repeatKeys.add(`${c.id}::${o.id}`));
  });
  const isRepeat = (o) => repeatKeys.has(`${o.companyId}::${o.id}`);
  const repeatOrders = orders.filter(isRepeat);
  const repeatRevenue = repeatOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const repeatShare = sales ? Math.round((repeatRevenue / sales) * 100) : 0;

  const received = quotes.length;
  const pricedQuotes = quotes.filter((q) => (q.lines || []).some((l) => l.quoted != null) || ['Email Sent', 'PDF Exported', 'Draft Order Created', 'Auto Confirmed'].includes(q.progress));
  const sentQuotes = quotes.filter((q) => ['Email Sent', 'PDF Exported', 'Draft Order Created', 'Auto Confirmed'].includes(q.progress) || q.status === 'Deal Closed');
  const orderQuotes = quotes.filter((q) => q.progress === 'Draft Order Created' || q.progress === 'Auto Confirmed' || q.status === 'Deal Closed');
  const openQuotes = quotes.filter((q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status));
  const quoteValue = quotes.reduce((s, q) => s + (q.lines || []).reduce((n, l) => n + (Number(l.quoted) || 0) * (Number(l.qty) || 0), 0), 0);

  // First priced-response time (from the quote timeline).
  const timelineDate = (label) => {
    const m = String(label || '').match(/([A-Z][a-z]{2})\s+(\d{1,2})/);
    if (!m) return null;
    const month = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }[m[1]];
    return month == null ? null : new Date(2026, month, Number(m[2]));
  };
  const responseDays = pricedQuotes
    .map((q) => {
      const created = String(q.created || '').slice(0, 10);
      if (!created) return null;
      const first = (q.timeline || []).find((e) => /quote sent|email sent|exported as pdf|priced/i.test(String(e.what || '')));
      const d = first ? timelineDate(first.when) : null;
      if (!d) return null;
      return Math.max(0, (d - new Date(created + 'T00:00:00')) / DAY);
    })
    .filter((x) => x != null);

  // ── monthly series ──────────────────────────────────────────────────────────
  const currentMonths = monthsBetween(cutoff || new Date(TODAY.getFullYear(), TODAY.getMonth() - 3, 1), TODAY);
  const monthly = currentMonths.map((d) => {
    const key = monthKey(d);
    const os = orders.filter((o) => String(o.date || '').startsWith(key));
    const rev = os.reduce((a, o) => a + (Number(o.amount) || 0), 0);
    return { key, label: monthLabel(d), sales: rev, orders: os.length };
  });
  const previousMonthly = compareEnabled
    ? monthsBetween(previousPeriodStart, previousPeriodEnd).map((d) => {
        const key = monthKey(d);
        const os = previousOrders.filter((o) => String(o.date || '').startsWith(key));
        return { key, label: monthLabel(d), sales: os.reduce((a, o) => a + (Number(o.amount) || 0), 0), orders: os.length };
      })
    : [];
  const previousSales = previousOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const previousOrderCount = previousOrders.length;
  const previousRepeatRevenue = previousOrders.filter(isRepeat).reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const previousRepeatShare = previousSales ? (previousRepeatRevenue / previousSales) * 100 : 0;
  const salesDelta = compareEnabled && previousSales ? pctChange(sales, previousSales) : null;
  const orderDelta = compareEnabled && previousOrderCount ? pctChange(orderCount, previousOrderCount) : null;
  const aovDelta = compareEnabled && previousOrderCount ? pctChange(aov, previousSales / previousOrderCount) : null;
  const repeatDelta = compareEnabled && previousSales ? Math.round(repeatShare - previousRepeatShare) : null;

  // ── company / location rows ────────────────────────────────────────────────
  const companyRows = scopedCompanies
    .map((c) => {
      const history = (c.orders || []).map((o) => attach(o, c)).filter((o) => COMPLETED.has(o.status));
      const scopedHistory = locationFilter !== 'all' ? history.filter((o) => `${o.companyId}::${o.location}` === locationFilter) : history;
      const os = scopedHistory.filter((o) => inPeriod(o.date));
      const rev = os.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const currentRange = sumRevenueInRange(scopedHistory, currentPeriodStart, currentPeriodEnd);
      const previousRange = hasPrev ? sumRevenueInRange(scopedHistory, previousPeriodStart, previousPeriodEnd) : 0;
      const last = os.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.date || null;
      const rep = os.filter(isRepeat).reduce((a, o) => a + (Number(o.amount) || 0), 0);
      return { name: c.name, id: c.id, revenue: rev, orders: os.length, aov: os.length ? rev / os.length : 0, share: sales ? (rev / sales) * 100 : 0, growth: compareEnabled && previousRange ? pctChange(currentRange, previousRange) : null, repeat: rev ? (rep / rev) * 100 : 0, last };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const allLocationRows = scopedCompanies
    .flatMap((c) =>
      (c.locations || []).map((l) => {
        const history = (c.orders || []).map((o) => attach(o, c)).filter((o) => COMPLETED.has(o.status) && o.location === l.name);
        const scopedHistory = locationFilter !== 'all' ? history.filter((o) => `${c.id}::${o.location}` === locationFilter) : history;
        const os = scopedHistory.filter((o) => inPeriod(o.date));
        const rev = os.reduce((a, o) => a + (Number(o.amount) || 0), 0);
        const currentRange = sumRevenueInRange(scopedHistory, currentPeriodStart, currentPeriodEnd);
        const previousRange = hasPrev ? sumRevenueInRange(scopedHistory, previousPeriodStart, previousPeriodEnd) : 0;
        return { name: l.name, sub: c.name, id: `${c.id}::${l.name}`, revenue: rev, orders: os.length, aov: os.length ? rev / os.length : 0, share: sales ? (rev / sales) * 100 : 0, growth: compareEnabled && previousRange ? pctChange(currentRange, previousRange) : null };
      }),
    )
    .sort((a, b) => b.revenue - a.revenue);

  // ── product / collection ────────────────────────────────────────────────────
  const productMap = new Map();
  orders.forEach((o) =>
    (o.items || []).forEach((i) => {
      const p = productBySku(i.sku) || { sku: i.sku, title: i.sku, productType: 'Other' };
      const cur = productMap.get(i.sku) || { name: p.title, sub: p.productType, sku: i.sku, revenue: 0, orders: 0, companies: new Set() };
      cur.revenue += Number(i.revenue) || 0;
      cur.orders += 1;
      cur.companies.add(o.companyId);
      productMap.set(i.sku, cur);
    }),
  );
  const productRows = [...productMap.values()]
    .map((x) => ({ name: x.name, sub: x.sub, sku: x.sku, revenue: x.revenue, orders: x.orders, companies: x.companies.size, aov: x.orders ? x.revenue / x.orders : 0, share: sales ? (x.revenue / sales) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── pricing usage / realization ─────────────────────────────────────────────
  const referenceValueForOrder = (o) => (o.items || []).reduce((s, i) => s + (Number(productBySku(i.sku)?.list) || 0) * (Number(i.qty) || 0), 0);
  const pricingMap = new Map();
  orders.forEach((o) => {
    const k = o.pricing && o.pricing !== 'None' ? o.pricing : 'Shopify price';
    const cur = pricingMap.get(k) || { name: k, sub: o.pricingSource && o.pricingSource !== 'None' ? o.pricingSource : 'Shopify price', revenue: 0, reference: 0, orders: 0, companies: new Set(), locations: new Set() };
    cur.revenue += Number(o.amount) || 0;
    cur.reference += referenceValueForOrder(o);
    cur.orders += 1;
    cur.companies.add(o.companyId);
    cur.locations.add(`${o.companyId}::${o.location}`);
    pricingMap.set(k, cur);
  });
  const pricingUsage = [...pricingMap.values()]
    .map((x) => ({ ...x, companies: x.companies.size, locations: x.locations.size, share: sales ? (x.revenue / sales) * 100 : 0, delta: x.revenue - x.reference, deltaPct: x.reference ? ((x.revenue - x.reference) / x.reference) * 100 : null }))
    .sort((a, b) => b.revenue - a.revenue);
  const referenceValue = orders.reduce((a, o) => a + referenceValueForOrder(o), 0);
  const realizedPriceDelta = sales - referenceValue;
  const realizedPriceDeltaPct = referenceValue ? (realizedPriceDelta / referenceValue) * 100 : null;
  const influencedOrders = orders.filter((o) => o.pricingSource && !['None', 'Shopify price'].includes(o.pricingSource));
  const influencedRevenue = influencedOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const influencedShare = sales ? (influencedRevenue / sales) * 100 : 0;

  // ── purchasing motion / relationship / price sources ────────────────────────
  const sourceMap = new Map();
  orders.forEach((o) => {
    const name = String(o.source || '').toLowerCase() === 'sales-assisted' ? 'Sales-assisted' : 'Direct / self-serve';
    const cur = sourceMap.get(name) || { name, revenue: 0, orders: 0 };
    cur.revenue += Number(o.amount) || 0;
    cur.orders += 1;
    sourceMap.set(name, cur);
  });
  const orderSources = [...sourceMap.values()].map((x) => ({ ...x, share: sales ? (x.revenue / sales) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue);
  const relationshipRows = [
    { name: 'Repeat purchases', value: repeatRevenue },
    { name: 'First purchases', value: Math.max(0, sales - repeatRevenue) },
  ];
  const locationPriceRevenue = orders.filter((o) => o.pricingSource === 'Location price').reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const companyPriceRevenue = orders.filter((o) => o.pricingSource === 'Company price').reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const previousPriceRevenue = orders.filter((o) => o.pricingSource === 'Previous agreement').reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const shopifyPriceRevenue = Math.max(0, sales - locationPriceRevenue - companyPriceRevenue - previousPriceRevenue);
  const priceSources = [
    { name: 'Location price', value: locationPriceRevenue },
    { name: 'Company price', value: companyPriceRevenue },
    { name: 'Previous agreement', value: previousPriceRevenue },
    { name: 'Shopify price', value: shopifyPriceRevenue },
  ].filter((s) => s.value > 0);

  // ── quote rows / cadence ────────────────────────────────────────────────────
  const quoteVal = (q) => (q.lines || []).reduce((s, l) => s + (Number(l.quoted) || 0) * (Number(l.qty) || 0), 0);
  const quoteListVal = (q) => (q.lines || []).reduce((s, l) => s + (Number(productBySku(l.sku)?.list) || 0) * (Number(l.qty) || 0), 0);
  const quoteAge = (q) => {
    const base = String(q.updated || q.created || '').slice(0, 10);
    return base ? Math.max(0, Math.round((TODAY - new Date(base + 'T00:00:00')) / DAY)) : 0;
  };
  const companyQuoteRows = scopedCompanies
    .map((c) => {
      const qs = quotes.filter((q) => q.company === c.id);
      const oq = qs.filter((q) => q.progress === 'Draft Order Created' || q.progress === 'Auto Confirmed' || q.status === 'Deal Closed');
      const val = qs.reduce((s, q) => s + quoteVal(q), 0);
      return { name: c.name, id: c.id, rfqs: qs.length, quoted: val, conversion: qs.length ? (oq.length / qs.length) * 100 : null, open: qs.filter((q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status)).length };
    })
    .filter((x) => x.rfqs)
    .sort((a, b) => b.quoted - a.quoted);

  const companyCadence = scopedCompanies
    .map((c) => {
      const os = (c.orders || []).filter((o) => COMPLETED.has(o.status)).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const gaps = os.slice(1).map((o, i) => daysBetween(os[i].date, o.date)).filter((n) => n > 0).sort((a, b) => a - b);
      const med = gaps.length >= 3 ? (gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : Math.round((gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2)) : null;
      const first = os[0]?.date || null;
      const last = os[os.length - 1]?.date || null;
      const since = last ? daysAgo(last) : null;
      return { id: c.id, name: c.name, orders: os.length, typical: med, since, delta: med != null && since != null ? since - med : null, first, last };
    })
    .sort((a, b) => (b.delta || -999) - (a.delta || -999));

  // Health status per company (mutually exclusive lifecycle).
  const healthRows = companyCadence.map((r) => {
    const firstAge = r.first ? daysAgo(r.first) : null;
    let status = 'Inactive';
    if (r.orders === 0) status = 'Never purchased';
    else if (firstAge != null && firstAge <= 90) status = 'New';
    else if (r.typical != null) status = r.since <= Math.max(r.typical + 3, Math.round(r.typical * 1.25)) ? 'Active' : r.since <= Math.max(r.typical + 10, Math.round(r.typical * 2)) ? 'At risk' : 'Inactive';
    else status = r.since != null && r.since <= 90 ? 'Active' : 'Inactive';
    return { ...r, status };
  });
  const healthOf = (id) => healthRows.find((r) => r.id === id)?.status || 'Never purchased';
  const countStatus = (s) => healthRows.filter((r) => r.status === s).length;

  // New vs existing company revenue.
  const firstOrderByCompany = new Map(
    scopedCompanies.map((c) => {
      const ds = (c.orders || []).filter((o) => COMPLETED.has(o.status)).map((o) => String(o.date || '').slice(0, 10)).filter(Boolean).sort();
      return [c.id, ds[0] || null];
    }),
  );
  const newCompanyIds = new Set(cutoff ? [...firstOrderByCompany.entries()].filter(([, d]) => d && new Date(d + 'T00:00:00') >= cutoff).map(([id]) => id) : []);
  const newCompanyRevenue = orders.filter((o) => newCompanyIds.has(o.companyId)).reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const existingCompanyRevenue = Math.max(0, sales - newCompanyRevenue);
  const activeLocations = selected ? new Set(orders.map((o) => o.location)).size : allLocationRows.filter((r) => r.orders).length;

  // ── activation ──────────────────────────────────────────────────────────────
  let activationRows = analyticsCompanyActivation.filter((a) => inPeriod(a.registered));
  if (selected) activationRows = activationRows.filter((a) => a.companyId === selected.id);
  const activationApproved = activationRows.filter((a) => a.approved);
  const activationPurchased = activationRows.filter((a) => a.firstOrder);
  const activationRate = activationApproved.length ? Math.round((activationPurchased.length / activationApproved.length) * 100) : null;
  const activationTypical = median(activationApproved.filter((a) => a.firstOrder).map((a) => daysBetween(a.approved, a.firstOrder)));

  // ── approvals ───────────────────────────────────────────────────────────────
  const scopedApprovals = analyticsApprovalQueue.filter((a) => (activeCompanyId === 'all' || a.companyId === activeCompanyId) && (locationFilter === 'all' || `${a.companyId}::${a.location}` === locationFilter));
  const approvalValue = scopedApprovals.reduce((a, x) => a + x.value, 0);
  const approvalAgeHours = (x) => Math.max(0, (NOW - new Date(x.requestedAt)) / 3600000);
  const approvalOver48 = scopedApprovals.filter((x) => approvalAgeHours(x) > 48);
  const approvalOver48Value = approvalOver48.reduce((a, x) => a + x.value, 0);
  const approvalOldest = scopedApprovals.length ? Math.max(...scopedApprovals.map(approvalAgeHours)) : null;

  // ── quote pipeline: response / close / win / aging / discount ────────────────
  const responseMedian = median(responseDays);
  const closeDays = quotes
    .filter((q) => q.status === 'Deal Closed')
    .map((q) => {
      const c = String(q.created || '').slice(0, 10);
      const u = String(q.updated || '').slice(0, 10);
      return c && u ? Math.max(0, daysBetween(c, u)) : null;
    })
    .filter((x) => x != null);
  const closeMedian = median(closeDays);
  const wonQuotes = quotes.filter((q) => q.status === 'Deal Closed');
  const lostQuotes = quotes.filter((q) => q.status === 'Deal Rejected');
  const finalizedQuotes = [...wonQuotes, ...lostQuotes];
  const finalizedValue = finalizedQuotes.reduce((a, q) => a + quoteVal(q), 0);
  const wonValue = wonQuotes.reduce((a, q) => a + quoteVal(q), 0);
  const lostValue = lostQuotes.reduce((a, q) => a + quoteVal(q), 0);
  const winRateCount = finalizedQuotes.length ? Math.round((wonQuotes.length / finalizedQuotes.length) * 100) : null;
  const winRateValue = finalizedValue ? Math.round((wonValue / finalizedValue) * 100) : null;
  const avgWonValue = wonQuotes.length ? wonValue / wonQuotes.length : null;
  const avgLostValue = lostQuotes.length ? lostValue / lostQuotes.length : null;
  const openQuoteValue = openQuotes.reduce((a, q) => a + quoteVal(q), 0);
  const agingBuckets = [
    { name: '< 3 days', min: 0, max: 2 },
    { name: '3–7 days', min: 3, max: 7 },
    { name: '8–14 days', min: 8, max: 14 },
    { name: '15+ days', min: 15, max: 9999 },
  ].map((b) => {
    const qs = openQuotes.filter((q) => {
      const a = quoteAge(q);
      return a >= b.min && a <= b.max;
    });
    return { ...b, count: qs.length, value: qs.reduce((a, q) => a + quoteVal(q), 0) };
  });
  let listWeighted = 0;
  let quotedWeighted = 0;
  quotes.forEach((q) =>
    (q.lines || []).forEach((l) => {
      const lp = Number(productBySku(l.sku)?.list) || 0;
      const qp = Number(l.quoted);
      const qty = Number(l.qty) || 0;
      if (lp > 0 && Number.isFinite(qp) && qp > 0) {
        listWeighted += lp * qty;
        quotedWeighted += qp * qty;
      }
    }),
  );
  const avgDiscount = listWeighted ? Math.max(0, ((listWeighted - quotedWeighted) / listWeighted) * 100) : null;
  const quoteDiscountPct = (q) => {
    const list = quoteListVal(q);
    const quoted = quoteVal(q);
    return list > 0 && quoted > 0 ? Math.max(0, ((list - quoted) / list) * 100) : null;
  };
  const finalizedWithDiscount = finalizedQuotes.map((q) => ({ discount: quoteDiscountPct(q), won: q.status === 'Deal Closed' })).filter((x) => x.discount != null);
  const discountBuckets = [
    { name: '0–5% off', min: 0, max: 5 },
    { name: '5–10% off', min: 5, max: 10 },
    { name: '10–15% off', min: 10, max: 15 },
    { name: '15%+ off', min: 15, max: 999 },
  ].map((b, i) => {
    const rows = finalizedWithDiscount.filter((x) => x.discount >= b.min && (i === 0 ? x.discount <= b.max : x.discount > b.min) && x.discount <= b.max);
    const wins = rows.filter((x) => x.won).length;
    return { ...b, count: rows.length, wins, rate: rows.length ? Math.round((wins / rows.length) * 100) : null };
  });

  // ── quantity rules / pricing changes ────────────────────────────────────────
  const quantityEvents = analyticsQuantityEvents.filter((e) => inPeriod(e.date) && (activeCompanyId === 'all' || e.companyId === activeCompanyId) && (locationFilter === 'all' || `${e.companyId}::${e.location}` === locationFilter));
  const moqEvents = quantityEvents.filter((e) => e.type === 'moq_blocked');
  const moqAttempted = moqEvents.reduce((a, e) => a + e.attemptedValue, 0);
  const moqBuyers = new Set(moqEvents.map((e) => e.buyer)).size;
  const moqRecovered = moqEvents.filter((e) => e.laterCompleted).length;
  const tierEvents = quantityEvents.filter((e) => e.type === 'tier_observed');
  const tierPolicies = [...new Set(tierEvents.map((e) => e.policy))].map((name) => {
    const es = tierEvents.filter((e) => e.policy === name);
    const reached = es.filter((e) => e.reached);
    const near = es.filter((e) => e.near);
    return { name, eligible: es.length, reached: reached.length, near: near.length, revenue: reached.reduce((a, e) => a + e.orderValue, 0), discount: reached.length ? reached.reduce((a, e) => a + e.realizedDiscount, 0) / reached.length : null };
  });
  const ruleChanges = analyticsPricingChanges.filter((r) => activeCompanyId === 'all' || r.companyId === activeCompanyId);

  // ── filter option lists ─────────────────────────────────────────────────────
  const companyOptions = [{ label: 'All companies', value: 'all' }, ...companies.map((c) => ({ label: c.name, value: c.id }))];
  const locationOptions = [
    { label: 'All locations', value: 'all' },
    ...scopedCompanies.flatMap((c) => (c.locations || []).map((l) => ({ label: selected ? l.name : `${l.name} · ${c.name}`, value: `${c.id}::${l.name}` }))),
  ];
  const periodOptions = [
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 60 days', value: '60' },
    { label: 'Last 90 days', value: '90' },
    { label: 'All available', value: '9999' },
  ];
  const compareOptions = [
    { label: 'No comparison', value: 'none' },
    { label: 'Previous period', value: 'previous', disabled: periodDays === 9999 },
  ];
  const scopeText = selected ? `Filtered to ${selected.name}` : `Across ${companies.length} managed companies`;
  const showClear = selected || locationFilter !== 'all' || periodDays !== 90 || compare !== 'none';
  const clearFilters = () => {
    setCompanyFilter(embeddedCompanyId || 'all');
    setLocationFilter('all');
    setPeriod('90');
    setCompare('none');
  };

  // ── breakdown selectors (Overview primary) ──────────────────────────────────
  const allowedBreakdowns = selected ? ['location', 'pricing', 'source'] : ['company', 'location', 'pricing'];
  const activeBreakdown = allowedBreakdowns.includes(breakdown) ? breakdown : selected ? 'location' : 'company';
  const breakdownRows = activeBreakdown === 'company' ? companyRows : activeBreakdown === 'location' ? allLocationRows : activeBreakdown === 'pricing' ? pricingUsage : orderSources;
  const breakdownLabel = activeBreakdown === 'company' ? 'Company' : activeBreakdown === 'location' ? 'Location' : activeBreakdown === 'pricing' ? 'Pricing' : 'Buying motion';
  const breakdownDimOptions = allowedBreakdowns.map((k) => ({ value: k, label: k === 'company' ? 'Company' : k === 'location' ? 'Location' : k === 'pricing' ? 'Pricing' : 'Buying motion' }));

  // Clickable company cell → drill into that company.
  const CompanyLink = ({ id, children }) => (
    <button
      type="button"
      onClick={() => { setCompanyFilter(id); setLocationFilter('all'); }}
      style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--p-color-text-emphasis)', font: 'inherit', textAlign: 'left' }}
    >
      {children}
    </button>
  );

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'companies', content: 'Companies' },
    { id: 'orders', content: 'Orders' },
    { id: 'quotes', content: 'Quotes' },
    { id: 'pricing', content: 'Pricing' },
  ];

  // Reusable breakdown metric table.
  const metricTable = (rows, { entity = 'Company', clickable = false, showGrowth = true } = {}) => (
    <IndexTable
      resourceName={{ singular: entity.toLowerCase(), plural: `${entity.toLowerCase()}s` }}
      itemCount={rows.length}
      selectable={false}
      headings={[
        { title: entity },
        { title: 'Sales', alignment: 'end' },
        { title: 'Share' },
        { title: 'Orders', alignment: 'end' },
        { title: 'AOV', alignment: 'end' },
        ...(showGrowth ? [{ title: 'Vs previous period', alignment: 'end' }] : []),
      ]}
      emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No completed-order data.</Text></Box>}
    >
      {rows.map((r, i) => (
        <IndexTable.Row id={String(r.id || r.name || i)} key={r.id || r.name || i} position={i}>
          <IndexTable.Cell>{clickable && r.id ? <CompanyLink id={r.id}>{r.name}</CompanyLink> : <Text as="span">{r.name}{r.sub ? <Text as="span" tone="subdued">{` · ${r.sub}`}</Text> : null}</Text>}</IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue || 0)}</Text></IndexTable.Cell>
          <IndexTable.Cell><ShareBar share={r.share} /></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{r.orders || 0}</Text></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{money(r.aov || 0)}</Text></IndexTable.Cell>
          {showGrowth && <IndexTable.Cell><Text as="span" alignment="end">{r.growth == null ? '—' : `${r.growth > 0 ? '+' : ''}${r.growth}%`}</Text></IndexTable.Cell>}
        </IndexTable.Row>
      ))}
    </IndexTable>
  );

  // ── OVERVIEW ────────────────────────────────────────────────────────────────
  const overviewTab = (
    <BlockStack gap="400">
      <ScoreGrid
        items={[
          { label: 'B2B sales', value: money(sales), delta: <DeltaChip v={salesDelta} />, foot: compareEnabled ? 'vs previous period' : 'completed orders' },
          { label: 'Orders', value: String(orderCount), delta: <DeltaChip v={orderDelta} />, foot: compareEnabled ? 'vs previous period' : 'fulfilled or paid' },
          { label: 'Repeat revenue', value: `${repeatShare}%`, delta: <DeltaChip v={repeatDelta} suffix="pp" />, foot: money(repeatRevenue) },
          { label: selected ? 'Active locations' : 'Active companies', value: selected ? `${activeLocations} / ${selected?.locations?.length || 0}` : `${activeCompanyIds.size} / ${scopedCompanies.length}`, foot: selected ? 'locations with a completed order' : 'placed a completed order' },
        ]}
      />
      <ReportCard
        title={primaryMode === 'trend' ? 'B2B sales over time' : `${measure === 'orders' ? 'Orders' : 'Sales'} by ${breakdownLabel.toLowerCase()}`}
        subtitle={primaryMode === 'trend' ? 'Completed sales in the current scope.' : `Contribution across ${breakdownLabel.toLowerCase()}s in the current scope.`}
        controls={
          <InlineStack gap="200" blockAlign="center" wrap>
            <div style={{ display: 'inline-flex', border: '1px solid var(--p-color-border)', borderRadius: 8, overflow: 'hidden' }}>
              {[['trend', 'Over time'], ['breakdown', 'Breakdown']].map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => setPrimaryMode(m)} style={{ padding: '5px 12px', border: 0, cursor: 'pointer', font: 'inherit', background: primaryMode === m ? 'var(--p-color-bg-fill-brand)' : 'transparent', color: primaryMode === m ? 'var(--p-color-text-brand-on-bg-fill)' : 'var(--p-color-text)' }}>{lbl}</button>
              ))}
            </div>
            {primaryMode === 'breakdown' && (
              <>
                <div style={{ minWidth: 120 }}><Select label="Measure" labelHidden options={[{ label: 'Sales', value: 'revenue' }, { label: 'Orders', value: 'orders' }]} value={measure} onChange={setMeasure} /></div>
                <div style={{ minWidth: 150 }}><Select label="Breakdown" labelHidden options={breakdownDimOptions} value={activeBreakdown} onChange={setBreakdown} /></div>
              </>
            )}
          </InlineStack>
        }
      >
        {primaryMode === 'trend' ? (
          <LineChart data={monthly.map((m) => ({ label: m.label, value: m.sales }))} compare={compareEnabled ? previousMonthly.map((m) => ({ value: m.sales })) : null} />
        ) : (
          <RankBars rows={rankRowsFor(breakdownRows, measure, 8)} empty="No data in this filter." />
        )}
      </ReportCard>
      <ReportCard title={`${breakdownLabel} detail`} subtitle="Verify the distribution and drill into the underlying entities.">
        {metricTable(breakdownRows, { entity: breakdownLabel, clickable: activeBreakdown === 'company', showGrowth: compareEnabled && (activeBreakdown === 'company' || activeBreakdown === 'location') })}
      </ReportCard>
      <ReportCard title="Product performance" subtitle="Completed B2B sales contribution by product.">
        <RankBars
          rows={productRows.slice(0, 5).map((r) => ({ key: r.sku, name: r.name, sub: `${r.sub || 'Product'} · ${r.orders} orders · ${r.companies} companies`, value: r.revenue, valueLabel: money(r.revenue || 0), secondary: `· ${Math.round(r.share || 0)}%` }))}
          empty="No line-level product data."
        />
      </ReportCard>
    </BlockStack>
  );

  // ── COMPANIES ───────────────────────────────────────────────────────────────
  const companiesScores = selected
    ? [
        { label: 'Company sales', value: money(sales), foot: 'completed sales' },
        { label: 'Active locations', value: `${activeLocations} / ${selected.locations.length}`, foot: 'locations with a completed order' },
        { label: 'Repeat revenue', value: `${repeatShare}%`, foot: money(repeatRevenue) },
        { label: 'Last order', value: companyCadence[0]?.since != null ? `${companyCadence[0].since}d ago` : '—', foot: 'most recent completed purchase' },
      ]
    : [
        { label: 'Active', value: String(countStatus('Active')), foot: 'inside current buying rhythm' },
        { label: 'At risk', value: String(countStatus('At risk')), foot: 'past observed buying rhythm' },
        { label: 'Inactive', value: String(countStatus('Inactive')), foot: 'no recent purchasing activity' },
        { label: 'New', value: String(countStatus('New')), foot: 'first purchase within 90 days' },
        { label: 'Never purchased', value: String(countStatus('Never purchased')), foot: 'no completed order yet' },
      ];
  const HEALTH_TONE = { Active: 'success', 'At risk': 'warning', Inactive: 'critical', New: 'info', 'Never purchased': undefined };
  const contributionRows = (selected ? allLocationRows : companyRows).slice(0, 10).map((r) => ({ key: r.id || r.name, name: r.name, sub: r.sub, value: r.revenue, valueLabel: money(r.revenue || 0), secondary: `· ${Math.round(r.share || 0)}%` }));
  const lifecycleTotal = Math.max(1, newCompanyRevenue + existingCompanyRevenue);
  const companyPerfTable = selected ? (
    metricTable(allLocationRows, { entity: 'Location', clickable: false, showGrowth: compareEnabled })
  ) : (
    <IndexTable
      resourceName={{ singular: 'company', plural: 'companies' }}
      itemCount={companyRows.length}
      selectable={false}
      headings={[
        { title: 'Company' },
        { title: 'Sales', alignment: 'end' },
        ...(compareEnabled ? [{ title: 'Vs previous', alignment: 'end' }] : []),
        { title: 'Share' },
        { title: 'Orders', alignment: 'end' },
        { title: 'Repeat', alignment: 'end' },
        { title: 'Last order', alignment: 'end' },
        { title: 'Status' },
      ]}
    >
      {companyRows.map((r, i) => (
        <IndexTable.Row id={r.id} key={r.id} position={i}>
          <IndexTable.Cell><CompanyLink id={r.id}>{r.name}</CompanyLink></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue)}</Text></IndexTable.Cell>
          {compareEnabled && <IndexTable.Cell><Text as="span" alignment="end">{r.growth == null ? '—' : `${r.growth > 0 ? '+' : ''}${r.growth}%`}</Text></IndexTable.Cell>}
          <IndexTable.Cell><ShareBar share={r.share} /></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{r.orders}</Text></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{`${Math.round(r.repeat || 0)}%`}</Text></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{r.last ? `${daysAgo(r.last)}d ago` : '—'}</Text></IndexTable.Cell>
          <IndexTable.Cell><Badge tone={HEALTH_TONE[healthOf(r.id)]}>{healthOf(r.id)}</Badge></IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );
  const companiesTab = (
    <BlockStack gap="400">
      <SectionTitle
        kicker={selected ? 'Account analytics' : 'Portfolio analytics'}
        title={selected ? 'Company performance' : 'Company lifecycle'}
        subtitle={selected ? 'Commercial performance and purchasing activity for this company.' : 'Lifecycle counts are mutually exclusive; account-level detail remains in the performance table below.'}
      />
      <ScoreGrid items={companiesScores} />
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title={`${selected ? 'Location' : 'Company'} contribution`} subtitle={selected ? 'Share of this company’s sales by location.' : 'Share of selected-period B2B sales by company.'}>
          <RankBars rows={contributionRows} empty="No completed-order data." />
        </ReportCard>
        {selected ? (
          <ReportCard title="Company performance" subtitle="Compare location contribution in the selected period.">{companyPerfTable}</ReportCard>
        ) : (
          <ReportCard title="New vs existing company revenue" subtitle="Revenue by whether the company first purchased in the selected period.">
            <StackedBar segments={[{ name: 'Existing companies', value: existingCompanyRevenue }, { name: 'New companies', value: newCompanyRevenue }]} />
            <Box paddingBlockStart="200">
              <Text as="p" tone="subdued" variant="bodySm">{`${pct(existingCompanyRevenue, lifecycleTotal)}% from companies that purchased before this period · ${pct(newCompanyRevenue, lifecycleTotal)}% from newly activated companies.`}</Text>
            </Box>
          </ReportCard>
        )}
      </InlineGrid>
      {!selected && <ReportCard title="Company performance" subtitle="Scan account value, repeat behavior, recency and lifecycle status in one table.">{companyPerfTable}</ReportCard>}
      <ReportCard title="B2B activation" subtitle="Company application progression from registration to approval and first purchase.">
        <BlockStack gap="300">
          <FunnelV2
            stages={[
              { name: 'Registered', count: activationRows.length, value: String(activationRows.length) },
              { name: 'Approved', count: activationApproved.length, value: String(activationApproved.length), note: `· ${pct(activationApproved.length, activationRows.length)}%` },
              { name: 'Purchased', count: activationPurchased.length, value: String(activationPurchased.length), note: `· ${activationApproved.length ? pct(activationPurchased.length, activationApproved.length) : 0}% of approved` },
            ]}
          />
          <MiniCompare
            items={[
              { label: 'Approved → purchasing', value: activationRate == null ? '—' : `${activationRate}%` },
              { label: 'Typical approval → first order', value: activationTypical == null ? '—' : `${activationTypical}d` },
            ]}
          />
        </BlockStack>
      </ReportCard>
    </BlockStack>
  );

  // ── ORDERS ──────────────────────────────────────────────────────────────────
  const timelineEvents = selected
    ? orders
        .slice()
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((o, i, arr) => ({ amount: o.amount, gapLabel: i ? `${daysBetween(arr[i - 1].date, o.date)}d` : '', valueLabel: moneyShort(Number(o.amount) || 0), dateLabel: String(o.date).slice(5) }))
    : [];
  const ordersTab = (
    <BlockStack gap="400">
      <ScoreGrid
        items={[
          { label: 'Sales', value: money(sales), delta: <DeltaChip v={salesDelta} />, foot: compareEnabled ? 'vs previous period' : 'completed orders' },
          { label: 'Orders', value: String(orderCount), delta: <DeltaChip v={orderDelta} />, foot: 'fulfilled or paid' },
          { label: 'Average order', value: money(aov), delta: <DeltaChip v={aovDelta} />, foot: 'per completed order' },
          { label: 'Repeat revenue', value: `${repeatShare}%`, foot: money(repeatRevenue) },
        ]}
      />
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="Order volume over time" subtitle="Completed order count by month."><VBarChart data={monthly.map((m) => ({ label: m.label, value: m.orders }))} /></ReportCard>
        <ReportCard title="Purchasing motion" subtitle="Completed revenue by whether sales assistance was involved."><StackedBar segments={orderSources.map((s) => ({ name: s.name, value: s.revenue }))} /></ReportCard>
      </InlineGrid>
      <ReportCard title="Purchase relationship" subtitle="Completed revenue split between first and repeat purchases."><StackedBar segments={relationshipRows} /></ReportCard>
      <ReportCard title={selected ? 'Order cadence' : 'Reorder cadence by company'} subtitle={selected ? 'Intervals between this company’s completed orders.' : 'Compare account recency with each account’s established ordering rhythm. Typical reorder shows only with at least three observed intervals.'}>
        {selected ? (
          <Timeline events={timelineEvents} />
        ) : (
          <IndexTable
            resourceName={{ singular: 'company', plural: 'companies' }}
            itemCount={companyCadence.length}
            selectable={false}
            headings={[{ title: 'Company' }, { title: 'Orders', alignment: 'end' }, { title: 'Typical reorder', alignment: 'end' }, { title: 'Since last order', alignment: 'end' }]}
            emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No ordering history.</Text></Box>}
          >
            {companyCadence.map((r, i) => (
              <IndexTable.Row id={r.id} key={r.id} position={i}>
                <IndexTable.Cell><CompanyLink id={r.id}>{r.name}</CompanyLink></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.orders}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.typical == null ? '—' : `${r.typical}d`}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.since == null ? '—' : `${r.since}d`}</Text></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </ReportCard>
      <ReportCard title="Approval queue" subtitle="Open order value waiting on an internal approval decision.">
        <BlockStack gap="300">
          <MiniCompare
            items={[
              { label: 'Awaiting approval', value: money(approvalValue), sub: `${scopedApprovals.length} order${scopedApprovals.length === 1 ? '' : 's'}` },
              { label: 'Waiting > 48h', value: money(approvalOver48Value), sub: `${approvalOver48.length} order${approvalOver48.length === 1 ? '' : 's'}` },
              { label: 'Oldest waiting', value: approvalOldest == null ? '—' : `${Math.round(approvalOldest)}h` },
            ]}
          />
          <IndexTable
            resourceName={{ singular: 'order', plural: 'orders' }}
            itemCount={scopedApprovals.length}
            selectable={false}
            headings={[{ title: 'Order' }, { title: 'Company' }, { title: 'Location' }, { title: 'Value', alignment: 'end' }, { title: 'Waiting', alignment: 'end' }, { title: 'Approver' }]}
            emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No approvals waiting.</Text></Box>}
          >
            {scopedApprovals.map((a, i) => (
              <IndexTable.Row id={a.id} key={a.id} position={i}>
                <IndexTable.Cell>{a.id}</IndexTable.Cell>
                <IndexTable.Cell>{a.company}</IndexTable.Cell>
                <IndexTable.Cell>{a.location}</IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{money(a.value)}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{`${Math.round(approvalAgeHours(a))}h`}</Text></IndexTable.Cell>
                <IndexTable.Cell>{a.approver}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </ReportCard>
    </BlockStack>
  );

  // ── QUOTES ──────────────────────────────────────────────────────────────────
  const funnelStages = [
    { name: 'RFQ received', count: received },
    { name: 'Priced', count: pricedQuotes.length },
    { name: 'Sent / presented', count: sentQuotes.length },
    { name: 'Order created', count: orderQuotes.length },
  ];
  const funnelV2Stages = funnelStages.map((s, i) => ({
    name: s.name,
    count: s.count,
    value: `${s.count} · ${received ? pct(s.count, received) : 0}%`,
    note: i ? `(${funnelStages[i - 1].count ? pct(s.count, funnelStages[i - 1].count) : 0}% from prior)` : '',
  }));
  const agingMaxVal = Math.max(1, ...agingBuckets.map((x) => x.value));
  const maxDiscountRate = Math.max(1, ...discountBuckets.map((x) => x.rate || 0));
  const quotesTab = (
    <BlockStack gap="400">
      <ScoreGrid
        items={[
          { label: 'Open quote value', value: money(openQuoteValue), foot: `${openQuotes.length} quote${openQuotes.length === 1 ? '' : 's'} waiting for a decision` },
          { label: 'Typical first response', value: formatTypicalTime(responseMedian), foot: 'time to the first priced response' },
          { label: 'Typical time to close', value: formatTypicalTime(closeMedian), foot: 'RFQ received to final decision' },
        ]}
      />
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="Open quote aging" subtitle="Open quoted value grouped by time since the latest decision point.">
          <RankBars rows={agingBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} open quote${b.count === 1 ? '' : 's'}`, value: b.value, width: (b.value / agingMaxVal) * 100, valueLabel: money(b.value) }))} empty="No open quotes." />
        </ReportCard>
        <ReportCard title="Win performance" subtitle="Compare win rate by quote count and by quoted value.">
          <BlockStack gap="300">
            <RankBars
              rows={[
                { key: 'count', name: 'Quotes won', sub: `${wonQuotes.length} of ${finalizedQuotes.length} finalized quotes`, width: winRateCount || 0, valueLabel: winRateCount == null ? '—' : `${winRateCount}%` },
                { key: 'value', name: 'Quoted value won', sub: `${money(wonValue)} of ${money(finalizedValue)} finalized value`, width: winRateValue || 0, valueLabel: winRateValue == null ? '—' : `${winRateValue}%` },
              ]}
            />
            <MiniCompare items={[{ label: 'Average won quote', value: avgWonValue == null ? '—' : money(avgWonValue) }, { label: 'Average lost quote', value: avgLostValue == null ? '—' : money(avgLostValue) }]} />
          </BlockStack>
        </ReportCard>
      </InlineGrid>
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="RFQ conversion funnel" subtitle="RFQ progression from request to priced response, presentation and order."><FunnelV2 stages={funnelV2Stages} /></ReportCard>
        <ReportCard title="Discount & conversion" subtitle="Finalized quote win rate by discount band relative to Shopify list price.">
          <BlockStack gap="300">
            <MiniCompare items={[{ label: 'Average discount given', value: avgDiscount == null ? '—' : `${avgDiscount.toFixed(1)}%`, sub: 'weighted by quoted value · vs Shopify list' }]} />
            <RankBars rows={discountBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} finalized quote${b.count === 1 ? '' : 's'}`, width: b.rate == null ? 0 : (b.rate / maxDiscountRate) * 100, valueLabel: b.rate == null ? '—' : `${b.rate}%`, secondary: 'won' }))} empty="No finalized quotes." />
          </BlockStack>
        </ReportCard>
      </InlineGrid>
      {selected ? (
        <ReportCard title="Quote detail" subtitle="Underlying quote records for this company.">
          <IndexTable
            resourceName={{ singular: 'quote', plural: 'quotes' }}
            itemCount={quotes.length}
            selectable={false}
            headings={[{ title: 'Quote' }, { title: 'Location' }, { title: 'Status' }, { title: 'Age', alignment: 'end' }, { title: 'Quoted value', alignment: 'end' }]}
            emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No RFQs.</Text></Box>}
          >
            {quotes.map((q, i) => (
              <IndexTable.Row id={q.id} key={q.id} position={i}>
                <IndexTable.Cell>{q.id}</IndexTable.Cell>
                <IndexTable.Cell>{q.location || '—'}</IndexTable.Cell>
                <IndexTable.Cell><Badge tone={q.status === 'Deal Closed' ? 'success' : q.status === 'Deal Rejected' ? 'critical' : undefined}>{q.status}</Badge></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{`${quoteAge(q)}d`}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{money(quoteVal(q))}</Text></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </ReportCard>
      ) : (
        <>
          <ReportCard title="Quoted value by company" subtitle="RFQ value and conversion across accounts.">
            <RankBars rows={companyQuoteRows.map((r) => ({ key: r.id, name: r.name, sub: `${r.rfqs} RFQs · ${r.open} open`, value: r.quoted, valueLabel: money(r.quoted), secondary: `· ${r.conversion == null ? '—' : `${Math.round(r.conversion)}%`}` }))} empty="No RFQs in this scope." />
          </ReportCard>
          <ReportCard title="Company quote performance" subtitle="Volume, quoted value, conversion and open work by company.">
            <IndexTable
              resourceName={{ singular: 'company', plural: 'companies' }}
              itemCount={companyQuoteRows.length}
              selectable={false}
              headings={[{ title: 'Company' }, { title: 'RFQs', alignment: 'end' }, { title: 'Quoted value', alignment: 'end' }, { title: 'RFQ → order', alignment: 'end' }, { title: 'Open', alignment: 'end' }]}
              emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No RFQs.</Text></Box>}
            >
              {companyQuoteRows.map((r, i) => (
                <IndexTable.Row id={r.id} key={r.id} position={i}>
                  <IndexTable.Cell><CompanyLink id={r.id}>{r.name}</CompanyLink></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{r.rfqs}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{money(r.quoted)}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{r.conversion == null ? '—' : `${Math.round(r.conversion)}%`}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{r.open}</Text></IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </ReportCard>
        </>
      )}
    </BlockStack>
  );

  // ── PRICING ─────────────────────────────────────────────────────────────────
  const deltaLabel = realizedPriceDelta >= 0 ? `+${money(realizedPriceDelta)}` : `−${money(Math.abs(realizedPriceDelta))}`;
  const deltaPctLabel = realizedPriceDeltaPct == null ? '—' : `${realizedPriceDeltaPct >= 0 ? '+' : '−'}${Math.abs(realizedPriceDeltaPct).toFixed(1)}%`;
  const pricingTab = (
    <BlockStack gap="400">
      <ReportCard title="Price realization" subtitle="Reference price versus the commercial price actually realized on completed orders. The delta is a commercial price difference, not margin.">
        <MiniCompare
          items={[
            { label: 'Shopify reference value', value: money(referenceValue), sub: 'list/base price × observed quantity' },
            { label: 'Realized sales', value: money(sales), sub: 'completed order value' },
            { label: 'Realized price delta', value: deltaLabel, sub: `${deltaPctLabel} vs reference · not margin` },
            { label: 'Revenue with active pricing', value: money(influencedRevenue), sub: `${Math.round(influencedShare)}% of completed sales` },
          ]}
        />
      </ReportCard>
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="Sales by pricing" subtitle="Rank the resolved pricing actually used on completed orders."><RankBars rows={rankRowsFor(pricingUsage, 'revenue', 10)} empty="No pricing usage on completed orders." /></ReportCard>
        <ReportCard title="Pricing provenance" subtitle="Resolved commercial price source. Shopify price remains a normal source, not an error state."><StackedBar segments={priceSources} /></ReportCard>
      </InlineGrid>
      <ReportCard title="Pricing performance" subtitle="Compare sales, reference value, realized price delta and breadth of use by pricing profile.">
        <IndexTable
          resourceName={{ singular: 'pricing', plural: 'pricings' }}
          itemCount={pricingUsage.length}
          selectable={false}
          headings={[{ title: 'Pricing' }, { title: 'Source' }, { title: 'Sales', alignment: 'end' }, { title: 'Reference', alignment: 'end' }, { title: 'Realized delta', alignment: 'end' }, { title: 'Orders', alignment: 'end' }, { title: 'Companies', alignment: 'end' }, { title: 'Locations', alignment: 'end' }]}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No pricing usage on completed orders.</Text></Box>}
        >
          {pricingUsage.map((r, i) => (
            <IndexTable.Row id={r.name} key={r.name} position={i}>
              <IndexTable.Cell>{r.name}</IndexTable.Cell>
              <IndexTable.Cell>{r.sub || '—'}</IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.reference || 0)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{`${r.delta >= 0 ? '+' : '−'}${money(Math.abs(r.delta || 0))}${r.deltaPct == null ? '' : ` · ${r.deltaPct >= 0 ? '+' : '−'}${Math.abs(r.deltaPct).toFixed(1)}%`}`}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.orders}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.companies}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.locations}</Text></IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </ReportCard>
      <ReportCard title="Quantity rule performance" subtitle="Observed demand around MOQ and quantity-tier rules. Near-threshold behavior is evidence to investigate, not a recommendation.">
        <BlockStack gap="300">
          <MiniCompare
            items={[
              { label: 'MOQ-blocked attempted value', value: money(moqAttempted), sub: `${moqEvents.length} blocked attempt${moqEvents.length === 1 ? '' : 's'}` },
              { label: 'Buyers affected', value: String(moqBuyers) },
              { label: 'Later completed a purchase', value: `${moqRecovered} / ${moqEvents.length || 0}`, sub: 'observed after the blocked attempt' },
            ]}
          />
          <IndexTable
            resourceName={{ singular: 'policy', plural: 'policies' }}
            itemCount={tierPolicies.length}
            selectable={false}
            headings={[{ title: 'Quantity pricing' }, { title: 'Eligible', alignment: 'end' }, { title: 'Reached tier', alignment: 'end' }, { title: 'Near threshold', alignment: 'end' }, { title: 'Revenue at tier', alignment: 'end' }, { title: 'Realized discount', alignment: 'end' }]}
            emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No quantity-rule observations in this scope.</Text></Box>}
          >
            {tierPolicies.map((r, i) => (
              <IndexTable.Row id={r.name} key={r.name} position={i}>
                <IndexTable.Cell>{r.name}</IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.eligible}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.reached}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.near}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue)}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.discount == null ? '—' : `${r.discount.toFixed(1)}%`}</Text></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </ReportCard>
      <ReportCard title="Pricing change outcomes" subtitle="Observed commercial metrics before and after a pricing-rule edit. This is temporal comparison, not causal attribution.">
        <IndexTable
          resourceName={{ singular: 'change', plural: 'changes' }}
          itemCount={ruleChanges.length}
          selectable={false}
          headings={[{ title: 'Date' }, { title: 'Scope' }, { title: 'Rule change' }, { title: 'Sales before', alignment: 'end' }, { title: 'Sales since', alignment: 'end' }, { title: 'AOV before', alignment: 'end' }, { title: 'AOV since', alignment: 'end' }, { title: 'Δ before', alignment: 'end' }, { title: 'Δ since', alignment: 'end' }]}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No tracked pricing changes in this scope.</Text></Box>}
        >
          {ruleChanges.map((r, i) => (
            <IndexTable.Row id={`${r.date}-${i}`} key={i} position={i}>
              <IndexTable.Cell>{r.date}</IndexTable.Cell>
              <IndexTable.Cell>{r.scope}</IndexTable.Cell>
              <IndexTable.Cell><BlockStack gap="050"><Text as="span">{r.rule}</Text><Text as="span" tone="subdued" variant="bodySm">{r.change}</Text></BlockStack></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.before.sales)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.after.sales)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.before.aov)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.after.aov)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{`${r.before.priceDelta.toFixed(1)}%`}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{`${r.after.priceDelta.toFixed(1)}%`}</Text></IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </ReportCard>
    </BlockStack>
  );

  const tabContent = [overviewTab, companiesTab, ordersTab, quotesTab, pricingTab][tab];

  const content = (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <InlineStack gap="300" wrap blockAlign="end">
            <div style={{ minWidth: 150 }}><Select label="Date range" options={periodOptions} value={period} onChange={setPeriod} /></div>
            <div style={{ minWidth: 160 }}><Select label="Compare to" options={compareOptions} value={compare} onChange={setCompare} /></div>
            {!embeddedCompanyId && <div style={{ minWidth: 190 }}><Select label="Company" options={companyOptions} value={companyFilter} onChange={(v) => { setCompanyFilter(v); setLocationFilter('all'); }} /></div>}
            <div style={{ minWidth: 190 }}><Select label="Location" options={locationOptions} value={locationFilter} onChange={setLocationFilter} /></div>
          </InlineStack>
          <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
            <Text as="span" tone="subdued" variant="bodySm">{scopeText}</Text>
            {showClear && <Button variant="tertiary" onClick={clearFilters}>Clear filters</Button>}
          </InlineStack>
        </BlockStack>
      </Card>

      <Card padding="0">
        <Tabs tabs={tabs} selected={tab} onSelect={setTab} />
        <Box padding="400">{tabContent}</Box>
      </Card>
    </BlockStack>
  );

  if (embeddedCompanyId) return content;
  return (
    <Page fullWidth title="Analytics" subtitle="Explore B2B performance across companies, orders, quotes and pricing.">
      {content}
    </Page>
  );
}
