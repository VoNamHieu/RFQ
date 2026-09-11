import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  InlineStack,
  Box,
  Select,
  TextField,
  Tabs,
  IndexTable,
  Badge,
  Button,
  Tooltip,
  Icon,
} from '@shopify/polaris';
import { InfoIcon, MaximizeIcon, XIcon } from '@shopify/polaris-icons';
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

// ── Dev-only event-basis overlay (toggled by the "Inject test data" dev button) ──
// The demo seeds only a flat `order.amount` and full line items — there are no
// discounts or returns, so the PRODUCTION definitions (Net sales = gross − discounts
// − reversals; COGS reversed on returned units) can't visibly diverge from the proxy.
// This overlay injects exactly that, keyed by order id, so the divergence is
// demonstrable in dev without baking it into the default demo. It rewrites both the
// order `amount` AND the line items, so every downstream metric (Net sales, GP via
// orderCogs, Top products revenue/units, company/pricing rows, repeat, trailing-90 GP)
// picks up the event basis with no formula changes. Never applied in a prod build.
const EVENT_OVERLAY = {
  // #1039 — a $400 order-level discount: Net sales drops, GP drops by the same $400
  // (nothing returned, so COGS is unchanged). Demonstrates "− Discounts".
  '#1039': { discount: 400 },
  // #1033 — a partial return of SEA-30 (200 of 400 units, $1,250 of the $2,500 line).
  // Reverses $1,250 of sales AND 200 × $5 = $1,000 of COGS, so GP drops only $250 and
  // margin recomputes. Also drops SEA-30's Top-products revenue/units. Demonstrates
  // "− Sales reversals" + Net COGS reversal on the same event.
  '#1033': { returnSku: 'SEA-30', returnQty: 200, returnValue: 1250 },
};

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
            {it.help ? (
              <InlineStack gap="050" blockAlign="center" wrap={false}>
                <Text as="span" tone="subdued" variant="bodySm">{it.label}</Text>
                <Tooltip content={it.help} preferredPosition="above" width="wide">
                  <span style={{ display: 'inline-flex', cursor: 'help' }}><Icon source={InfoIcon} tone="subdued" /></span>
                </Tooltip>
              </InlineStack>
            ) : (
              <Text as="span" tone="subdued" variant="bodySm">{it.label}</Text>
            )}
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

// Needs-attention insight card (spec §3.4): a framing line, a big value, the
// supporting context, and a CTA that jumps to the relevant screen.
function InsightCard({ headline, value, tone, context, note, cta, onAction }) {
  return (
    <Card>
      <BlockStack gap="200">
        <BlockStack gap="050">
          <Text as="span" tone="subdued" variant="bodySm">{headline}</Text>
          <Text as="span" variant="headingLg" tone={tone}>{value}</Text>
          {context ? <Text as="p" tone="subdued" variant="bodySm">{context}</Text> : null}
        </BlockStack>
        {note ? <Text as="span" tone="subdued" variant="bodyXs">{note}</Text> : null}
        {cta ? (
          <Box>
            <Button variant="plain" onClick={onAction}>{cta}</Button>
          </Box>
        ) : null}
      </BlockStack>
    </Card>
  );
}

// Plain-language definitions of each resolved price type, surfaced as a tooltip on
// the pricing cards so merchants know what "Price created on B2B" vs "Price synced from quotes" etc. mean.
const PRICE_TYPE_DEFS = [
  ["Price created on B2B", 'A B2B pricing created directly in the app — from the company, location or catalog rules assigned to this buyer.'],
  ['Price synced from quotes', 'A B2B pricing whose origin was an accepted RFQ/quote, synced into the app and then applied to the order.'],
  ['Other price', 'A price neither created on B2B nor synced from a quote — e.g. the plain Shopify default, or a custom price keyed on the draft order.'],
  ['Manual price changes', 'A line whose price was changed by hand while the draft order was being created, overriding the pricing assigned to the company/location.'],
];
function PriceTypeHelp() {
  return (
    <Tooltip
      width="wide"
      preferredPosition="below"
      content={
        <BlockStack gap="150">
          {PRICE_TYPE_DEFS.map(([name, def]) => (
            <BlockStack gap="025" key={name}>
              <Text as="span" variant="bodySm" fontWeight="semibold">{name}</Text>
              <Text as="span" variant="bodySm" tone="subdued">{def}</Text>
            </BlockStack>
          ))}
        </BlockStack>
      }
    >
      <span style={{ display: 'inline-flex', cursor: 'help' }}>
        <Icon source={InfoIcon} tone="subdued" />
      </span>
    </Tooltip>
  );
}

// How each relationship state is defined — surfaced as a tooltip on the "Relationship
// state" card so the 5 states read as an explainable rule, not an opaque score.
// Reorder ratio = days since last order ÷ the company's own median reorder interval.
const RELATIONSHIP_STATE_DEFS = [
  ['Healthy', 'Ordering within its usual rhythm.'],
  ['Watch', 'Slightly overdue compared with its usual rhythm.'],
  ['At risk', 'Meaningfully overdue compared with its usual rhythm.'],
  ['Inactive', 'More than twice its usual reorder interval has passed since the last order.'],
  ['Insufficient history', 'Not enough order history to establish a reliable rhythm. Requires at least 4 orders.'],
];
function RelationshipStateHelp() {
  return (
    <BlockStack gap="150">
      <Text as="span" variant="bodySm">Relationship state shows whether a company is ordering on its usual schedule, based on its own order history.</Text>
      {RELATIONSHIP_STATE_DEFS.map(([name, def]) => (
        <BlockStack gap="025" key={name}>
          <Text as="span" variant="bodySm" fontWeight="semibold">{name}</Text>
          <Text as="span" variant="bodySm" tone="subdued">{def}</Text>
        </BlockStack>
      ))}
    </BlockStack>
  );
}

