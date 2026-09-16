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
  Banner,
  Button,
  Tooltip,
  Icon,
} from '@shopify/polaris';
import { InfoIcon, MaximizeIcon, XIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { LineChart, VBarChart, StackedBar, FunnelV2, RankBars, Timeline, moneyShort } from '../components/charts.jsx';
import { resolveDetail, defaultVariant } from '../pricing.js';
import { buildAttributedLines, pricingProfileRows } from '../pricingAttribution.js';
import {
  analyticsOrderItems,
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

// ── Dev-only missing-cost case (toggled by the "Inject missing cost" dev button) ──
// Strips the unit cost from one SKU so its lines drop out of GP/Margin. Used to demo the
// cost-coverage disclosures — Hero "% of sales have cost data", the margin-threshold card
// footer, and per-source coverage on Margin by price source — which stay hidden while the
// seed is fully costed. SEA-30 sells across several price sources, so coverage falls on
// multiple rows at once. Never applied in a prod build.
const DEV_MISSING_COST_SKU = 'SEA-30';
// Prototype: show the dev toggles in production too (flip to import.meta.env.DEV to hide in prod).
const SHOW_DEV_TOOLS = true;

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
function MiniCompare({ items, plain = false }) {
  const n = items.length;
  const grid = (
    <InlineGrid columns={{ xs: 1, sm: Math.min(n, 2), md: n }} gap="300">
      {items.map((it) => (
        <BlockStack gap="050" key={it.label}>
          {it.help ? (
            <Tooltip content={it.help} preferredPosition="above" width="wide">
              <Text as="span" tone="subdued" variant="bodySm">
                <span style={{ cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}>{it.label}</span>
              </Text>
            </Tooltip>
          ) : (
            <Text as="span" tone="subdued" variant="bodySm">{it.label}</Text>
          )}
          <Text as="span" variant="headingMd">{it.value}</Text>
          {it.sub ? <Text as="span" tone="subdued" variant="bodySm">{it.sub}</Text> : null}
        </BlockStack>
      ))}
    </InlineGrid>
  );
  if (plain) return grid;
  return (
    <Box borderColor="border" borderWidth="025" borderRadius="200" padding="300">
      {grid}
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

// A table column heading with a dotted underline + hover tooltip explaining the metric.
// Used on the Pricing performance table so each column's definition is one hover away.
function HeadHelp({ label, help }) {
  return (
    <Tooltip content={help} preferredPosition="above" width="wide">
      <span style={{ cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{label}</span>
    </Tooltip>
  );
}

// An h4 sub-card heading with a dotted underline + hover tooltip (same idea as HeadHelp).
function HeadingHelp({ label, help }) {
  return (
    <Text as="h4" variant="headingXs">
      <Tooltip content={help} preferredPosition="above" width="wide">
        <span style={{ cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{label}</span>
      </Tooltip>
    </Text>
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
            {/* With controls, the help icon sits next to the title (a card with a wide
                controls row shouldn't push the ⓘ to the far right past the controls).
                Without controls, it goes in the right slot below, pinned flush-right. */}
            {help && controls ? (
              <InlineStack gap="100" blockAlign="center" wrap={false}>
                <Text as="h3" variant="headingSm">{title}</Text>
                <Tooltip content={help} preferredPosition="above" width="wide">
                  <span style={{ display: 'inline-flex', cursor: 'help' }}><Icon source={InfoIcon} tone="subdued" /></span>
                </Tooltip>
              </InlineStack>
            ) : (
              <Text as="h3" variant="headingSm">{title}</Text>
            )}
            {subtitle ? <Text as="p" tone="subdued" variant="bodySm">{subtitle}</Text> : null}
          </BlockStack>
          {(controls || (help && !controls)) ? (
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              {controls || null}
              {help && !controls ? (
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
  const policies = state.db.policies || [];
  const companyById = (id) => companies.find((c) => c.id === id);
  const allQuotes = state.db.quotes || [];

  const [companyFilter, setCompanyFilter] = useState(embeddedCompanyId || 'all');
  const [period, setPeriod] = useState('3m'); // 30d | 3m | 6m | 12m | custom
  const [compare, setCompare] = useState('none'); // none | previous
  const [customStart, setCustomStart] = useState(''); // YYYY-MM-DD (custom range)
  const [customEnd, setCustomEnd] = useState('');
  const [tab, setTab] = useState(0);
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
  const [devInject, setDevInject] = useState(false); // dev-only: inject event-basis test data (returns/discounts)
  const [devMissingCost, setDevMissingCost] = useState(false); // dev-only: strip one SKU's cost to demo coverage disclosures
  const [devEmpty, setDevEmpty] = useState(false); // dev-only: preview the empty state while data exists

  const activeCompanyId = embeddedCompanyId || companyFilter;
  // Empty state: no B2B orders anywhere and no quotes at all (or the dev "Preview empty state"
  // toggle is on). Zeroing the source data — orders, quotes and the event feeds — makes every
  // block render its own per-block empty state (empty charts, "—" KPIs, "No … yet" tables) while
  // the whole dashboard layout, controls and tabs stay put.
  const genuinelyEmpty = !companies.some((c) => (c.orders || []).length > 0) && !allQuotes.length;
  const showEmpty = genuinelyEmpty || devEmpty;
  const scopedBase = activeCompanyId === 'all' ? companies.slice() : companies.filter((c) => c.id === activeCompanyId);
  const scopedCompanies = showEmpty ? scopedBase.map((c) => ({ ...c, orders: [] })) : scopedBase;
  const selected = activeCompanyId === 'all' ? null : scopedCompanies[0] || null;
  const scopedIds = new Set(scopedCompanies.map((c) => c.id));

  const productBySku = (sku) => products.find((p) => p.sku === sku);

  // ── date range (day-based; Phase 1 spec §2.1) ───────────────────────────────
  // period: '30d' | '3m' | '6m' | '12m' | 'custom'. Current window = [rangeStart,
  // rangeEnd] inclusive (ending TODAY, or the custom dates). "Compare to → Previous
  // period" is the same-length span immediately before it. PERIOD metrics filter on
  // this window (inPeriod); CURRENT SNAPSHOT metrics ignore it (see snapshotQuotes)
  // and only honour the Company filter.
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
  const allScopedOrders = scopedCompanies.flatMap((c) => (c.orders || []).map((o) => attach(o, c))).filter((o) => COMPLETED.has(o.status));
  const orders = allScopedOrders.filter((o) => inPeriod(o.date));
  const previousOrders = compareEnabled ? allScopedOrders.filter((o) => inDateRange(o.date, previousPeriodStart, previousPeriodEnd)) : [];

  const quotes = showEmpty ? [] : allQuotes.filter((q) => scopedIds.has(q.company) && inPeriod(q.created));

  // Snapshot quotes: every scoped quote regardless of when it was created. Open value is
  // a current-state metric, so it ignores the DATE RANGE (a quote opened 5 months ago but
  // still open must appear). Company scope still applies.
  const snapshotQuotes = showEmpty ? [] : allQuotes.filter((q) => scopedIds.has(q.company));

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
  const productCost = (sku) => { if (devMissingCost && sku === DEV_MISSING_COST_SKU) return null; const c = productBySku(sku)?.cost; return c == null ? null : (Number(c) || 0); };
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
      const scopedHistory = history;
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
        const scopedHistory = history;
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

  // ── shared pricing attribution (line-level, snapshot AT ORDER CREATION) ───────
  // Analytics evaluates pricing by the price actually applied to each line WHEN THE ORDER
  // WAS CREATED, in two merchant-facing groups only:
  //   • B2B pricing   — the line used a Company / Location / app pricing at creation
  //                     (pricing synced from a quote counts as B2B once it's applied).
  //   • Other pricing — the line did not (a manual custom price, the Shopify default, …).
  // Later adjustments (discount, refund, price edit, reversal) do NOT change a line's group
  // or its margin-at-applied-price here. `synced_from_quote` stays internal origin metadata,
  // not an analytics dimension. Each line's snapshot carries BOTH the pricing-engine output
  // (BEFORE any manual override) and the price actually applied at creation:
  //   • resolved*  = engine output — `resolvedPricingSource` / `resolvedPricingId` /
  //     (prod) `resolvedUnitPrice`: the B2B pricing that WAS resolved, even if later overridden.
  //   • *AtCreation = the effective price present when the order was created —
  //     `pricingSourceAtCreation` / `appliedUnitPriceAtCreation` (an override wins; a discount
  //     already present at creation is INCLUDED), plus `wasPriceOverridden`. `costAtCreation` too.
  // Provenance & economics use *AtCreation (an overridden line → Other pricing); Manual-price-
  // changes uses resolved* + wasPriceOverridden (so we still know WHICH B2B pricing was overridden
  // — pricingSourceAtCreation alone would lose that). Adjustments AFTER creation (discount/refund/
  // edit/reversal) are ignored. The demo derives the snapshot from the seed (`line.revenue` =
  // applied value at creation; `overridden` = a manual price replaced a resolved B2B price; there
  // is no separate resolvedUnitPrice number in the seed). Both Overview and Pricing read this layer.
  // The ONE engine, extracted to `pricingAttribution.js` and shared with Company Analytics — see
  // PRICING-METRICS.md §0 for snapshot semantics (resolved* vs *AtCreation, two groups). §6.4
  // Pricing performance = named B2B profiles only (no "Other" row). Manual-price-changes was
  // removed from merchant-facing analytics; the snapshot still carries resolved*/wasPriceOverridden.
  const attributedLines = buildAttributedLines(orders, productCost);
  const pricingUsage = pricingProfileRows(attributedLines, productBySku);

  // §6.2 footprint — ORDER VALUE / orders that used B2B pricing at creation (line-level).
  // "Order value" (not "sales"): Σ initial line value on B2B-priced lines — a snapshot at
  // creation, deliberately NOT reconciled with Overview Net sales (which nets discounts/refunds).
  const b2bLines = attributedLines.filter((s) => s.isB2B);
  const b2bValue = b2bLines.reduce((a, s) => a + s.lineValue, 0);
  const b2bOrderIds = new Set(b2bLines.map((s) => s.order.id));
  const orderValueTotal = attributedLines.reduce((a, s) => a + s.lineValue, 0);
  const b2bValueShare = orderValueTotal ? (b2bValue / orderValueTotal) * 100 : 0;
  const orderCountAll = new Set(attributedLines.map((s) => s.order.id)).size;
  const b2bOrderShare = orderCountAll ? (b2bOrderIds.size / orderCountAll) * 100 : 0;

  // §6.1 core economics — ALL at the price applied WHEN THE ORDER WAS CREATED (not realized Net
  // sales/GP; those belong to Overview). Applied B2B vs Shopify compares B2B-priced lines' applied
  // value with their Shopify list; "Margin at order creation" = line GP / costed applied value;
  // "Order value below margin threshold" = initial line value of lines with margin-at-creation < floor.
  // "B2B price vs Shopify" = the PRICING-ENGINE metric: RESOLVED B2B price vs Shopify list, on
  // resolved-B2B lines whose resolved price is known (`resolvedLineValue`). Uses resolvedUnitPrice,
  // NOT the applied price — a draft discount present at creation must NOT drag it down (that shows
  // in margin / order value). Overridden lines are excluded (pre-override resolved price uncaptured).
  const resolvedPricedLines = attributedLines.filter((s) => s.resolvedLineValue !== null);
  const resolvedB2BValue = resolvedPricedLines.reduce((a, s) => a + s.resolvedLineValue, 0);
  const resolvedB2BReference = resolvedPricedLines.reduce((a, s) => a + (Number(productBySku(s.sku)?.list) || 0) * s.qty, 0);
  const b2bVsShopifyDelta = resolvedB2BValue - resolvedB2BReference;
  const b2bVsShopifyPct = resolvedB2BReference ? (b2bVsShopifyDelta / resolvedB2BReference) * 100 : null;
  // "Margin at order creation" & "Order value" use the APPLIED price at creation (incl. pre-creation discount).
  let appliedGP = 0;
  let appliedCostedValue = 0;
  attributedLines.forEach((s) => { if (s.lineCost !== null) { appliedGP += s.lineValue - s.lineCost; appliedCostedValue += s.lineValue; } });
  const appliedMargin = appliedCostedValue ? (appliedGP / appliedCostedValue) * 100 : null;
  const appliedMarginCoverage = orderValueTotal ? (appliedCostedValue / orderValueTotal) * 100 : null;
  const lineMarginAtCreation = (s) => { if (s.lineCost === null) return null; return s.lineValue ? ((s.lineValue - s.lineCost) / s.lineValue) * 100 : 0; };
  const marginFloor = Number(marginThreshold) || 20;
  const marginExceptionLines = attributedLines.filter((s) => { const m = lineMarginAtCreation(s); return m !== null && m < marginFloor; });
  const marginExceptionValue = marginExceptionLines.reduce((a, s) => a + s.lineValue, 0);
  const marginCostedValue = attributedLines.reduce((a, s) => a + (s.lineCost !== null ? s.lineValue : 0), 0);
  const marginCoverage = orderValueTotal ? (marginCostedValue / orderValueTotal) * 100 : null;
  const hasPricingFn = (c) => (c?.pricing?.base?.length > 0) || !!c?.pricing?.quantity;
  const activePolicyCount = (state.db.policies || []).filter((p) => p.status !== 'Inactive' && p.audienceType === 'b2b').length;
  const companiesWithPricing = scopedCompanies.filter(hasPricingFn).length;

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
  // Margin by pricing source (§6.3), at the price applied WHEN THE ORDER WAS CREATED. Two
  // groups (B2B pricing / Other pricing) from the shared attribution layer: revenue = Σ initial
  // line value, GP = Σ (initial value − costAtCreation×qty) on costed lines, margin = GP /
  // costed initial value, coverage = costed share. Later discounts/refunds/edits are excluded.
  const groupEcon = new Map();
  attributedLines.forEach((s) => {
    const cur = groupEcon.get(s.group) || { value: 0, cost: 0, costedValue: 0, costedN: 0 };
    cur.value += s.lineValue; // order value at creation (not realized sales)
    if (s.lineCost !== null) { cur.cost += s.lineCost; cur.costedValue += s.lineValue; cur.costedN += 1; }
    groupEcon.set(s.group, cur);
  });
  const b2bPricingValue = groupEcon.get('B2B pricing')?.value || 0;
  const otherPricingValue = groupEcon.get('Other pricing')?.value || 0;
  const pricingSourceRows = ['B2B pricing', 'Other pricing']
    .map((name) => {
      const e = groupEcon.get(name) || { value: 0, cost: 0, costedValue: 0, costedN: 0 };
      const gp = e.costedN ? e.costedValue - e.cost : null;
      return { name, value: e.value, gp, margin: e.costedN && e.costedValue ? (gp / e.costedValue) * 100 : null, coverage: e.value ? (e.costedValue / e.value) * 100 : null };
    })
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const pricingSourceMaxMargin = Math.max(1, ...pricingSourceRows.map((s) => s.margin).filter((m) => m !== null));

  // ── quote rows / cadence ────────────────────────────────────────────────────
  const quoteVal = (q) => (q.lines || []).reduce((s, l) => s + (Number(l.quoted) || 0) * (Number(l.qty) || 0), 0);
  // Two distinct clocks — do not conflate:
  //  • quoteAge     = how long the quote has existed (TODAY − created). "How old is it."
  //    Drives Open quote aging (§5.3) and the Age column in Quote detail.
  //  • quoteIdleAge = TODAY − last MEANINGFUL activity = the latest buyer/merchant
  //    timeline event, NOT the raw `updated` field (an internal metadata write can bump
  //    `updated` without any real activity). Drives Stale pipeline (§5.1). Falls back to
  //    `updated` then `created` only when a quote has no timeline.
  const quoteAge = (q) => {
    const c = String(q.created || q.updated || '').slice(0, 10);
    return c ? Math.max(0, Math.round((TODAY - new Date(c + 'T00:00:00')) / DAY)) : 0;
  };
  const lastActivity = (q) => {
    const dates = (q.timeline || []).map((e) => timelineDate(e.when)).filter(Boolean);
    if (dates.length) return new Date(Math.max(...dates.map((d) => d.getTime())));
    const f = String(q.updated || q.created || '').slice(0, 10);
    return f ? new Date(f + 'T00:00:00') : null;
  };
  const quoteIdleAge = (q) => {
    const d = lastActivity(q);
    return d ? Math.max(0, Math.round((TODAY - d) / DAY)) : 0;
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
  let activationRows = showEmpty ? [] : analyticsCompanyActivation.filter((a) => inPeriod(a.registered));
  if (selected) activationRows = activationRows.filter((a) => a.companyId === selected.id);
  const activationApproved = activationRows.filter((a) => a.approved);
  const activationPurchased = activationRows.filter((a) => a.firstOrder);
  const activationRate = activationApproved.length ? Math.round((activationPurchased.length / activationApproved.length) * 100) : null;
  const activationTypical = median(activationApproved.filter((a) => a.firstOrder).map((a) => daysBetween(a.approved, a.firstOrder)));

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
  // ── Discount / pricing analysis: three distinct questions (spec §5.7) ─────────
  // Per-quote pricing facts, computed once against BOTH baselines:
  //  • listVal/quotedVal   — vs Shopify LIST (stable, quote always ≤ list → ≥ 0).
  //  • coRefVal/coQuotedVal — only over lines that resolve to a COMPANY price
  //    (resolveDetail layer ≠ 'shopify'); used for a SIGNED variance (no clamp), since
  //    a quote can be priced above OR below the company's standing policy.
  //  • hasCompanyPricing    — did any priced line resolve from company pricing.
  const quotePricingInfo = (q) => {
    const company = companyById(q.company);
    let listVal = 0, quotedVal = 0, coRefVal = 0, coQuotedVal = 0, hasCompanyPricing = false;
    (q.lines || []).forEach((l) => {
      const product = productBySku(l.sku);
      if (!product) return;
      const quoted = Number(l.quoted);
      const qty = Number(l.qty) || 0;
      if (!Number.isFinite(quoted) || quoted <= 0 || qty <= 0) return;
      const list = Number(product.list) || 0;
      if (list > 0) { listVal += list * qty; quotedVal += quoted * qty; }
      const d = resolveDetail(company, product, policies, defaultVariant(product));
      if (d.layer !== 'shopify') {
        const ref = Number(d.price) || 0;
        if (ref > 0) { coRefVal += ref * qty; coQuotedVal += quoted * qty; hasCompanyPricing = true; }
      }
    });
    return {
      listDiscount: listVal > 0 ? Math.max(0, ((listVal - quotedVal) / listVal) * 100) : null,
      priceVariance: coRefVal > 0 ? ((coQuotedVal - coRefVal) / coRefVal) * 100 : null, // signed
      hasCompanyPricing, listVal, quotedVal, coRefVal, coQuotedVal,
    };
  };
  const periodPricing = quotes.map((q) => quotePricingInfo(q));
  const finalizedPricing = finalizedQuotes.map((q) => ({ won: q.status === 'Deal Closed', ...quotePricingInfo(q) }));

  // Metric 1 — Quoted discount vs Shopify LIST (discount depth). Weighted by list value.
  const listWeighted = periodPricing.reduce((a, x) => a + x.listVal, 0);
  const listQuotedWeighted = periodPricing.reduce((a, x) => a + x.quotedVal, 0);
  const avgListDiscount = listWeighted ? Math.max(0, ((listWeighted - listQuotedWeighted) / listWeighted) * 100) : null;
  const listDiscountRows = finalizedPricing.filter((x) => x.listDiscount != null);
  const discountBuckets = [
    { name: '0–5% off', min: 0, max: 5 },
    { name: '5–10% off', min: 5, max: 10 },
    { name: '10–15% off', min: 10, max: 15 },
    { name: '15%+ off', min: 15, max: 999 },
  ].map((b, i) => {
    const rows = listDiscountRows.filter((x) => x.listDiscount >= b.min && (i === 0 ? x.listDiscount <= b.max : x.listDiscount > b.min) && x.listDiscount <= b.max);
    const wins = rows.filter((x) => x.won).length;
    return { ...b, count: rows.length, wins, rate: rows.length ? Math.round((wins / rows.length) * 100) : null };
  });

  // Metric 2 — Price variance vs COMPANY pricing (adherence / override). SIGNED, no clamp:
  // + = quoted above the assigned company price, − = below. Only quotes with company pricing.
  const varWeighted = periodPricing.reduce((a, x) => a + x.coRefVal, 0);
  const varQuotedWeighted = periodPricing.reduce((a, x) => a + x.coQuotedVal, 0);
  const avgPriceVariance = varWeighted ? ((varQuotedWeighted - varWeighted) / varWeighted) * 100 : null;
  const varianceRows = finalizedPricing.filter((x) => x.priceVariance != null);
  const varianceBuckets = [
    { name: 'More than 5% above', test: (v) => v > 5 },
    { name: 'Within 5%', test: (v) => v >= -5 && v <= 5 },
    { name: '5–10% below', test: (v) => v < -5 && v >= -10 },
    { name: 'More than 10% below', test: (v) => v < -10 },
  ].map((b) => {
    const rows = varianceRows.filter((x) => b.test(x.priceVariance));
    const wins = rows.filter((x) => x.won).length;
    return { name: b.name, count: rows.length, wins, rate: rows.length ? Math.round((wins / rows.length) * 100) : null };
  });

  // Metric 3 — win rate WITH vs WITHOUT company pricing (does pricing context convert?).
  const winRateOf = (rows) => (rows.length ? Math.round((rows.filter((x) => x.won).length / rows.length) * 100) : null);
  const withPricing = finalizedPricing.filter((x) => x.hasCompanyPricing);
  const withoutPricing = finalizedPricing.filter((x) => !x.hasCompanyPricing);
  const winWithPricing = winRateOf(withPricing);
  const winWithoutPricing = winRateOf(withoutPricing);

  // ── quantity rules / pricing changes ────────────────────────────────────────
  const quantityEvents = showEmpty ? [] : analyticsQuantityEvents.filter((e) => inPeriod(e.date) && (activeCompanyId === 'all' || e.companyId === activeCompanyId));
  // §6.6 = quantity-pricing EFFECTIVENESS only: of the purchases eligible for a tier, how many
  // reached it (reach rate), the order value that went through tiers, and the discount realized.
  // The friction/potential/behavior signals (MOQ-blocked demand, near-threshold, later-recovered)
  // were cut from merchant-facing analytics — they measure demand/behavior, not whether quantity
  // pricing works. Keep those as internal telemetry if product wants to study them.
  const tierEvents = quantityEvents.filter((e) => e.type === 'tier_observed');
  const tierReachedEvents = tierEvents.filter((e) => e.reached);
  // Realized discount is value-weighted by the PRE-DISCOUNT reference value, not the post-discount
  // order value — a $1,000-reference order at 20% must carry weight $1,000, not $800. The event
  // holds the actual (post-discount) `orderValue`, so reference = orderValue / (1 − discount).
  const eventReference = (e) => { const d = (Number(e.realizedDiscount) || 0) / 100; return d < 1 ? (Number(e.orderValue) || 0) / (1 - d) : (Number(e.orderValue) || 0); };
  const wDiscount = (evs) => { const ref = evs.reduce((a, e) => a + eventReference(e), 0); return ref ? evs.reduce((a, e) => a + eventReference(e) * (Number(e.realizedDiscount) || 0), 0) / ref : null; };
  const tierEligible = tierEvents.length;
  const tierReached = tierReachedEvents.length;
  const tierReachRate = tierEligible ? (tierReached / tierEligible) * 100 : null;
  const tierOrderValue = tierReachedEvents.reduce((a, e) => a + (Number(e.orderValue) || 0), 0);
  const tierAvgDiscount = wDiscount(tierReachedEvents);
  const tierPolicies = [...new Set(tierEvents.map((e) => e.policy))].map((name) => {
    const es = tierEvents.filter((e) => e.policy === name);
    const reached = es.filter((e) => e.reached);
    return { name, eligible: es.length, reached: reached.length, reachRate: es.length ? (reached.length / es.length) * 100 : null, orderValue: reached.reduce((a, e) => a + (Number(e.orderValue) || 0), 0), discount: wDiscount(reached) };
  });
  const ruleChanges = showEmpty ? [] : analyticsPricingChanges.filter((r) => activeCompanyId === 'all' || r.companyId === activeCompanyId);

  // ── filter option lists ─────────────────────────────────────────────────────
  const companyOptions = [{ label: 'All companies', value: 'all' }, ...companies.map((c) => ({ label: c.name, value: c.id }))];
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
  const showClear = selected || period !== '3m' || compare !== 'none';
  const clearFilters = () => {
    setCompanyFilter(embeddedCompanyId || 'all');
    setPeriod('3m');
    setCompare('none');
    setCustomStart('');
    setCustomEnd('');
  };


  // Clickable company cell → drill into that company.
  const CompanyLink = ({ id, children }) => (
    <button
      type="button"
      onClick={() => setCompanyFilter(id)}
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

  // Stale pipeline — open quotes with no MEANINGFUL activity for >10 days (§3.4).
  // Uses quoteIdleAge (days since last buyer/merchant timeline event), not quoteAge.
  const staleQuotes = openQuotes.filter((q) => quoteIdleAge(q) > 10).map((q) => quoteVal(q)).sort((a, b) => b - a);
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
          empty="No completed sales in this period yet."
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
              note="Current snapshot · not affected by date range"
              cta="Review quotes →"
              onAction={() => setTab(2)}
            />
            {worstMargin && (
              <InsightCard
                headline={`Gross margin fell for ${worstMargin.name}`}
                value={`↓ ${worstMargin.drop.toFixed(1)} pp`}
                tone="critical"
                context={`${money(worstMargin.salesAffected)} sales affected this period`}
                note={worstMargin.coverage < 99.5 ? `Based on ${Math.round(worstMargin.coverage)}% cost coverage` : undefined}
                cta="Review pricing →"
                onAction={() => setTab(3)}
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
        // Count only — the trailing-90 GP + its cost coverage live on the §4.4 exposure
        // card, so the reliability disclosure ("Based on X% cost coverage") isn't shown
        // in one place and dropped in another for the same number.
        { label: 'Past buying cycle', value: String(pastCycleCompanies.length), foot: 'behind their usual reorder cadence' },
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
        <ReportCard
          title="Companies past their buying cycle"
          subtitle="Historical revenue from companies now past their normal reorder cadence — not a prediction of loss."
          help={
            <BlockStack gap="150">
              <Text as="span" variant="bodySm">Companies that are past their usual reorder cycle — Watch, At risk, or Inactive by relationship state.</Text>
              <Text as="span" variant="bodySm" tone="subdued">Sales and gross profit reflect the group's trailing 90 days of activity. These are historical figures, not a prediction of churn or future loss. When cost data is incomplete, gross profit shows the percentage of sales with cost data.</Text>
            </BlockStack>
          }
        >
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
        <ReportCard
          title="Location performance"
          subtitle="Location contribution in the selected period."
          help={<Text as="span" variant="bodySm">Each of this company's locations, with its sales, share of the company's sales, orders and average order value in the selected period.</Text>}
        >{companyPerfTable}</ReportCard>
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
          <ReportCard
            title="New vs existing revenue"
            subtitle="Revenue by whether the company first purchased in the selected period."
            help={
              <BlockStack gap="150">
                <Text as="span" variant="bodySm"><Text as="span" variant="bodySm" fontWeight="semibold">New</Text> — Revenue from companies whose first purchase falls within the selected period.</Text>
                <Text as="span" variant="bodySm"><Text as="span" variant="bodySm" fontWeight="semibold">Existing</Text> — Revenue from companies that first purchased before the selected period.</Text>
                <Text as="span" variant="bodySm" tone="subdued">Percentages show each cohort's share of total B2B sales in the period.</Text>
              </BlockStack>
            }
          >
            <StackedBar segments={[{ name: 'Existing companies', value: existingCompanyRevenue }, { name: 'New companies', value: newCompanyRevenue }]} />
            <Box paddingBlockStart="200">
              {/* Revenue mix — denominator is total B2B sales (existing + new = sales),
                  so these are existingCompanyRevenue/sales and newCompanyRevenue/sales. */}
              <Text as="p" tone="subdued" variant="bodySm">{`${pct(existingCompanyRevenue, sales)}% existing · ${pct(newCompanyRevenue, sales)}% new.`}</Text>
            </Box>
          </ReportCard>
        </InlineGrid>
      )}

      {!selected && (
        <>
          <ReportCard
            title="Company performance"
            subtitle="Value, gross profit, growth, reorder behaviour and relationship state per company."
            help={
              <BlockStack gap="150">
                <Text as="span" variant="bodySm">One row per company, combining performance for the selected period with its current relationship state.</Text>
                <Text as="span" variant="bodySm" tone="subdued">Sales, gross profit, margin, growth, and repeat revenue follow the selected period. Last order, typical reorder, and status reflect the company's current relationship state and are not limited by the date range.</Text>
              </BlockStack>
            }
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
            <BlockStack gap="025">
              <Text as="span" variant="bodySm" fontWeight="semibold">Registration cohort</Text>
              <Text as="span" variant="bodySm" tone="subdued">Companies are grouped by registration date, then tracked through approval and first purchase to date. Earlier cohorts may continue to increase as more companies convert.</Text>
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

  // ── QUOTES (spec §5) ────────────────────────────────────────────────────────
  const previousReceived = compareEnabled
    ? allQuotes.filter((q) => scopedIds.has(q.company) && inDateRange(q.created, previousPeriodStart, previousPeriodEnd)).length
    : 0;
  const quotesCreatedDelta = compareEnabled && previousReceived ? pctChange(received, previousReceived) : null;
  const quoteValueTotal = quotes.reduce((a, q) => a + quoteVal(q), 0); // §5.2 total quoted value (period)
  const avgQuoteValue = received ? quoteValueTotal / received : 0;

  // §5.3 typical time to decision — median over finalized (Won + Lost) quotes.
  const decisionDays = finalizedQuotes
    .map((q) => { const c = String(q.created || '').slice(0, 10); const u = String(q.updated || '').slice(0, 10); return c && u ? Math.max(0, daysBetween(c, u)) : null; })
    .filter((x) => x != null);
  const decisionMedian = median(decisionDays);

  // §5.5 pipeline distribution (Count | Value): quotes created in the period split by
  // their CURRENT state — each quote counted exactly once, so segments sum to 100% of
  // (non-trashed) RFQs. Replaces the old cumulative funnel: no "farthest stage reached" to
  // derive, so a quote rejected after negotiating simply lands in Lost instead of being
  // (mis)counted at Negotiating. Stages match spec §5.5: RFQ received → Negotiating → Won,
  // plus Lost. Trashed is EXCLUDED (spec: "Trashed = loại"), not shown as a stage.
  const stageValue = (qs) => qs.reduce((a, q) => a + quoteVal(q), 0);
  const pricedSet = new Set(pricedQuotes); // reuse the priced/sent signal from `pricedQuotes` (§5.5)
  const distOpen = quotes.filter((q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status));
  const distBuckets = [
    { name: 'Received', qs: distOpen.filter((q) => !pricedSet.has(q)) },
    { name: 'Negotiating', qs: distOpen.filter((q) => pricedSet.has(q)) },
    { name: 'Won', qs: quotes.filter((q) => q.status === 'Deal Closed') },
    { name: 'Lost', qs: quotes.filter((q) => q.status === 'Deal Rejected') },
  ];
  const distMetricOf = (qs) => (quoteFunnelMode === 'value' ? stageValue(qs) : qs.length);
  const distSegments = distBuckets
    .map((s) => ({ name: s.name, value: distMetricOf(s.qs) }))
    .filter((s) => s.value > 0);

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
  const varianceMaxRate = Math.max(1, ...varianceBuckets.map((x) => x.rate || 0));

  // §5.7 win rate by deal size (advanced). Always carries its sample size.
  const dealSizeBuckets = [
    { name: '< $2k', min: 0, max: 2000 },
    { name: '$2k–$10k', min: 2000, max: 10000 },
    { name: '$10k–$50k', min: 10000, max: 50000 },
    { name: '$50k+', min: 50000, max: Infinity },
  ].map((b) => {
    const rows = finalizedQuotes.filter((q) => { const v = quoteVal(q); return v >= b.min && v < b.max; });
    const wins = rows.filter((q) => q.status === 'Deal Closed').length;
    return { ...b, count: rows.length, wins, rate: rows.length ? Math.round((wins / rows.length) * 100) : null };
  });
  const dealSizeMaxRate = Math.max(1, ...dealSizeBuckets.map((b) => b.rate || 0));
  const quoteDetailTable = (
    <IndexTable
      resourceName={{ singular: 'quote', plural: 'quotes' }}
      itemCount={quotes.length}
      selectable={false}
      headings={[
        { title: <HeadHelp label="Quote" help="Quote record." /> },
        { title: <HeadHelp label="Status" help="Current quote status." /> },
        { title: <HeadHelp label="Age" help="Number of days since the quote was created." />, alignment: 'end' },
        { title: <HeadHelp label="Quoted value" help="Total quoted value across all lines in the quote." />, alignment: 'end' },
      ]}
      emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No RFQs.</Text></Box>}
    >
      {quotes.map((q, i) => (
        <IndexTable.Row id={q.id} key={q.id} position={i}>
          <IndexTable.Cell>{q.id}</IndexTable.Cell>
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
          { label: 'Open quote value', value: money(openQuoteValue), foot: `${openQuotes.length} open quote${openQuotes.length === 1 ? '' : 's'}`, help: 'Total value of quotes that are still open. This is a current snapshot and is not limited to the selected period.' },
          { label: 'Win rate by value', value: winRateValue == null ? '—' : `${winRateValue}%`, foot: `${moneyShort(wonValue)} won of ${moneyShort(finalizedValue)} finalized`, help: 'Share of won quote value among all quote value that was won or lost in the selected period.' },
          { label: 'Stale quote value', value: money(staleValue), foot: `${staleQuotes.length} quote${staleQuotes.length === 1 ? '' : 's'} idle >10 days`, help: 'Value of open quotes with no activity for more than 10 days.' },
          { label: 'First response time', value: formatTypicalTime(responseMedian), foot: 'median RFQ → first response', help: 'Median time from quote creation to the first time the quote was priced or sent.' },
        ]}
      />

      {/* §5.2 — baseline metric strip */}
      <MiniCompare
        items={[
          { label: 'Quotes created', value: String(received), help: 'Number of quotes created in the selected period.' },
          { label: 'Total quoted value', value: money(quoteValueTotal), help: 'Total quoted value of quotes created in the selected period.' },
          { label: 'Won quotes', value: String(wonQuotes.length), help: 'Number of quotes won in the selected period.' },
          { label: 'Lost quotes', value: String(lostQuotes.length), help: 'Number of quotes lost in the selected period.' },
          { label: 'Average quote value', value: money(avgQuoteValue), help: 'Average quoted value of quotes created in the selected period.' },
          { label: 'Win rate by count', value: winRateCount == null ? '—' : `${winRateCount}%`, help: 'Share of won quotes among all quotes that were won or lost in the selected period.' },
        ]}
      />

      {/* §5.3 aging + §5.5 cohort funnel */}
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="Open quote aging" help="Value of quotes that are still open, grouped by how long ago they were created. Bars represent quoted value, not the number of quotes.">
          <RankBars rows={agingBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} quote${b.count === 1 ? '' : 's'} still open`, value: b.value, width: (b.value / agingMaxVal) * 100, valueLabel: money(b.value) }))} empty="No quotes still open." />
        </ReportCard>
        <ReportCard
          title="Quote status distribution"
          help="Shows how quotes in the selected period are split by their current status. Each quote is counted once. Switch between Count and Value to view the number of quotes or their quoted value."
          controls={
            <div style={{ display: 'inline-flex', border: '1px solid var(--p-color-border)', borderRadius: 8, overflow: 'hidden' }}>
              {[['count', 'Count'], ['value', 'Value']].map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => setQuoteFunnelMode(m)} style={{ padding: '5px 12px', border: 0, cursor: 'pointer', font: 'inherit', background: quoteFunnelMode === m ? 'var(--p-color-bg-fill-brand)' : 'transparent', color: quoteFunnelMode === m ? 'var(--p-color-text-brand-on-bg-fill)' : 'var(--p-color-text)' }}>{lbl}</button>
              ))}
            </div>
          }
        >
          <StackedBar segments={distSegments} format={quoteFunnelMode === 'value' ? moneyShort : (v) => String(v)} />
        </ReportCard>
      </InlineGrid>

      {/* §5.4 sales cycle */}
      <ReportCard title="Median time to decision" help="Median time from quote creation until the quote was won or lost.">
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
          title="Advanced quote analysis"
          subtitle="Explore patterns associated with won and lost quotes. Small samples can be noisy, and these patterns do not prove cause and effect."
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
                    { title: <HeadHelp label="Company" help="Company associated with these quotes." /> },
                    { title: <HeadHelp label="Quotes" help="Number of quotes for this company in the selected period." />, alignment: 'end' },
                    { title: <HeadHelp label="Quoted value" help="Total quoted value of this company's quotes." />, alignment: 'end' },
                    { title: <HeadHelp label="Open quote value" help="Quoted value of this company's quotes that are still open." />, alignment: 'end' },
                    { title: <HeadHelp label="Win rate (count)" help="Share of won quotes among this company's quotes that were won or lost." />, alignment: 'end' },
                    { title: <HeadHelp label="Win rate (value)" help="Share of won quote value among this company's quote value that was won or lost." />, alignment: 'end' },
                    { title: <HeadHelp label="First response time" help="Median time from quote creation to the first time it was priced or sent, for this company." />, alignment: 'end' },
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
              <Text as="h4" variant="headingXs">Win rate analysis</Text>
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <Box borderColor="border" borderWidth="025" borderRadius="300" padding="400">
                  <BlockStack gap="150">
                    <HeadingHelp label="Win rate by deal size" help="Shows how win rate changes across quote value ranges." />
                    <RankBars rows={dealSizeBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} won or lost quote${b.count === 1 ? '' : 's'}`, width: b.rate == null ? 0 : (b.rate / dealSizeMaxRate) * 100, valueLabel: b.rate == null ? '—' : `${b.wins} of ${b.count} won · ${b.rate}%` }))} empty="No won or lost quotes." />
                  </BlockStack>
                </Box>
                <Box borderColor="border" borderWidth="025" borderRadius="300" padding="400">
                  <BlockStack gap="150">
                    <HeadingHelp label="Win rate by discount" help="Shows how win rate changes at different discount levels from the Shopify price." />
                    <MiniCompare plain items={[{ label: 'Average discount vs Shopify', value: avgListDiscount == null ? '—' : `${avgListDiscount.toFixed(1)}%`, sub: 'Weighted by the Shopify value of each quote.', help: 'Average discount from Shopify price, weighted by the Shopify value of each quote.' }]} />
                    <RankBars rows={discountBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} won or lost quote${b.count === 1 ? '' : 's'}`, width: b.rate == null ? 0 : (b.rate / maxDiscountRate) * 100, valueLabel: b.rate == null ? '—' : `${b.rate}% won` }))} empty="No won or lost quotes." />
                  </BlockStack>
                </Box>
                <Box borderColor="border" borderWidth="025" borderRadius="300" padding="400">
                  <BlockStack gap="150">
                    <HeadingHelp label="Quoted price vs company pricing" help="Shows how quoted prices compare with the pricing already assigned to each company." />
                    <MiniCompare plain items={[{ label: 'Average difference from company pricing', value: avgPriceVariance == null ? '—' : `${avgPriceVariance > 0 ? '+' : ''}${avgPriceVariance.toFixed(1)}%`, sub: avgPriceVariance == null ? 'No quotes with company pricing in this period.' : `Quotes were ${Math.abs(avgPriceVariance).toFixed(1)}% ${avgPriceVariance >= 0 ? 'higher' : 'lower'} than assigned company prices on average.`, help: 'Average difference between quoted prices and assigned company prices, weighted by value. Positive means quoted prices were higher; negative means they were lower.' }]} />
                    <RankBars rows={varianceBuckets.map((b) => ({ key: b.name, name: b.name, sub: `${b.count} won or lost quote${b.count === 1 ? '' : 's'}`, width: b.rate == null ? 0 : (b.rate / varianceMaxRate) * 100, valueLabel: b.rate == null ? '—' : `${b.rate}% won` }))} empty="No won or lost quotes with company pricing." />
                  </BlockStack>
                </Box>
                <Box borderColor="border" borderWidth="025" borderRadius="300" padding="400">
                  <BlockStack gap="150">
                    <HeadingHelp label="Win rate with vs without company pricing" help="Compares win rate for quotes where the company had assigned pricing at quote time with quotes based on Shopify price only." />
                    <MiniCompare plain items={[
                      { label: 'Company pricing', value: winWithPricing == null ? '—' : `${winWithPricing}%`, sub: `${withPricing.length} won or lost quote${withPricing.length === 1 ? '' : 's'}`, help: 'Win rate for quotes where the company had assigned pricing at quote time.' },
                      { label: 'Shopify price only', value: winWithoutPricing == null ? '—' : `${winWithoutPricing}%`, sub: withoutPricing.length === 0 ? 'No won or lost quotes in this period.' : `${withoutPricing.length} won or lost quote${withoutPricing.length === 1 ? '' : 's'}`, help: 'Win rate for quotes where no company pricing was assigned and Shopify price was used as the reference.' },
                    ]} />
                  </BlockStack>
                </Box>
              </InlineGrid>
            </BlockStack>
          ) : (
            <Text as="p" tone="subdued" variant="bodySm">Win rate by company, deal size, quoted discount, and how quoted prices compare to company pricing — each with its sample size.</Text>
          )}
        </ReportCard>
      )}
    </BlockStack>
  );

  // ── PRICING & MARGIN (spec §6) ──────────────────────────────────────────────
  const provenanceSegments = [
    { name: 'B2B pricing', value: b2bPricingValue },
    { name: 'Other pricing', value: otherPricingValue },
  ].filter((s) => s.value > 0);
  const pricingTab = (
    <BlockStack gap="500">
      {/* §6.1 — core economics, ALL at the price applied when the order was created */}
      <ScoreGrid
        items={[
          { label: 'B2B price vs Shopify', value: b2bVsShopifyPct == null ? '—' : `${Math.abs(b2bVsShopifyPct).toFixed(1)}% ${b2bVsShopifyDelta >= 0 ? 'higher' : 'lower'}`, foot: `${money(Math.abs(b2bVsShopifyDelta))} ${b2bVsShopifyDelta >= 0 ? 'above' : 'below'} Shopify on B2B-priced lines`, help: 'How B2B prices compare with Shopify prices on lines where app pricing was applied. Uses the price resolved by the app before any additional discount or later adjustment.' },
          { label: 'Margin at order creation', value: pct1N(appliedMargin), foot: appliedMarginCoverage != null && appliedMarginCoverage < 99.5 ? `${moneyN(appliedGP)} GP · ${Math.round(appliedMarginCoverage)}% cost coverage` : `${moneyN(appliedGP)} gross profit`, help: 'Gross margin based on the price on each line when the order was created. Later refunds, returns, or price adjustments are not included.' },
          { label: 'Orders using B2B pricing', value: orderCountAll ? `${Math.round(b2bOrderShare)}%` : '—', foot: `${b2bOrderIds.size} of ${orderCountAll} order${orderCountAll === 1 ? '' : 's'}`, help: 'Share of orders with at least one line using pricing created from the app when the order was created.' },
          { label: 'Order value below margin threshold', value: money(marginExceptionValue), foot: `${marginExceptionLines.length} line${marginExceptionLines.length === 1 ? '' : 's'} below ${marginFloor}% margin${marginCoverage != null && marginCoverage < 99.5 ? ` · Based on ${Math.round(marginCoverage)}% cost coverage` : ''}`, help: 'Order value from lines whose margin at order creation is below the selected threshold. Lines without cost data are excluded.' },
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
          { label: 'Active pricing agreements', value: String(activePolicyCount), help: 'Number of B2B pricing agreements that are currently active.' },
          { label: 'Companies with pricing', value: String(companiesWithPricing), help: 'Number of companies that currently have pricing created from the app assigned.' },
          { label: 'Order value using B2B pricing', value: money(b2bValue), sub: `${Math.round(b2bValueShare)}% of order value`, help: 'Order value from lines that used pricing created from the app when the order was created.' },
        ]}
      />

      {/* §6.3 provenance + margin by source */}
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <ReportCard title="Order value by pricing source" help="Shows how order value is split between B2B pricing and other pricing, based on the price source used when each order line was created.">
          <StackedBar segments={provenanceSegments} />
        </ReportCard>
        <ReportCard title="Margin by pricing source" help="Compares margin at order creation between lines using B2B pricing and lines using other pricing. Later refunds, returns, and price adjustments are excluded.">
          <RankBars rows={pricingSourceRows.map((s) => ({ key: s.name, name: s.name, sub: `${money(s.value)} order value · ${moneyN(s.gp)} gross profit${s.coverage != null && s.coverage < 99.5 ? ` · ${Math.round(s.coverage)}% cost coverage` : ''}`, value: s.margin ?? 0, width: s.margin == null ? 0 : (s.margin / pricingSourceMaxMargin) * 100, valueLabel: pctN(s.margin) }))} empty="No completed orders." />
        </ReportCard>
      </InlineGrid>

      {/* §6.4 — pricing performance table (sorted by gross profit) */}
      <ReportCard title="Pricing performance" subtitle="Order value, gross profit, margin and price vs Shopify, by B2B pricing profile. Hover a column heading for its definition.">
        <IndexTable
          resourceName={{ singular: 'pricing', plural: 'pricings' }}
          itemCount={pricingUsage.length}
          selectable={false}
          headings={[
            { title: <HeadHelp label="Pricing" help="The B2B pricing profile that set the price for these order lines." /> },
            { title: <HeadHelp label="Order value" help="Total value of order lines that used this pricing when the order was created." />, alignment: 'end' },
            { title: <HeadHelp label="Gross profit" help="Order value minus product cost for lines with known cost data." />, alignment: 'end' },
            { title: <HeadHelp label="Margin" help="Gross profit as a share of order value for lines with known cost data." />, alignment: 'end' },
            { title: <HeadHelp label="vs Shopify" help="How this pricing's resolved prices compare with Shopify prices across the lines it priced. Larger-value lines carry more weight." />, alignment: 'end' },
            { title: <HeadHelp label="Orders" help="Number of distinct orders with at least one line using this pricing." />, alignment: 'end' },
            { title: <HeadHelp label="Companies" help="Number of distinct companies with at least one order line using this pricing." />, alignment: 'end' },
          ]}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No pricing usage on completed orders.</Text></Box>}
        >
          {pricingUsage.map((r, i) => (
            <IndexTable.Row id={r.name} key={r.name} position={i}>
              <IndexTable.Cell>{r.name}</IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{money(r.value)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{moneyN(r.gp)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{pctN(r.margin)}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.deltaPct == null ? '—' : `${Math.abs(r.deltaPct).toFixed(1)}% ${r.deltaPct >= 0 ? 'higher' : 'lower'}`}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.orders}</Text></IndexTable.Cell>
              <IndexTable.Cell><Text as="span" alignment="end">{r.companies}</Text></IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </ReportCard>

      {/* §6.6 — MOQ / quantity pricing */}
      <ReportCard title="Quantity pricing effectiveness" subtitle="Of the purchases eligible for a quantity tier, how many reached it, the order value that went through tiers, and the discount realized.">
        <BlockStack gap="300">
          <MiniCompare
            items={[
              { label: 'Tier reach rate', value: tierReachRate == null ? '—' : `${Math.round(tierReachRate)}%`, sub: `${tierReached} of ${tierEligible} eligible purchase${tierEligible === 1 ? '' : 's'} reached a tier`, help: 'Share of eligible purchases that reached the quantity required for a pricing tier.' },
              { label: 'Order value at reached tiers', value: money(tierOrderValue), help: 'Total order value from purchases that reached a quantity pricing tier.' },
              { label: 'Average tier discount', value: tierAvgDiscount == null ? '—' : `${tierAvgDiscount.toFixed(1)}%`, help: 'Average discount on purchases that reached a quantity tier, weighted by the value before the tier discount.' },
            ]}
          />
          <IndexTable
            resourceName={{ singular: 'policy', plural: 'policies' }}
            itemCount={tierPolicies.length}
            selectable={false}
            headings={[
              { title: <HeadHelp label="Quantity pricing" help="The quantity pricing rule being evaluated." /> },
              { title: <HeadHelp label="Eligible purchases" help="Number of purchases where this quantity pricing tier could be reached." />, alignment: 'end' },
              { title: <HeadHelp label="Reached tier" help="Number of eligible purchases that reached the quantity required for this tier." />, alignment: 'end' },
              { title: <HeadHelp label="Reach rate" help="Share of eligible purchases that reached this tier." />, alignment: 'end' },
              { title: <HeadHelp label="Order value at tier" help="Total order value from purchases that reached this tier." />, alignment: 'end' },
              { title: <HeadHelp label="Tier discount" help="Average discount received when this tier was reached, weighted by the value before the tier discount." />, alignment: 'end' },
            ]}
            emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No quantity-rule observations in this scope.</Text></Box>}
          >
            {tierPolicies.map((r, i) => (
              <IndexTable.Row id={r.name} key={r.name} position={i}>
                <IndexTable.Cell>{r.name}</IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.eligible}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.reached}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{r.reachRate == null ? '—' : `${Math.round(r.reachRate)}%`}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{money(r.orderValue)}</Text></IndexTable.Cell>
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
              <Text as="p" tone="subdued" variant="bodySm">Compares business outcomes before and after a pricing change using equal time windows. This shows what changed over time, not what caused the change.</Text>
              <IndexTable
                resourceName={{ singular: 'change', plural: 'changes' }}
                itemCount={ruleChanges.length}
                selectable={false}
                headings={[{ title: 'Date' }, { title: 'Scope' }, { title: 'Rule change' }, { title: 'Window', alignment: 'end' }, { title: 'Sales before', alignment: 'end' }, { title: 'Sales after', alignment: 'end' }, { title: 'AOV before', alignment: 'end' }, { title: 'AOV after', alignment: 'end' }, { title: 'Δ before', alignment: 'end' }, { title: 'Δ after', alignment: 'end' }]}
                emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No tracked pricing changes in this scope.</Text></Box>}
              >
                {ruleChanges.map((r, i) => (
                  <IndexTable.Row id={`${r.date}-${i}`} key={i} position={i}>
                    <IndexTable.Cell>{r.date}</IndexTable.Cell>
                    <IndexTable.Cell>{r.scope}</IndexTable.Cell>
                    <IndexTable.Cell><BlockStack gap="050"><Text as="span">{r.rule}</Text><Text as="span" tone="subdued" variant="bodySm">{r.change}</Text></BlockStack></IndexTable.Cell>
                    <IndexTable.Cell><Text as="span" alignment="end">{r.windowDays ? `±${r.windowDays}d` : '—'}</Text></IndexTable.Cell>
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

  const tabContent = [overviewTab, companiesTab, quotesTab, pricingTab][tab];

  const content = (
    <BlockStack gap="400">
      {SHOW_DEV_TOOLS && (
        <Box background="bg-surface-secondary" borderColor="border" borderWidth="025" borderRadius="200" padding="200">
          <BlockStack gap="200">
            <InlineStack gap="200" blockAlign="center" wrap>
              <Badge tone="info">Dev</Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                {genuinelyEmpty
                  ? 'No B2B orders or quotes exist, so Analytics is showing its empty state.'
                  : devEmpty
                  ? 'Previewing the empty state — B2B data actually exists.'
                  : 'Preview the Analytics empty state (how it looks for a brand-new merchant with no orders or quotes).'}
              </Text>
              <Button size="slim" pressed={devEmpty} disabled={genuinelyEmpty} onClick={() => setDevEmpty((v) => !v)}>
                {devEmpty ? 'Show data' : 'Preview empty state'}
              </Button>
            </InlineStack>
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
            <InlineStack gap="200" blockAlign="center" wrap>
              <Badge tone="info">Dev</Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                {devMissingCost
                  ? `Missing cost injected: ${DEV_MISSING_COST_SKU} has no unit cost, so its lines drop from GP/Margin. Cost coverage now shows on Margin at order creation, the "Order value below margin threshold" card and Margin by pricing source.`
                  : `Strip the unit cost from ${DEV_MISSING_COST_SKU} to demo the cost-coverage disclosures (they stay hidden while every product is costed).`}
              </Text>
              <Button size="slim" pressed={devMissingCost} onClick={() => setDevMissingCost((v) => !v)}>
                {devMissingCost ? 'Reset missing cost' : 'Inject missing cost'}
              </Button>
            </InlineStack>
          </BlockStack>
        </Box>
      )}
      {showEmpty && (
        <Banner tone="info">
          You don't have any B2B orders or quotes yet. As your companies start ordering and you send quotes, performance across companies, quotes and pricing will fill in below.
        </Banner>
      )}
      <Card>
        <BlockStack gap="300">
          <InlineStack gap="300" wrap blockAlign="end">
            <div style={{ minWidth: 150 }}><Select label="Date range" options={periodOptions} value={period} onChange={setPeriod} disabled={showEmpty} /></div>
            {period === 'custom' && (
              <>
                <div style={{ minWidth: 150 }}><TextField label="Start date" type="date" value={customStart} onChange={setCustomStart} autoComplete="off" /></div>
                <div style={{ minWidth: 150 }}><TextField label="End date" type="date" value={customEnd} onChange={setCustomEnd} autoComplete="off" /></div>
              </>
            )}
            <div style={{ minWidth: 160 }}><Select label="Compare to" options={compareOptions} value={compare} onChange={setCompare} disabled={showEmpty} /></div>
            {!embeddedCompanyId && <div style={{ minWidth: 190 }}><Select label="Company" options={companyOptions} value={companyFilter} onChange={setCompanyFilter} disabled={showEmpty} /></div>}
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