function ReportCard({ title, subtitle, controls, help, children }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="300" wrap>
          <BlockStack gap="050">
            <Text as="h3" variant="headingSm">{title}</Text>
            {subtitle ? <Text as="p" tone="subdued" variant="bodySm">{subtitle}</Text> : null}
          </BlockStack>
          {(controls || help) ? (
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              {controls || null}
              {help ? (
                <Tooltip content={help} preferredPosition="above" width="wide">
                  <span style={{ display: 'inline-flex', cursor: 'help' }}><Icon source={InfoIcon} tone="subdued" /></span>
                </Tooltip>
              ) : null}
            </InlineStack>
          ) : null}
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
  const [period, setPeriod] = useState('3m'); // 30d | 3m | 6m | 12m | custom
  const [compare, setCompare] = useState('none'); // none | previous
  const [customStart, setCustomStart] = useState(''); // YYYY-MM-DD (custom range)
  const [customEnd, setCustomEnd] = useState('');
  const [tab, setTab] = useState(0);
  const [primaryMode, setPrimaryMode] = useState('trend'); // trend | breakdown
  const [measure, setMeasure] = useState('revenue'); // revenue | orders
  const [showAllProducts, setShowAllProducts] = useState(false); // Overview top-products "View all"
  const [healthFilter, setHealthFilter] = useState('all'); // Companies table: relationship health
  const [lifecycleFilter, setLifecycleFilter] = useState('all'); // Companies table: lifecycle
  const [pricingFilter, setPricingFilter] = useState('all'); // Companies table: has pricing
  const [companySort, setCompanySort] = useState('default'); // Companies table sort key
  const [companyModalOpen, setCompanyModalOpen] = useState(false); // Company performance full-screen view
  const [quoteFunnelMode, setQuoteFunnelMode] = useState('count'); // Quotes funnel: count | value
  const [trendMetric, setTrendMetric] = useState('sales'); // Overview trend: sales | gp | margin
  const [advancedPipeline, setAdvancedPipeline] = useState(false); // Quotes §5.7 expander
  const [advancedPricing, setAdvancedPricing] = useState(false); // Pricing §6.5 expander
  const [marginThreshold, setMarginThreshold] = useState('20'); // §6.1 margin-exception threshold
  const [breakdown, setBreakdown] = useState('company'); // company | location | pricing | source
  const [devInject, setDevInject] = useState(false); // dev-only: inject event-basis test data (returns/discounts)

  const activeCompanyId = embeddedCompanyId || companyFilter;
  const scopedCompanies = activeCompanyId === 'all' ? companies.slice() : companies.filter((c) => c.id === activeCompanyId);
  const selected = activeCompanyId === 'all' ? null : scopedCompanies[0] || null;
  const scopedIds = new Set(scopedCompanies.map((c) => c.id));

  const productBySku = (sku) => products.find((p) => p.sku === sku);

  // ── date range (day-based; Phase 1 spec §2.1) ───────────────────────────────
  // period: '30d' | '3m' | '6m' | '12m' | 'custom'. Current window = [rangeStart,
  // rangeEnd] inclusive (ending TODAY, or the custom dates). "Compare to → Previous
  // period" is the same-length span immediately before it. PERIOD metrics filter on
  // this window (inPeriod); CURRENT SNAPSHOT metrics ignore it (see snapshotQuotes)
  // and only honour the Company / Location filter.
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  let rangeStart;
  let rangeEnd = TODAY;
  if (period === 'custom') {
    rangeStart = customStart ? startOfDay(toDate(customStart)) : addDays(TODAY, -29);
    rangeEnd = customEnd ? startOfDay(toDate(customEnd)) : TODAY;
    if (rangeEnd < rangeStart) { const t = rangeStart; rangeStart = rangeEnd; rangeEnd = t; }
  } else if (period === '30d') {
    rangeStart = addDays(TODAY, -29);
  } else {
    const m = period === '6m' ? 6 : period === '12m' ? 12 : 3;
    rangeStart = addDays(addMonths(TODAY, -m), 1);
  }
  const spanDays = Math.max(1, Math.round((rangeEnd - rangeStart) / DAY) + 1);
  const currentPeriodStart = rangeStart;
  const currentPeriodEnd = rangeEnd;
  const previousPeriodEnd = addDays(rangeStart, -1);
  const previousPeriodStart = addDays(previousPeriodEnd, -(spanDays - 1));
  const hasPrev = true; // a previous period always exists with the day-based windows
  const compareEnabled = compare === 'previous';

  const inDateRange = (d, start, end) => {
    const dt = toDate(d);
    return !!dt && (!start || dt >= start) && (!end || dt <= end);
  };
  const inPeriod = (d) => inDateRange(d, rangeStart, rangeEnd);
  const monthKeyOf = (d) => String(d || '').slice(0, 7);
  const sumRevenueInRange = (rows, start, end) => rows.filter((o) => inDateRange(o.date, start, end)).reduce((a, o) => a + (Number(o.amount) || 0), 0);

  // Trend buckets: the calendar months each window spans, so the monthly chart keeps
  // working across day-based ranges (orders are already window-filtered before use).
  const currentMonths = monthsBetween(rangeStart, rangeEnd);
  const previousMonths = compareEnabled ? monthsBetween(previousPeriodStart, previousPeriodEnd) : [];

  // ── orders / quotes in scope ────────────────────────────────────────────────
  // Dev-only: rewrite an order to its event basis (see EVENT_OVERLAY). Subtracts
  // discounts and returned value from `amount`, and shrinks the returned line's
  // qty/revenue so COGS/units follow. A no-op unless the dev toggle is on.
  const applyEventOverlay = (o) => {
    const ov = devInject ? EVENT_OVERLAY[o.id] : null;
    if (!ov) return o;
    let amount = Number(o.amount) || 0;
    let items = o.items;
    if (ov.discount) amount -= ov.discount;
    if (ov.returnValue) {
      amount -= ov.returnValue;
      items = items.map((it) =>
        it.sku === ov.returnSku
          ? { ...it, qty: Math.max(0, (Number(it.qty) || 0) - (ov.returnQty || 0)), revenue: Math.max(0, (Number(it.revenue) || 0) - ov.returnValue) }
          : it,
      );
    }
    return { ...o, amount: Math.max(0, amount), items, _event: ov };
  };
  const attach = (o, c) => applyEventOverlay({ ...o, companyId: c.id, companyName: c.name, items: analyticsOrderItems[o.id] || [] });
  let allScopedOrders = scopedCompanies.flatMap((c) => (c.orders || []).map((o) => attach(o, c))).filter((o) => COMPLETED.has(o.status));
  if (locationFilter !== 'all') allScopedOrders = allScopedOrders.filter((o) => `${o.companyId}::${o.location}` === locationFilter);
  const orders = allScopedOrders.filter((o) => inPeriod(o.date));
  const previousOrders = compareEnabled ? allScopedOrders.filter((o) => inDateRange(o.date, previousPeriodStart, previousPeriodEnd)) : [];

  let quotes = allQuotes.filter((q) => scopedIds.has(q.company) && inPeriod(q.created));
  if (locationFilter !== 'all') {
    const loc = locationFilter.split('::')[1];
    quotes = quotes.filter((q) => q.location === loc);
  }

  // Snapshot quotes: every scoped quote regardless of when it was created. Open value
  // is a current-state metric — it deliberately ignores BOTH the date range and the
  // location filter, so the card reads the same no matter how the page is scoped by
  // time/location (the microcopy on the card says so). Company scope still applies.
  const snapshotQuotes = allQuotes.filter((q) => scopedIds.has(q.company));

  const sales = orders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const orderCount = orders.length;
  const aov = orderCount ? sales / orderCount : 0;
  const activeCompanyIds = new Set(orders.map((o) => o.companyId));

  // ── gross profit / margin (spec §3.1) ───────────────────────────────────────
  // COGS = order-line qty × product unit cost (Shopify InventoryItem.unitCost).
  // When cost is unknown — a product without a cost, or an order with no line items —
  // we return null and let GP/Margin stay null instead of fabricating an estimate.
  // For a financial metric, "not available" (—) beats a guess that looks like a real
  // number, because GP/Margin flow into the Hero KPIs, product and company analytics.
  const productCost = (sku) => { const c = productBySku(sku)?.cost; return c == null ? null : (Number(c) || 0); };
  const orderCogs = (o) => {
    const items = o.items || [];
    if (!items.length) return null;
    let sum = 0;
    for (const it of items) {
      const c = productCost(it.sku);
      if (c === null) return null; // any line without a cost → whole order is uncosted
      sum += c * (Number(it.qty) || 0);
    }
    return sum;
  };
  const orderGP = (o) => { const c = orderCogs(o); return c === null ? null : (Number(o.amount) || 0) - c; };
  // GP over a set of orders, computed on the COSTED portion only — no fabricated
  // estimates. `coverage` = share of the set's sales that has cost data, so a partial
  // GP/Margin is always shown WITH how complete it is (never as if it were the full total).
  const gpStats = (os) => {
    // No orders → GP is a real $0 (nothing sold = no profit), but MARGIN is not
    // applicable (denominator 0): show "—", not "0%". A 0% margin would read as "sold
    // but made no profit"; an empty scope simply has no sales to have a margin on.
    if (!os.length) return { gp: 0, margin: null, coverage: null };
    let gp = 0, costedRev = 0, totalRev = 0, n = 0;
    for (const o of os) {
      const amt = Number(o.amount) || 0; totalRev += amt;
      const g = orderGP(o);
      if (g !== null) { gp += g; costedRev += amt; n += 1; }
    }
    return { gp: n ? gp : null, margin: n && costedRev ? (gp / costedRev) * 100 : null, coverage: totalRev ? (costedRev / totalRev) * 100 : null };
  };
  const marginOf = (gp, rev) => (gp === null ? null : rev ? (gp / rev) * 100 : 0);
  const gpAll = gpStats(orders);
  const grossProfit = gpAll.gp;
  const grossMargin = gpAll.margin;
  const costCoverage = gpAll.coverage; // % of net sales that has cost data (100 = fully costed)
  // Null-safe formatters: an unknown (uncosted) value renders as "—", never as $0 or 0%.
  const moneyN = (v) => (v == null ? '—' : money(v));
  const moneyShortN = (v) => (v == null ? '—' : moneyShort(v));
  const pctN = (v) => (v == null ? '—' : `${Math.round(v)}%`);
  const pct1N = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);
  const unitsSold = orders.reduce((a, o) => a + (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0), 0);
  const gpPrev = gpStats(previousOrders);
  const previousGrossProfit = gpPrev.gp;
  const previousSalesGP = previousOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const previousGrossMargin = gpPrev.margin;
  const gpDelta = compareEnabled && grossProfit !== null && previousGrossProfit ? pctChange(grossProfit, previousGrossProfit) : null;
  const marginDelta = compareEnabled && grossMargin !== null && previousGrossMargin !== null && previousSalesGP ? Math.round((grossMargin - previousGrossMargin) * 10) / 10 : null; // pp

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
  // Open quotes = a current snapshot: all scoped open quotes, not just those created
  // in the date window (a quote opened 5 months ago but still open must appear).
  const openQuotes = snapshotQuotes.filter((q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status));
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
  // hasPrev → the fixed N-month window (from the period block); all-time → every
  // month back to the earliest order in scope.
  const trendMonths = currentMonths || monthsBetween(
    orders.reduce((min, o) => { const dt = toDate(o.date); return dt && (!min || dt < min) ? dt : min; }, null) || new Date(TODAY.getFullYear(), TODAY.getMonth() - 3, 1),
    TODAY,
  );
  const monthly = trendMonths.map((d) => {
    const key = monthKey(d);
    const os = orders.filter((o) => String(o.date || '').startsWith(key));
    const rev = os.reduce((a, o) => a + (Number(o.amount) || 0), 0);
    return { key, label: monthLabel(d), sales: rev, orders: os.length };
  });
  const previousMonthly = compareEnabled
    ? previousMonths.map((d) => {
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
      const st = gpStats(os);
      return { name: c.name, id: c.id, revenue: rev, orders: os.length, aov: os.length ? rev / os.length : 0, share: sales ? (rev / sales) * 100 : 0, growth: compareEnabled && previousRange ? pctChange(currentRange, previousRange) : null, repeat: rev ? (rep / rev) * 100 : 0, last, gp: st.gp, margin: st.margin, coverage: st.coverage };
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
      const cur = productMap.get(i.sku) || { name: p.title, sub: p.productType, sku: i.sku, revenue: 0, cogs: 0, costKnown: true, units: 0, orderIds: new Set(), companies: new Set() };
      cur.revenue += Number(i.revenue) || 0;
      { const c = productCost(i.sku); if (c === null) cur.costKnown = false; else cur.cogs += c * (Number(i.qty) || 0); }
      cur.units += Number(i.qty) || 0;
      cur.orderIds.add(o.id); // distinct orders, not line items — a SKU twice in one order counts once
      cur.companies.add(o.companyId);
      productMap.set(i.sku, cur);
    }),
  );
  const productRows = [...productMap.values()]
    .map((x) => { const gp = x.costKnown ? x.revenue - x.cogs : null; const orders = x.orderIds.size; return { name: x.name, sub: x.sub, sku: x.sku, revenue: x.revenue, units: x.units, orders, companies: x.companies.size, gp, margin: marginOf(gp, x.revenue), aov: orders ? x.revenue / orders : 0, share: sales ? (x.revenue / sales) * 100 : 0 }; })
    .sort((a, b) => b.revenue - a.revenue);

  // ── pricing usage / realization ─────────────────────────────────────────────
  const referenceValueForOrder = (o) => (o.items || []).reduce((s, i) => s + (Number(productBySku(i.sku)?.list) || 0) * (Number(i.qty) || 0), 0);
  const pricingMap = new Map();
  orders.forEach((o) => {
    const srcLabel = o.pricingSource === 'Company price' || o.pricingSource === 'Location price' ? "Price created on B2B" : o.pricingSource === 'Previous agreement' ? 'Price synced from quotes' : 'Other price';
    // A named pricing profile groups by its own name; an order with no profile
    // (Shopify default or a manual price) groups under its price source instead.
    const k = o.pricing && o.pricing !== 'None' ? o.pricing : srcLabel;
    const cur = pricingMap.get(k) || { name: k, sub: srcLabel, revenue: 0, reference: 0, gp: 0, costedRev: 0, costedN: 0, orders: 0, companies: new Set(), locations: new Set() };
    cur.revenue += Number(o.amount) || 0;
    cur.reference += referenceValueForOrder(o);
    { const g = orderGP(o); if (g !== null) { cur.gp += g; cur.costedRev += (Number(o.amount) || 0); cur.costedN += 1; } }
    cur.orders += 1;
    cur.companies.add(o.companyId);
    cur.locations.add(`${o.companyId}::${o.location}`);
    pricingMap.set(k, cur);
  });
  // §6.1 line-level economics: manual overrides + margin exceptions. A line is
  // "eligible" when a B2B pricing resolved it (not the Shopify default).
  const orderLines = orders.flatMap((o) => (o.items || []).map((it) => ({ ...it, order: o })));
  const isB2BLine = (l) => ['Location price', 'Company price', 'Previous agreement'].includes(l.order.pricingSource);
  const eligibleLines = orderLines.filter(isB2BLine);
  const overriddenLines = eligibleLines.filter((l) => l.overridden);
  const overrideRate = eligibleLines.length ? (overriddenLines.length / eligibleLines.length) * 100 : 0;
  const overrideByPricing = new Map();
  orderLines.forEach((l) => {
    if (!isB2BLine(l)) return;
    const k = l.order.pricing && l.order.pricing !== 'None' ? l.order.pricing : 'Shopify price';
    const cur = overrideByPricing.get(k) || { eligible: 0, overridden: 0 };
    cur.eligible += 1;
    if (l.overridden) cur.overridden += 1;
    overrideByPricing.set(k, cur);
  });

  const pricingUsage = [...pricingMap.values()]
    .map((x) => {
      const ov = overrideByPricing.get(x.name);
      const gp = x.costedN ? x.gp : null;
      return { ...x, companies: x.companies.size, locations: x.locations.size, share: sales ? (x.revenue / sales) * 100 : 0, gp, margin: x.costedN && x.costedRev ? (x.gp / x.costedRev) * 100 : null, overrideRate: ov && ov.eligible ? (ov.overridden / ov.eligible) * 100 : null, delta: x.revenue - x.reference, deltaPct: x.reference ? ((x.revenue - x.reference) / x.reference) * 100 : null };
    })
    .sort((a, b) => (b.gp ?? -Infinity) - (a.gp ?? -Infinity));
  const referenceValue = orders.reduce((a, o) => a + referenceValueForOrder(o), 0);
  const realizedPriceDelta = sales - referenceValue;
  const realizedPriceDeltaPct = referenceValue ? (realizedPriceDelta / referenceValue) * 100 : null;
  // "Negotiated" = the app resolved it (company/location) or it came from a quote —
  // not a manual custom price or the plain Shopify default.
  const influencedOrders = orders.filter((o) => ['Company price', 'Location price', 'Previous agreement'].includes(o.pricingSource));
  const influencedRevenue = influencedOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const influencedShare = sales ? (influencedRevenue / sales) * 100 : 0;

  // §6.1 margin exceptions — lines below a configurable minimum margin (exceptions,
  // not averages). §6.2 baseline pricing footprint.
  const lineMargin = (l) => { const c = productCost(l.sku); if (c === null) return null; const rev = Number(l.revenue) || 0; return rev ? ((rev - c * (Number(l.qty) || 0)) / rev) * 100 : 0; };
  const marginFloor = Number(marginThreshold) || 20;
  // Only flag a line as below-threshold when its margin is actually known.
  const marginExceptionLines = orderLines.filter((l) => { const m = lineMargin(l); return m !== null && m < marginFloor; });
  const marginExceptionSales = marginExceptionLines.reduce((a, l) => a + (Number(l.revenue) || 0), 0);
  const hasPricingFn = (c) => (c?.pricing?.base?.length > 0) || !!c?.pricing?.quantity;
  const activePolicyCount = (state.db.policies || []).filter((p) => p.status !== 'Inactive' && p.audienceType === 'b2b').length;
  const companiesWithPricing = scopedCompanies.filter(hasPricingFn).length;
  const locationsCovered = scopedCompanies.filter(hasPricingFn).reduce((a, c) => a + (c.locations?.length || 0), 0);

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
  // Price sources (§6). "Price created on B2B" is a B2B pricing authored directly in the
  // app (company/location/catalog rules) — location pricing isn't separated yet, so a
  // resolved "Location price" folds into it. "Price synced from quotes" is a B2B pricing
  // whose origin was an accepted quote (pricingSource "Previous agreement"). "Other price"
  // is the residual: neither created on B2B nor synced from a quote — the plain Shopify
  // default, a custom price keyed on the draft order, or one whose source no longer resolves.
  const isCompanyPriced = (o) => o.pricingSource === 'Company price' || o.pricingSource === 'Location price';
  const companyPriceRevenue = orders.filter(isCompanyPriced).reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const previousPriceRevenue = orders.filter((o) => o.pricingSource === 'Previous agreement').reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const otherPriceRevenue = Math.max(0, sales - companyPriceRevenue - previousPriceRevenue);
  const isOtherPriced = (o) => !['Company price', 'Location price', 'Previous agreement'].includes(o.pricingSource);
  // Margin economics per resolved price source (§6): what each pricing path actually earns.
  const priceSourceRows = [
    { name: "Price created on B2B", match: isCompanyPriced },
    { name: 'Price synced from quotes', match: (o) => o.pricingSource === 'Previous agreement' },
    { name: 'Other price', match: isOtherPriced },
  ]
    .map((s) => {
      const os = orders.filter(s.match);
      const rev = os.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const st = gpStats(os);
      return { name: s.name, revenue: rev, gp: st.gp, margin: st.margin, share: sales ? (rev / sales) * 100 : 0 };
    })
    .filter((s) => s.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const priceSourceMaxMargin = Math.max(1, ...priceSourceRows.map((s) => s.margin).filter((m) => m !== null));

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

  // Lifecycle and relationship state are SEPARATE concepts.
  // Lifecycle: No purchase / New (first completed order ≤90d) / Established (>90d).
  // Relationship state (§4.3) needs ≥4 completed orders (≥3 intervals): reorder ratio
  // = days-since-last / median interval → Healthy ≤1.25×, Watch ≤1.5×, At risk ≤2×,
  // Inactive >2×, else Insufficient history. An explainable state, not a 0–100 score.
  const healthRows = companyCadence.map((r) => {
    const firstAge = r.first ? daysAgo(r.first) : null;
    // Lifecycle taxonomy is deliberately DISTINCT from the New-vs-existing revenue cohort
    // (§4.6): lifecycle is about age-since-first-purchase ("Recently activated" ≤90d /
    // "Established" >90d), the revenue split is about first purchase inside the selected
    // period ("New" / "Existing"). Different words on purpose so one company can't read as
    // both "New" and "Established" at once.
    const lifecycle = r.orders === 0 ? 'No purchase' : firstAge != null && firstAge <= 90 ? 'Recently activated' : 'Established';
    let health = 'Insufficient history';
    let ratio = null;
    let overdue = null;
    if (r.typical != null && r.since != null) {
      ratio = r.since / r.typical;
      overdue = Math.max(0, r.since - r.typical);
      health = ratio <= 1.25 ? 'Healthy' : ratio <= 1.5 ? 'Watch' : ratio <= 2 ? 'At risk' : 'Inactive';
    }
    return { ...r, lifecycle, health, ratio, overdue };
  });
  const healthOf = (id) => healthRows.find((r) => r.id === id)?.health || 'Insufficient history';
  const countHealth = (s) => healthRows.filter((r) => r.health === s).length;
  const countLifecycle = (s) => healthRows.filter((r) => r.lifecycle === s).length;

  // New vs existing company revenue.
  const firstOrderByCompany = new Map(
    scopedCompanies.map((c) => {
      const ds = (c.orders || []).filter((o) => COMPLETED.has(o.status)).map((o) => String(o.date || '').slice(0, 10)).filter(Boolean).sort();
      return [c.id, ds[0] || null];
    }),
  );
  // New = the company's first completed order falls inside the current window.
  const newCompanyIds = new Set([...firstOrderByCompany.entries()].filter(([, d]) => d && new Date(d + 'T00:00:00') >= rangeStart).map(([id]) => id));
  const newCompanyRevenue = orders.filter((o) => newCompanyIds.has(o.companyId)).reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const existingCompanyRevenue = Math.max(0, sales - newCompanyRevenue);
  const activeLocations = selected ? new Set(orders.map((o) => o.location)).size : allLocationRows.filter((r) => r.orders).length;
  // New locations = locations of the selected company whose FIRST completed order falls in
  // the period — the location-level parallel of "New buying companies". (Not "Active
  // locations", which is a different activity concept and already shown in the Hero KPI.)
  const newLocations = selected
    ? (() => {
        const firstByLoc = new Map();
        (selected.orders || []).filter((o) => COMPLETED.has(o.status)).forEach((o) => {
          const d = String(o.date || '').slice(0, 10);
          if (d && (!firstByLoc.has(o.location) || d < firstByLoc.get(o.location))) firstByLoc.set(o.location, d);
        });
        return [...firstByLoc.values()].filter((d) => new Date(d + 'T00:00:00') >= rangeStart).length;
      })()
    : 0;

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
  // §6.6 near-threshold: attempts within 20% of the MOQ (qty ≥ 80% of MOQ, still under it).
  const moqNear = moqEvents.filter((e) => e.threshold && e.qty >= 0.8 * e.threshold && e.qty < e.threshold).length;
  const moqNearRate = moqEvents.length ? Math.round((moqNear / moqEvents.length) * 100) : 0;
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
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 3 months', value: '3m' },
    { label: 'Last 6 months', value: '6m' },
    { label: 'Last 12 months', value: '12m' },
    { label: 'Custom range', value: 'custom' },
  ];
  const compareOptions = [
    { label: 'No comparison', value: 'none' },
    { label: 'Previous period', value: 'previous' },
  ];
  const scopeText = selected ? `Filtered to ${selected.name}` : `Across ${companies.length} managed companies`;
  const showClear = selected || locationFilter !== 'all' || period !== '3m' || compare !== 'none';
  const clearFilters = () => {
    setCompanyFilter(embeddedCompanyId || 'all');
    setLocationFilter('all');
    setPeriod('3m');
    setCompare('none');
    setCustomStart('');
    setCustomEnd('');
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

  // Four screens (spec §1). No Orders screen — order data feeds Overview, Companies
  // and Pricing as the background that explains their performance.
  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'accounts', content: 'Companies' },
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
  // ── Overview derivations (spec §3) ──────────────────────────────────────────
  const managedCount = companies.length;
  const previousActiveCount = new Set(previousOrders.map((o) => o.companyId)).size;
  const activeDelta = compareEnabled ? activeCompanyIds.size - previousActiveCount : null;


  // Trailing-90-day helpers for Needs attention. Attach line items so GP resolves.
  const t90Start = addDays(TODAY, -89);
  const rawWithItems = (o) => ({ ...o, items: analyticsOrderItems[o.id] || [] });
  const t90Orders = (id) => {
    const c = companies.find((x) => x.id === id);
    return (c?.orders || []).filter((o) => COMPLETED.has(o.status) && inDateRange(o.date, t90Start, TODAY)).map(rawWithItems);
  };
  // "Past their normal buying cycle" = reorder ratio beyond Healthy (Watch/At risk/
  // Inactive). Exposure is stated as trailing-90-day sales AND gross profit — never
  // called "revenue at risk", since there is no predictive model behind it (§4.4).
  const pastCycleCompanies = healthRows.filter((r) => ['Watch', 'At risk', 'Inactive'].includes(r.health));
  // Aggregate the group's trailing-90 orders ONCE so GP carries its own cost coverage
  // (coverage-aware rule, §0): GP is computed on the costed portion only, and
  // pastCycleCoverage says how much of the exposure that covers. It's surfaced next to
  // the GP so $GP against $sales isn't misread as the group's true gross margin.
  const pastCycleOrders = pastCycleCompanies.flatMap((r) => t90Orders(r.id));
  const pastCycleSales = pastCycleOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const pastCycleStats = gpStats(pastCycleOrders);
  const pastCycleGP = pastCycleStats.gp;
  const pastCycleCoverage = pastCycleStats.coverage; // % of past-cycle sales that has cost data
  const pastCycleCoverageNote = pastCycleGP != null && pastCycleCoverage != null && pastCycleCoverage < 99.5
    ? `Based on ${Math.round(pastCycleCoverage)}% cost coverage`
    : undefined;

  // Stale pipeline — open quotes with no activity for >10 days (§3.4). quoteAge =
  // days since the last update (a proxy for last meaningful activity).
  const staleQuotes = openQuotes.filter((q) => quoteAge(q) > 10).map((q) => quoteVal(q)).sort((a, b) => b - a);
  const staleValue = staleQuotes.reduce((a, v) => a + v, 0);

  // Margin deterioration — the company whose gross margin fell most vs the previous
  // period (§3.4). Only meaningful when comparing periods.
  // Guardrail: a margin "drop" is only trustworthy when BOTH periods are well-costed.
  // If e.g. this period is 30% cost-covered, its margin is the margin of that 30% — not
  // comparable to a 100%-covered prior period, so we suppress the signal rather than
  // raise a Needs-attention action on incomplete data. When shown, we expose the coverage.
  const MARGIN_DROP_MIN_COVERAGE = 80;
  const marginDrops = compareEnabled
    ? companyRows
        .map((r) => {
          const c = companies.find((x) => x.id === r.id);
          const prevOs = (c?.orders || []).map(rawWithItems).filter((o) => COMPLETED.has(o.status) && inDateRange(o.date, previousPeriodStart, previousPeriodEnd));
          const prev = gpStats(prevOs);
          const minCoverage = Math.min(r.coverage ?? 0, prev.coverage ?? 0);
          const trustworthy = r.coverage != null && prev.coverage != null && r.coverage >= MARGIN_DROP_MIN_COVERAGE && prev.coverage >= MARGIN_DROP_MIN_COVERAGE;
          const drop = trustworthy && prev.margin != null && r.margin != null && r.revenue > 0 ? prev.margin - r.margin : null;
          return { name: r.name, id: r.id, drop, salesAffected: r.revenue, coverage: minCoverage };
        })
        .filter((x) => x.drop != null && x.drop >= 1)
        .sort((a, b) => b.drop - a.drop)
    : [];
  const worstMargin = marginDrops[0] || null;

  // Sales & profit over time — adaptive buckets (§3.3): day ≤31d, week ≤92d, else month.
  const bucketMode = spanDays <= 31 ? 'day' : spanDays <= 92 ? 'week' : 'month';
  const dayLabel = (d) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}`;
  const buildBuckets = (start, end) => {
    const out = [];
    if (bucketMode === 'month') {
      monthsBetween(start, end).forEach((d) => out.push({ from: startOfDay(d), to: addDays(addMonths(d, 1), -1), label: monthLabel(d) }));
    } else {
      const step = bucketMode === 'week' ? 7 : 1;
      for (let cur = startOfDay(start); cur <= end; cur = addDays(cur, step)) {
        const bEnd = addDays(cur, step - 1);
        out.push({ from: cur, to: bEnd > end ? end : bEnd, label: dayLabel(cur) });
      }
    }
    return out;
  };
  const fillBuckets = (buckets, ordersList) =>
    buckets.map((b) => {
      const os = ordersList.filter((o) => inDateRange(o.date, b.from, b.to));
      const bs = os.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const st = gpStats(os);
      return { label: b.label, sales: bs, orders: os.length, gp: st.gp, margin: st.margin };
    });
  const overviewSeries = fillBuckets(buildBuckets(rangeStart, rangeEnd), orders);
  const overviewPrevSeries = compareEnabled ? fillBuckets(buildBuckets(previousPeriodStart, previousPeriodEnd), previousOrders) : [];
  const seriesVal = (b) => (trendMetric === 'gp' ? b.gp : trendMetric === 'margin' ? b.margin : b.sales);

  const shownProducts = showAllProducts ? productRows : productRows.slice(0, 5);

  const overviewTab = (
    <BlockStack gap="500">
      {/* §3.1 — Hero KPIs */}
      <ScoreGrid
        items={[
          { label: 'Net B2B sales', value: money(sales), delta: <DeltaChip v={salesDelta} />, foot: compareEnabled ? 'vs previous period' : 'net completed orders', help: 'Net revenue from completed B2B orders (Fulfilled or Paid) in the selected period. Blocked or unfinished orders are excluded.' },
          { label: 'Gross profit', value: moneyN(grossProfit), delta: <DeltaChip v={gpDelta} />, foot: costCoverage != null && costCoverage < 99.5 ? `${Math.round(costCoverage)}% of sales have cost data` : compareEnabled ? 'vs previous period' : 'net sales − COGS', help: 'Net sales minus COGS (unit cost × quantity per line, from Shopify InventoryItem.unitCost). Computed on the costed portion of sales only — no estimate is fabricated. When some orders have no cost, the footer shows what % of sales the figure covers.' },
          { label: 'Gross margin', value: pct1N(grossMargin), delta: <DeltaChip v={marginDelta} suffix=" pp" />, foot: costCoverage != null && costCoverage < 99.5 ? `on ${Math.round(costCoverage)}% of sales with cost data` : compareEnabled ? 'vs previous period' : 'gross profit / net sales', help: 'Gross profit ÷ the sales it was costed on. When cost data is incomplete, this is the margin of the costed portion (footer shows its coverage), not a store-wide figure.' },
          selected
            ? { label: 'Active locations', value: `${activeLocations} / ${selected?.locations?.length || 0}`, foot: 'locations with an order', help: 'Locations of this company with at least one completed order in the period, out of its total locations.' }
            : { label: 'Active companies', value: String(activeCompanyIds.size), delta: activeDelta != null && activeDelta !== 0 ? <DeltaChip v={activeDelta} suffix="" /> : null, foot: `of ${managedCount} managed companies`, help: 'Managed companies with at least one completed order in the period, out of all the companies you manage.' },
          { label: 'Repeat revenue', value: `${repeatShare}%`, delta: <DeltaChip v={repeatDelta} suffix=" pp" />, foot: money(repeatRevenue), help: "Share of net sales from reorders — every completed order except each company's first-ever order." },
        ]}
      />

      {/* §3.2 — Baseline context */}
      <MiniCompare
        items={[
          { label: 'Orders', value: String(orderCount) },
          { label: 'Average order value', value: money(aov) },
          { label: 'Units sold', value: unitsSold.toLocaleString('en-US') },
          { label: selected ? 'New locations' : 'New buying companies', value: selected ? String(newLocations) : String(newCompanyIds.size) },
        ]}
      />

      {/* §3.3 — Sales & profit trend */}
      <ReportCard
        title="Sales & profit over time"
        subtitle={`Completed ${trendMetric === 'gp' ? 'gross profit' : trendMetric === 'margin' ? 'gross margin' : 'net sales'} in the current scope, by ${bucketMode}.`}
        controls={
          <div style={{ display: 'inline-flex', border: '1px solid var(--p-color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {[['sales', 'Sales'], ['gp', 'Gross profit'], ['margin', 'Gross margin']].map(([m, lbl]) => (
              <button key={m} type="button" onClick={() => setTrendMetric(m)} style={{ padding: '5px 12px', border: 0, cursor: 'pointer', font: 'inherit', background: trendMetric === m ? 'var(--p-color-bg-fill-brand)' : 'transparent', color: trendMetric === m ? 'var(--p-color-text-brand-on-bg-fill)' : 'var(--p-color-text)' }}>{lbl}</button>
            ))}
          </div>
        }
      >
        <LineChart
          data={overviewSeries.map((b) => ({ label: b.label, value: seriesVal(b) }))}
          compare={compareEnabled ? overviewPrevSeries.map((b) => ({ label: b.label, value: seriesVal(b) })) : null}
        />
      </ReportCard>

      {/* §3.4 — Needs attention (problem → financial context → CTA) */}
      {!selected && (
        <BlockStack gap="300">
          <SectionTitle title="Needs attention" subtitle="Each signal with its financial context and where to act." />
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <InsightCard
              headline="Past their normal reorder cycle"
              value={`${pastCycleCompanies.length} compan${pastCycleCompanies.length === 1 ? 'y' : 'ies'}`}
              context={`${moneyN(pastCycleGP)} gross profit in the last 90 days`}
              note={pastCycleCoverageNote}
              cta="Review companies →"
              onAction={() => setTab(1)}
            />
            <InsightCard
              headline="Current open quote value"
              value={money(openQuoteValue)}
              context={openQuotes.length ? `${openQuotes.length} quote${openQuotes.length === 1 ? '' : 's'} still open` : 'No open quotes'}
              note="Current snapshot · not affected by date range or location"
              cta="Review quotes →"
              onAction={() => setTab(3)}
            />
            {worstMargin && (
              <InsightCard
                headline={`Gross margin fell for ${worstMargin.name}`}
                value={`↓ ${worstMargin.drop.toFixed(1)} pp`}
                tone="critical"
                context={`${money(worstMargin.salesAffected)} sales affected this period`}
                note={worstMargin.coverage < 99.5 ? `Based on ${Math.round(worstMargin.coverage)}% cost coverage` : undefined}
                cta="Review pricing →"
                onAction={() => setTab(4)}
              />
            )}
          </InlineGrid>
        </BlockStack>
      )}

      {/* §3.6 Top companies + §3.2 revenue mix */}
      {!selected && (
        <>
          <ReportCard
            title="Top companies"
            subtitle="Sales, gross profit and margin by company. Click a company to filter, or open the full ranking."
            controls={<Button variant="plain" onClick={() => setTab(1)}>View all companies</Button>}
          >
            <IndexTable
              resourceName={{ singular: 'company', plural: 'companies' }}
              itemCount={Math.min(5, companyRows.length)}
              selectable={false}
              headings={[{ title: 'Company' }, { title: 'Sales', alignment: 'end' }, { title: 'Gross profit', alignment: 'end' }, { title: 'Margin', alignment: 'end' }, { title: '% of sales', alignment: 'end' }]}
              emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No completed-order data.</Text></Box>}
            >
              {companyRows.slice(0, 5).map((r, i) => (
                <IndexTable.Row id={r.id} key={r.id} position={i}>
                  <IndexTable.Cell><CompanyLink id={r.id}>{r.name}</CompanyLink></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue || 0)}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{moneyN(r.gp)}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{pctN(r.margin)}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{`${Math.round(r.share || 0)}%`}</Text></IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </ReportCard>
          <ReportCard title="New vs existing revenue" subtitle="Revenue by whether the company first purchased in the selected period.">
            <StackedBar segments={[{ name: 'Existing companies', value: existingCompanyRevenue }, { name: 'New companies', value: newCompanyRevenue }]} />
          </ReportCard>
        </>
      )}

      {/* §3.7 — Top products */}
      <ReportCard
        title="Top products"
        subtitle="Sales, units and margin by product."
        controls={productRows.length > 5 ? <Button variant="plain" onClick={() => setShowAllProducts((v) => !v)}>{showAllProducts ? 'Show top 5' : 'View all'}</Button> : null}
      >
        <IndexTable
          resourceName={{ singular: 'product', plural: 'products' }}
          itemCount={shownProducts.length}
          selectable={false}
          headings={[{ title: 'Product' }, { title: 'Sales', alignment: 'end' }, { title: 'Units', alignment: 'end' }, { title: 'Orders', alignment: 'end' }, { title: 'Margin', alignment: 'end' }]}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No line-level product data.</Text></Box>}
        >
          {shownProducts.map((r, i) => (
            <IndexTable.Row id={r.sku || String(i)} key={r.sku || i} position={i}>
              <IndexTable.Cell>
                <BlockStack gap="025">
                  <Text as="span" variant="bodyMd" fontWeight="medium">{r.name}</Text>
                  {r.sub ? <Text as="span" tone="subdued" variant="bodySm">{r.sub}</Text> : null}
                </BlockStack>
              </IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue || 0)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{(r.units || 0).toLocaleString('en-US')}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.orders || 0}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{pctN(r.margin)}</Text></IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </ReportCard>
    </BlockStack>
  );

  // ── COMPANIES (spec §4) ─────────────────────────────────────────────────────
  const HEALTH_TONE = { Healthy: 'success', Watch: 'attention', 'At risk': 'warning', Inactive: 'critical', 'Insufficient history': undefined };
  const HEALTH_ORDER = { 'At risk': 0, Inactive: 1, Watch: 2, Healthy: 3, 'Insufficient history': 4 };
  const HEALTH_SEGMENTS = [
    ['Healthy', 'var(--p-color-bg-fill-success, #29845a)'],
    ['Watch', 'var(--p-color-bg-fill-caution, #ffd79d)'],
    ['At risk', 'var(--p-color-bg-fill-warning, #ffa64b)'],
    ['Inactive', 'var(--p-color-bg-fill-critical, #e0431f)'],
    ['Insufficient history', 'var(--p-color-bg-fill-tertiary, #e3e3e3)'],
  ];
  const companyHasPricing = (c) => (c?.pricing?.base?.length > 0) || !!c?.pricing?.quantity;
  const lifecycleTotal = Math.max(1, newCompanyRevenue + existingCompanyRevenue);

  // §4.6 rows: period performance (companyRows) + snapshot health (healthRows).
  const companyTableRows = companyRows.map((r) => {
    const h = healthRows.find((x) => x.id === r.id) || {};
    const c = companies.find((x) => x.id === r.id);
    const histSales = (c?.orders || []).filter((o) => COMPLETED.has(o.status)).reduce((a, o) => a + (Number(o.amount) || 0), 0);
    return { ...r, typical: h.typical ?? null, since: h.since ?? null, overdue: h.overdue ?? null, ratio: h.ratio ?? null, health: h.health || 'Insufficient history', lifecycle: h.lifecycle || 'No purchase', hasPricing: companyHasPricing(c), histSales };
  });
  const filteredCompanyRows = companyTableRows.filter(
    (r) =>
      (healthFilter === 'all' || r.health === healthFilter) &&
      (lifecycleFilter === 'all' || r.lifecycle === lifecycleFilter) &&
      (pricingFilter === 'all' || (pricingFilter === 'has' ? r.hasPricing : !r.hasPricing)),
  );
  const sortedCompanyRows = [...filteredCompanyRows].sort((a, b) => {
    switch (companySort) {
      case 'sales': return (b.revenue || 0) - (a.revenue || 0);
      case 'growth': return (b.growth ?? -Infinity) - (a.growth ?? -Infinity);
      case 'repeat': return (b.repeat || 0) - (a.repeat || 0);
      case 'recency': return (a.since ?? Infinity) - (b.since ?? Infinity);
      case 'overdue': return (b.overdue ?? -1) - (a.overdue ?? -1);
      default: {
        // At risk → Inactive → Healthy → Insufficient history, then all-time sales desc.
        const ho = HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health];
        return ho !== 0 ? ho : (b.histSales || 0) - (a.histSales || 0);
      }
    }
  });

  const companiesScores = selected
    ? [
        { label: 'Company sales', value: money(sales), foot: 'completed sales' },
        { label: 'Active locations', value: `${activeLocations} / ${selected.locations.length}`, foot: 'locations with a completed order' },
        { label: 'Repeat revenue', value: `${repeatShare}%`, foot: money(repeatRevenue) },
        {
          label: 'Relationship health',
          value: healthOf(selected.id),
          foot: (() => { const h = healthRows.find((x) => x.id === selected.id); return h?.ratio != null ? `${h.ratio.toFixed(1)}× reorder ratio` : 'not enough order history'; })(),
        },
      ]
    : [
        { label: 'Companies', value: String(managedCount), foot: 'managed in the B2B app' },
        { label: 'Active', value: String(activeCompanyIds.size), foot: 'completed an order this period' },
        { label: 'New', value: String(newCompanyIds.size), foot: 'first order this period' },
        { label: 'Past buying cycle', value: String(pastCycleCompanies.length), foot: `${moneyShortN(pastCycleGP)} gross profit · trailing 90 days` },
      ];

  const healthCounts = HEALTH_SEGMENTS.map(([name, color]) => ({ name, color, count: countHealth(name) }));
  const healthTotal = Math.max(1, healthCounts.reduce((a, s) => a + s.count, 0));

  const companyPerfTable = selected ? (
    metricTable(allLocationRows, { entity: 'Location', clickable: false, showGrowth: compareEnabled })
  ) : (
    <IndexTable
      resourceName={{ singular: 'company', plural: 'companies' }}
      itemCount={sortedCompanyRows.length}
      selectable={false}
      headings={[
        { title: 'Company' },
        { title: 'Sales', alignment: 'end' },
        { title: 'Gross profit', alignment: 'end' },
        { title: 'Margin', alignment: 'end' },
        ...(compareEnabled ? [{ title: 'Growth', alignment: 'end' }] : []),
        { title: <Tooltip content="Share of sales from repeat orders (revenue after each company's first order ÷ its revenue)." preferredPosition="above" width="wide"><span style={{ cursor: 'help' }}>Repeat revenue</span></Tooltip>, alignment: 'end' },
        { title: 'Last order', alignment: 'end' },
        { title: 'Typical reorder', alignment: 'end' },
        { title: 'Status' },
      ]}
      emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No companies match these filters.</Text></Box>}
    >
      {sortedCompanyRows.map((r, i) => (
        <IndexTable.Row id={r.id} key={r.id} position={i}>
          <IndexTable.Cell><CompanyLink id={r.id}>{r.name}</CompanyLink></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue || 0)}</Text></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{moneyN(r.gp)}</Text></IndexTable.Cell>
          <IndexTable.Cell><Text as="span" alignment="end">{pctN(r.margin)}</Text></IndexTable.Cell>
          {compareEnabled && <IndexTable.Cell><Text as="span" alignment="end">{r.growth == null ? '—' : `${r.growth > 0 ? '+' : ''}${r.growth}%`}</Text></IndexTable.Cell>}
          <IndexTable.Cell><Text as="span" alignment="end">{`${Math.round(r.repeat || 0)}%`}</Text></IndexTable.Cell>
          {/* Recency only — the overdue amount and reorder ratio live on the Status tooltip
              so this cell answers one thing: how long since the last order. */}
          <IndexTable.Cell><Text as="span" alignment="end">{r.since != null ? `${r.since}d ago` : '—'}</Text></IndexTable.Cell>
          {/* Baseline only ("how often do they usually buy") — the current-state ratio moves
              to Status, so this cell isn't mixing a stable interval with a TODAY value. */}
          <IndexTable.Cell><Text as="span" alignment="end">{r.typical != null ? `~${r.typical}d` : '—'}</Text></IndexTable.Cell>
          <IndexTable.Cell>
            {r.ratio != null ? (
              <Tooltip content={`${r.ratio.toFixed(1)}× its usual reorder gap${r.overdue ? ` · ${r.overdue} days past its typical reorder time` : ''}`} preferredPosition="above" width="wide">
                <span style={{ display: 'inline-flex', cursor: 'help' }}><Badge tone={HEALTH_TONE[r.health]}>{r.health}</Badge></span>
              </Tooltip>
            ) : (
              <Badge tone={HEALTH_TONE[r.health]}>{r.health}</Badge>
            )}
          </IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );

  // Filter/sort controls shared by the inline Company performance card and its full-screen view.
  const companyFilters = (
    <InlineStack gap="200" wrap blockAlign="center">
      <div style={{ minWidth: 150 }}><Select label="Health" labelHidden options={[{ label: 'All health', value: 'all' }, ...HEALTH_SEGMENTS.map(([n]) => ({ label: `${n} (${countHealth(n)})`, value: n }))]} value={healthFilter} onChange={setHealthFilter} /></div>
      <div style={{ minWidth: 150 }}><Select label="Lifecycle" labelHidden options={[{ label: 'All lifecycle', value: 'all' }, ...['No purchase', 'Recently activated', 'Established'].map((n) => ({ label: `${n} (${countLifecycle(n)})`, value: n }))]} value={lifecycleFilter} onChange={setLifecycleFilter} /></div>
      <div style={{ minWidth: 140 }}><Select label="Pricing" labelHidden options={[{ label: 'Any pricing', value: 'all' }, { label: 'Has pricing', value: 'has' }, { label: 'No pricing', value: 'none' }]} value={pricingFilter} onChange={setPricingFilter} /></div>
      {/* Only offer sorts for metrics the table actually shows — Orders/AOV columns aren't
          on this screen, so sorting by them would reorder rows with nothing to verify against. */}
      <div style={{ minWidth: 160 }}><Select label="Sort" labelHidden options={[{ label: 'Health (default)', value: 'default' }, { label: 'Sales', value: 'sales' }, ...(compareEnabled ? [{ label: 'Growth', value: 'growth' }] : []), { label: 'Repeat revenue', value: 'repeat' }, { label: 'Last order', value: 'recency' }, { label: 'Days overdue', value: 'overdue' }]} value={companySort} onChange={setCompanySort} /></div>
    </InlineStack>
  );

  const companiesTab = (
    <BlockStack gap="500">
      <ScoreGrid items={companiesScores} />

      {/* §4.4 — exposure: named as historical revenue, not "revenue at risk". */}
      {!selected && pastCycleCompanies.length > 0 && (
        <ReportCard title="Companies past their buying cycle" subtitle="Historical revenue from companies now past their normal reorder cadence — not a prediction of loss.">
          <BlockStack gap="200">
            <Text as="span" variant="bodyMd" fontWeight="medium">{`${pastCycleCompanies.length} compan${pastCycleCompanies.length === 1 ? 'y' : 'ies'} past normal buying cycle`}</Text>
            <MiniCompare
              items={[
                { label: 'Trailing 90-day sales', value: money(pastCycleSales) },
                { label: 'Trailing 90-day gross profit', value: moneyN(pastCycleGP), sub: pastCycleCoverageNote },
              ]}
            />
          </BlockStack>
        </ReportCard>
      )}

      {selected ? (
        <ReportCard title="Location performance" subtitle="Location contribution in the selected period.">{companyPerfTable}</ReportCard>
      ) : (
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <ReportCard title="Relationship state" subtitle="Reorder ratio vs each company's own rhythm — separate from lifecycle. Click a segment to filter the table." help={<RelationshipStateHelp />}>
            <BlockStack gap="300">
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
                {healthCounts.filter((s) => s.count > 0).map((s) => (
                  <div key={s.name} title={`${s.name}: ${s.count}`} style={{ width: `${(s.count / healthTotal) * 100}%`, background: s.color }} />
                ))}
              </div>
              <InlineStack gap="300" wrap>
                {healthCounts.map((s) => (
                  <button key={s.name} type="button" onClick={() => setHealthFilter(healthFilter === s.name ? 'all' : s.name)} style={{ all: 'unset', cursor: 'pointer' }}>
                    <InlineStack gap="150" blockAlign="center">
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
                      <Text as="span" variant="bodySm" fontWeight={healthFilter === s.name ? 'bold' : 'regular'}>{s.name}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">{s.count}</Text>
                    </InlineStack>
                  </button>
                ))}
              </InlineStack>
            </BlockStack>
          </ReportCard>
          <ReportCard title="New vs existing revenue" subtitle="Revenue by whether the company first purchased in the selected period.">
            <StackedBar segments={[{ name: 'Existing companies', value: existingCompanyRevenue }, { name: 'New companies', value: newCompanyRevenue }]} />
            <Box paddingBlockStart="200">
              <Text as="p" tone="subdued" variant="bodySm">{`${pct(existingCompanyRevenue, lifecycleTotal)}% existing · ${pct(newCompanyRevenue, lifecycleTotal)}% new.`}</Text>
            </Box>
          </ReportCard>
        </InlineGrid>
      )}

      {!selected && (
        <>
          <ReportCard
            title="Company performance"
            subtitle="Value, gross profit, growth, reorder behaviour and relationship state per company."
            controls={
              <InlineStack gap="200" wrap blockAlign="center">
                {companyFilters}
                <Button icon={MaximizeIcon} variant="tertiary" onClick={() => setCompanyModalOpen(true)} accessibilityLabel="Open full-screen view">Expand</Button>
              </InlineStack>
            }
          >
            {/* Only mount here when the full-screen view is closed — IndexTable's sticky
                first column uses DOM refs, so two live instances of the same table clash
                and the second loses its Company column. */}
            {!companyModalOpen && companyPerfTable}
          </ReportCard>
          {companyModalOpen && createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: 519, display: 'flex', flexDirection: 'column', background: 'var(--p-color-bg, #f1f1f1)' }}>
              <Box background="bg-surface" borderColor="border" borderBlockEndWidth="025" padding="400">
                <InlineStack align="space-between" blockAlign="center" gap="400">
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingMd">Company performance</Text>
                    <Text as="span" tone="subdued" variant="bodySm">{`${sortedCompanyRows.length} compan${sortedCompanyRows.length === 1 ? 'y' : 'ies'} · in the selected period and scope`}</Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    {companyFilters}
                    <Button icon={XIcon} variant="tertiary" onClick={() => setCompanyModalOpen(false)} accessibilityLabel="Close full-screen view" />
                  </InlineStack>
                </InlineStack>
              </Box>
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <Box background="bg-surface" borderColor="border" borderWidth="025" borderRadius="300" padding="200">
                  {companyPerfTable}
                </Box>
              </div>
            </div>,
            document.body,
          )}
        </>
      )}

      {activationRows.length > 0 && (
        <ReportCard
          title="B2B activation"
          subtitle="Registration cohort — companies that registered in the selected period, tracked to their approval and first purchase to date."
          help={
            <BlockStack gap="150">
              <Text as="span" variant="bodySm">This is a <Text as="span" variant="bodySm" fontWeight="semibold">registration cohort</Text>, not period activity: companies are chosen by registration date in the window, then their approval and first purchase are counted whenever they happen, up to today.</Text>
              <Text as="span" variant="bodySm" tone="subdued">So re-opening an earlier period later can show higher Approved / First purchase — the cohort keeps converting. It measures conversion to date, not what happened inside the window.</Text>
            </BlockStack>
          }
        >
          <BlockStack gap="300">
            <FunnelV2
              stages={[
                { name: 'Registered', count: activationRows.length, value: String(activationRows.length) },
                { name: 'Approved to date', count: activationApproved.length, value: String(activationApproved.length), note: `· ${pct(activationApproved.length, activationRows.length)}%` },
                { name: 'First purchase to date', count: activationPurchased.length, value: String(activationPurchased.length), note: `· ${activationApproved.length ? pct(activationPurchased.length, activationApproved.length) : 0}% of approved` },
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
      )}
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
      <ReportCard title={selected ? 'Order cadence' : 'Reorder cadence by company'} subtitle={selected ? 'Intervals between this company’s completed orders.' : 'Compare company recency with each company’s established ordering rhythm. Typical reorder shows only with at least three observed intervals.'}>
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

  // ── QUOTES (spec §5) ────────────────────────────────────────────────────────
  const previousReceived = compareEnabled
    ? allQuotes.filter((q) => scopedIds.has(q.company) && inDateRange(q.created, previousPeriodStart, previousPeriodEnd) && (locationFilter === 'all' || q.location === locationFilter.split('::')[1])).length
    : 0;
  const quotesCreatedDelta = compareEnabled && previousReceived ? pctChange(received, previousReceived) : null;
  const quoteValueTotal = quotes.reduce((a, q) => a + quoteVal(q), 0); // §5.2 total quoted value (period)
  const avgQuoteValue = received ? quoteValueTotal / received : 0;

  // §5.3 typical time to decision — median over finalized (Won + Lost) quotes.
  const decisionDays = finalizedQuotes
    .map((q) => { const c = String(q.created || '').slice(0, 10); const u = String(q.updated || '').slice(0, 10); return c && u ? Math.max(0, daysBetween(c, u)) : null; })
    .filter((x) => x != null);
  const decisionMedian = median(decisionDays);

  // §5.5 cohort funnel (Count | Value): only quotes created in the period, tracked
  // to the furthest stage they reached — not everything currently sitting at a stage.
  // The quote app has three states: Received → Negotiating → Won. Lost is the other
  // terminal outcome (not downstream of Won), shown as a share of RFQs. Cohort funnel
  // counts how far each period quote got.
  const stageValue = (qs) => qs.reduce((a, q) => a + quoteVal(q), 0);
  const funnelNegotiating = quotes.filter((q) => q.status === 'Negotiating' || q.status === 'Deal Closed');
  const funnelWon = quotes.filter((q) => q.status === 'Deal Closed');
  const funnelLost = quotes.filter((q) => q.status === 'Deal Rejected');
  const funnelSource = [
    { name: 'RFQ received', qs: quotes },
    { name: 'Negotiating', qs: funnelNegotiating },
    { name: 'Won', qs: funnelWon },
    { name: 'Lost', qs: funnelLost, terminal: true },
  ];
  const funnelMetricOf = (qs) => (quoteFunnelMode === 'value' ? stageValue(qs) : qs.length);
  const funnelInitial = funnelMetricOf(quotes);
  const funnelV2Stages = funnelSource.map((s, i) => {
    const m = funnelMetricOf(s.qs);
    const disp = quoteFunnelMode === 'value' ? moneyShort(m) : String(m);
    const ofRfq = funnelInitial ? pct(m, funnelInitial) : 0;
    if (s.terminal) return { name: s.name, count: m, value: `${disp} · ${ofRfq}%`, note: `${ofRfq}% of RFQs · lost` };
    const prev = i ? funnelMetricOf(funnelSource[i - 1].qs) : m;
    return { name: s.name, count: m, value: `${disp} · ${ofRfq}%`, note: i ? `${prev ? pct(m, prev) : 0}% from prior` : '' };
  });

  // §5.6 quote performance by company.
  const quoteResponseDays = (q) => {
    const created = String(q.created || '').slice(0, 10);
    if (!created) return null;
    const first = (q.timeline || []).find((e) => /quote sent|email sent|exported as pdf|priced/i.test(String(e.what || '')));
    const d = first ? timelineDate(first.when) : null;
    return d ? Math.max(0, (d - new Date(created + 'T00:00:00')) / DAY) : null;
  };
  const companyQuoteTable = scopedCompanies
    .map((c) => {
      const qs = quotes.filter((q) => q.company === c.id);
      const won = qs.filter((q) => q.status === 'Deal Closed');
      const lost = qs.filter((q) => q.status === 'Deal Rejected');
      const fin = won.length + lost.length;
      const wonV = stageValue(won);
      const finV = stageValue([...won, ...lost]);
      const open = qs.filter((q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status));
      return { id: c.id, name: c.name, rfqs: qs.length, quoted: stageValue(qs), openValue: stageValue(open), winCount: fin ? Math.round((won.length / fin) * 100) : null, winValue: finV ? Math.round((wonV / finV) * 100) : null, response: median(qs.map(quoteResponseDays).filter((x) => x != null)) };
    })
    .filter((r) => r.rfqs > 0)
    .sort((a, b) => b.quoted - a.quoted);

  const agingMaxVal = Math.max(1, ...agingBuckets.map((x) => x.value));
  const maxDiscountRate = Math.max(1, ...discountBuckets.map((x) => x.rate || 0));

  // §5.7 win rate by deal size (advanced). Always carries its sample size.
  const dealSizeBuckets = [
    { name: '< $2k', min: 0, max: 2000 },
    { name: '$2k–$10k', min: 2000, max: 10000 },
    { name: '$10k–$50k', min: 10000, max: 50000 },
    { name: '$50k+', min: 50000, max: Infinity },
  ].map((b) => {
    const rows = finalizedQuotes.filter((q) => { const v = quoteVal(q); return v >= b.min && v < b.max; });
    const wins = rows.filter((q) => q.status === 'Deal Closed').length;
    return { ...b, count: rows.length, rate: rows.length ? Math.round((wins / rows.length) * 100) : null };
  });
  const dealSizeMaxRate = Math.max(1, ...dealSizeBuckets.map((b) => b.rate || 0));
  const quoteDetailTable = (
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
  );

  const quotesTab = (
    <BlockStack gap="500">
      {/* §5.1 — hero metrics: future revenue + where it's stuck */}
      <ScoreGrid
        items={[
          { label: 'Open pipeline', value: money(openQuoteValue), foot: `${openQuotes.length} open quote${openQuotes.length === 1 ? '' : 's'}` },
          { label: 'Win rate by value', value: winRateValue == null ? '—' : `${winRateValue}%`, foot: `${moneyShort(wonValue)} won of ${moneyShort(finalizedValue)} finalized` },
          { label: 'Stale pipeline', value: money(staleValue), foot: `${staleQuotes.length} quote${staleQuotes.length === 1 ? '' : 's'} idle >10 days` },
          { label: 'First response', value: formatTypicalTime(responseMedian), foot: 'median RFQ → first response' },
        ]}
      />

      {/* §5.2 — baseline metric strip */}
      <MiniCompare
        items={[
          { label: 'Quotes created', value: String(received) },
          { label: 'Total quoted value', value: money(quoteValueTotal) },
          { label: 'Won quotes', value: String(wonQuotes.length) },
          { label: 'Lost quotes', value: String(lostQuotes.length) },
          { label: 'Average quote value', value: money(avgQuoteValue) },
          { label: 'Win rate by count', value: winRateCount == null ? '—' : `${winRateCount}%` },
        ]}
      />

      {/* §5.3 aging + §5.5 cohort funnel */}
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="Didn't close quote aging" subtitle="Value of quotes that haven't closed yet, by age. Bars scale by value, not count.">
          <RankBars rows={agingBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} quote${b.count === 1 ? '' : 's'} still open`, value: b.value, width: (b.value / agingMaxVal) * 100, valueLabel: money(b.value) }))} empty="No quotes still open." />
        </ReportCard>
        <ReportCard
          title="Pipeline funnel"
          subtitle="Cohort of quotes created in the period, tracked to the furthest stage reached."
          controls={
            <div style={{ display: 'inline-flex', border: '1px solid var(--p-color-border)', borderRadius: 8, overflow: 'hidden' }}>
              {[['count', 'Count'], ['value', 'Value']].map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => setQuoteFunnelMode(m)} style={{ padding: '5px 12px', border: 0, cursor: 'pointer', font: 'inherit', background: quoteFunnelMode === m ? 'var(--p-color-bg-fill-brand)' : 'transparent', color: quoteFunnelMode === m ? 'var(--p-color-text-brand-on-bg-fill)' : 'var(--p-color-text)' }}>{lbl}</button>
              ))}
            </div>
          }
        >
          <FunnelV2 stages={funnelV2Stages} />
        </ReportCard>
      </InlineGrid>

      {/* §5.4 sales cycle */}
      <ReportCard title="Median time to decision" subtitle="Median RFQ → Won or Lost decision. Median, not average.">
        <Text as="span" variant="headingLg">{formatTypicalTime(decisionMedian)}</Text>
      </ReportCard>

      {/* per-company quote detail (selected view) */}
      {selected && (
        <ReportCard title="Quote detail" subtitle="Underlying quote records for this company.">
          {quoteDetailTable}
        </ReportCard>
      )}

      {/* §5.7 — advanced pipeline analysis (portfolio) */}
      {!selected && (
        <ReportCard
          title="Advanced pipeline analysis"
          subtitle="Win-rate cuts and discount behaviour — always read with the sample size; correlation is not causation."
          controls={<Button variant="plain" onClick={() => setAdvancedPipeline((v) => !v)}>{advancedPipeline ? 'Hide' : 'Show'}</Button>}
        >
          {advancedPipeline ? (
            <BlockStack gap="400">
              <BlockStack gap="150">
                <Text as="h4" variant="headingXs">Win rate by company</Text>
                <IndexTable
                  resourceName={{ singular: 'company', plural: 'companies' }}
                  itemCount={companyQuoteTable.length}
                  selectable={false}
                  headings={[
                    { title: 'Company' },
                    { title: 'RFQs', alignment: 'end' },
                    { title: 'Quoted value', alignment: 'end' },
                    { title: 'Open value', alignment: 'end' },
                    { title: 'Win (count)', alignment: 'end' },
                    { title: 'Win (value)', alignment: 'end' },
                    { title: 'Median response', alignment: 'end' },
                  ]}
                  emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No RFQs in this scope.</Text></Box>}
                >
                  {companyQuoteTable.map((r, i) => (
                    <IndexTable.Row id={r.id} key={r.id} position={i}>
                      <IndexTable.Cell><CompanyLink id={r.id}>{r.name}</CompanyLink></IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{r.rfqs}</Text></IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{money(r.quoted)}</Text></IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{money(r.openValue)}</Text></IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{r.winCount == null ? '—' : `${r.winCount}%`}</Text></IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{r.winValue == null ? '—' : `${r.winValue}%`}</Text></IndexTable.Cell>
                      <IndexTable.Cell><Text as="span" alignment="end">{r.response == null ? '—' : formatTypicalTime(r.response)}</Text></IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </BlockStack>
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <BlockStack gap="150">
                  <Text as="h4" variant="headingXs">Win rate by deal size</Text>
                  <RankBars rows={dealSizeBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} finalized quote${b.count === 1 ? '' : 's'}`, width: b.rate == null ? 0 : (b.rate / dealSizeMaxRate) * 100, valueLabel: b.rate == null ? '—' : `${b.rate}% won` }))} empty="No finalized quotes." />
                </BlockStack>
                <BlockStack gap="150">
                  <Text as="h4" variant="headingXs">Win rate by discount band</Text>
                  <MiniCompare items={[{ label: 'Average discount given', value: avgDiscount == null ? '—' : `${avgDiscount.toFixed(1)}%`, sub: 'weighted by quoted value · vs Shopify list' }]} />
                  <RankBars rows={discountBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} finalized quote${b.count === 1 ? '' : 's'}`, width: b.rate == null ? 0 : (b.rate / maxDiscountRate) * 100, valueLabel: b.rate == null ? '—' : `${b.rate}% won` }))} empty="No finalized quotes." />
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          ) : (
            <Text as="p" tone="subdued" variant="bodySm">Win rate by company, deal size and discount band — each with its sample size.</Text>
          )}
        </ReportCard>
      )}
    </BlockStack>
  );

  // ── PRICING & MARGIN (spec §6) ──────────────────────────────────────────────
  const provenanceSegments = [
    { name: "Price created on B2B", value: companyPriceRevenue },
    { name: 'Price synced from quotes', value: previousPriceRevenue },
    { name: 'Other price', value: otherPriceRevenue },
  ].filter((s) => s.value > 0);
  const pricingTab = (
    <BlockStack gap="500">
      {/* §6.1 — core economics: sensible AND profitable commercial terms? */}
      <ScoreGrid
        items={[
          { label: 'B2B price vs Shopify', value: realizedPriceDeltaPct == null ? '—' : `${Math.abs(realizedPriceDeltaPct).toFixed(1)}% ${realizedPriceDelta >= 0 ? 'higher' : 'lower'}`, foot: `${money(Math.abs(realizedPriceDelta))} ${realizedPriceDelta >= 0 ? 'above' : 'below'} Shopify prices` },
          { label: 'Gross margin', value: pct1N(grossMargin), foot: costCoverage != null && costCoverage < 99.5 ? `${moneyN(grossProfit)} GP · ${Math.round(costCoverage)}% cost coverage` : `${moneyN(grossProfit)} gross profit` },
          { label: 'Manual price changes', value: `${overrideRate.toFixed(1)}%`, foot: `${overriddenLines.length} of ${eligibleLines.length} app-priced line${eligibleLines.length === 1 ? '' : 's'}` },
          { label: 'Sales below margin threshold', value: money(marginExceptionSales), foot: `${marginExceptionLines.length} line${marginExceptionLines.length === 1 ? '' : 's'} below ${marginFloor}% margin` },
        ]}
      />
      <InlineStack align="end" blockAlign="center" gap="200">
        <Text as="span" tone="subdued" variant="bodySm">Margin exception threshold</Text>
        <div style={{ width: 100 }}>
          <Select label="Margin threshold" labelHidden options={[{ label: '15%', value: '15' }, { label: '20%', value: '20' }, { label: '25%', value: '25' }, { label: '30%', value: '30' }]} value={marginThreshold} onChange={setMarginThreshold} />
        </div>
      </InlineStack>

      {/* §6.2 — baseline pricing footprint */}
      <MiniCompare
        items={[
          { label: 'Active pricing agreements', value: String(activePolicyCount) },
          { label: 'Companies with pricing', value: String(companiesWithPricing) },
          { label: 'Locations covered', value: String(locationsCovered) },
          { label: 'Revenue on negotiated pricing', value: money(influencedRevenue) },
          { label: 'Orders on negotiated pricing', value: String(influencedOrders.length) },
        ]}
      />

      {/* §6.3 provenance + margin by source */}
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="Pricing provenance" subtitle="Where revenue was actually priced from — created on B2B, synced from a quote, or other." controls={<PriceTypeHelp />}>
          <StackedBar segments={provenanceSegments} />
        </ReportCard>
        <ReportCard title="Margin by price source" subtitle="Gross margin each resolved price source actually earns." controls={<PriceTypeHelp />}>
          <RankBars rows={priceSourceRows.map((s) => ({ key: s.name, name: s.name, sub: `${moneyN(s.gp)} gross profit · ${money(s.revenue)} sales`, value: s.margin ?? 0, width: s.margin == null ? 0 : (s.margin / priceSourceMaxMargin) * 100, valueLabel: pctN(s.margin) }))} empty="No completed orders." />
        </ReportCard>
      </InlineGrid>

      {/* §6.4 — pricing performance table (sorted by gross profit) */}
      <ReportCard title="Pricing performance" subtitle="Sales, gross profit, margin, price vs Shopify and how often the price was changed manually, by profile.">
        <IndexTable
          resourceName={{ singular: 'pricing', plural: 'pricings' }}
          itemCount={pricingUsage.length}
          selectable={false}
          headings={[{ title: 'Pricing' }, { title: 'Source' }, { title: 'Sales', alignment: 'end' }, { title: 'Gross profit', alignment: 'end' }, { title: 'Margin', alignment: 'end' }, { title: 'vs Shopify', alignment: 'end' }, { title: 'Manual price changes', alignment: 'end' }, { title: 'Orders', alignment: 'end' }, { title: 'Companies', alignment: 'end' }]}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No pricing usage on completed orders.</Text></Box>}
        >
          {pricingUsage.map((r, i) => (
            <IndexTable.Row id={r.name} key={r.name} position={i}>
              <IndexTable.Cell>{r.name}</IndexTable.Cell>
              <IndexTable.Cell>{r.sub || '—'}</IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.revenue)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{moneyN(r.gp)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{pctN(r.margin)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.deltaPct == null ? '—' : `${Math.abs(r.deltaPct).toFixed(1)}% ${r.deltaPct >= 0 ? 'higher' : 'lower'}`}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.overrideRate == null ? '—' : `${Math.round(r.overrideRate)}%`}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.orders}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.companies}</Text></IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </ReportCard>

      {/* §6.6 — MOQ / quantity pricing */}
      <ReportCard title="MOQ & quantity pricing" subtitle="Demand blocked by minimum order quantities, and how close blocked attempts sat to the threshold. Evidence to investigate, not a recommendation.">
        <BlockStack gap="300">
          <MiniCompare
            items={[
              { label: 'MOQ-blocked demand', value: money(moqAttempted), sub: `${moqEvents.length} attempt${moqEvents.length === 1 ? '' : 's'} · ${moqBuyers} buyer${moqBuyers === 1 ? '' : 's'}` },
              { label: 'Near threshold', value: `${moqNearRate}%`, sub: `${moqNear} of ${moqEvents.length} within 20% of MOQ` },
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

      {/* §6.5 — advanced pricing analysis */}
      <ReportCard
        title="Advanced pricing analysis"
        subtitle="Pricing-change outcomes and deeper cuts. Temporal comparison, not causal attribution."
        controls={<Button variant="plain" onClick={() => setAdvancedPricing((v) => !v)}>{advancedPricing ? 'Hide' : 'Show'}</Button>}
      >
        {advancedPricing ? (
          <BlockStack gap="400">
            <BlockStack gap="150">
              <Text as="h4" variant="headingXs">Pricing change outcomes</Text>
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
            </BlockStack>
            <Text as="p" tone="subdued" variant="bodySm">
              Pocket-price waterfall, pocket margin and price leakage need pocket-price data (freight/servicing concessions) that isn't captured yet.
            </Text>
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued" variant="bodySm">Pricing-change before/after, plus pocket-margin and price-leakage once pocket-price data is captured.</Text>
        )}
      </ReportCard>
    </BlockStack>
  );

  const tabContent = [overviewTab, companiesTab, ordersTab, quotesTab, pricingTab][tab];

  const content = (
    <BlockStack gap="400">
      {import.meta.env.DEV && (
        <Box background="bg-surface-secondary" borderColor="border" borderWidth="025" borderRadius="200" padding="200">
          <InlineStack gap="200" blockAlign="center" wrap>
            <Badge tone="info">Dev</Badge>
            <Text as="span" variant="bodySm" tone="subdued">
              {devInject
                ? 'Event-basis test data injected: #1039 −$400 discount, #1033 SEA-30 return (−$1,250 sales / −$1,000 COGS). Net sales, GP and Top products reflect it.'
                : 'Inject event-basis test data (a discount + a return) to demo the production Net sales / GP / Top-products definitions.'}
            </Text>
            <Button size="slim" pressed={devInject} onClick={() => setDevInject((v) => !v)}>
              {devInject ? 'Reset test data' : 'Inject test data'}
            </Button>
          </InlineStack>
        </Box>
      )}
      <Card>
        <BlockStack gap="300">
          <InlineStack gap="300" wrap blockAlign="end">
            <div style={{ minWidth: 150 }}><Select label="Date range" options={periodOptions} value={period} onChange={setPeriod} /></div>
            {period === 'custom' && (
              <>
                <div style={{ minWidth: 150 }}><TextField label="Start date" type="date" value={customStart} onChange={setCustomStart} autoComplete="off" /></div>
                <div style={{ minWidth: 150 }}><TextField label="End date" type="date" value={customEnd} onChange={setCustomEnd} autoComplete="off" /></div>
              </>
            )}
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
    <Page fullWidth title="Analytics" subtitle="Explore B2B performance across companies, quotes and pricing.">
      {content}
    </Page>
  );
}
