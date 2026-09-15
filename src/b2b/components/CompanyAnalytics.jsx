import React, { useState } from 'react';
import { Card, BlockStack, InlineGrid, InlineStack, Box, Text, Badge, Divider, Tooltip, Select, Button, Tabs, IndexTable } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { moneyShort, LineChart, RankBars, Timeline } from './charts.jsx';
import { buildAttributedLines, pricingProfileRows, appliedEconomics } from '../pricingAttribution.js';
import { analyticsPricingChanges, analyticsQuantityEvents, analyticsOrderItems } from '../data/analytics.js';

// ── Company Analytics — account intelligence: everything compares the company with ITS OWN
// history, not the portfolio. Four tabs (Overview / Buying / Quotes / Pricing). Metrics that
// already exist in the global Quotes/Pricing tabs REUSE the exact same definitions + snapshot
// rules (pricingAttribution.js) — Company Analytics only adds company scope. Demo anchor TODAY
// matches the analytics screen.
const TODAY = new Date('2026-08-24T00:00:00');
const DAY = 86400000;
const COMPLETED = new Set(['Fulfilled', 'Paid']);
const OPEN_QUOTE_EXCLUDE = new Set(['Deal Closed', 'Deal Rejected', 'Trashed']);
const FINALIZED = new Set(['Deal Closed', 'Deal Rejected']);
const SENT_PROGRESS = new Set(['Email Sent', 'PDF Exported', 'Draft Order Created', 'Auto Confirmed']);
const MARGIN_FLOOR = 20;
const MIN_HISTORY_FOR_LAPSED = 8; // "Previously frequent" needs enough history to be meaningful
const STATE_TONE = { Healthy: 'success', Watch: 'attention', 'At risk': 'warning', Inactive: 'critical', 'Insufficient history': undefined };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toDate = (d) => new Date(String(d).slice(0, 10) + 'T00:00:00');
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
const daysAgo = (d) => Math.round((TODAY - toDate(d)) / DAY);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const median = (arr) => {
  const a = arr.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const pctChange = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const fmtDate = (d) => toDate(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
const fmtDur = (d) => (d == null || !Number.isFinite(d) ? '—' : d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${d.toFixed(1)}d`);
const timelineDate = (label, year) => {
  const m = String(label || '').match(/([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  return mi < 0 ? null : new Date(year, mi, Number(m[2]));
};

function DeltaChip({ v }) {
  if (v == null) return null;
  return <Text as="span" variant="bodySm" tone={v > 0 ? 'success' : v < 0 ? 'critical' : 'subdued'}>{`${v > 0 ? '↑ ' : v < 0 ? '↓ ' : ''}${Math.abs(v)}%`}</Text>;
}
function Stat({ label, value, sub, help, tone, delta }) {
  return (
    <BlockStack gap="050">
      {help ? (
        <Tooltip content={help} preferredPosition="above" width="wide">
          <Text as="span" tone="subdued" variant="bodySm"><span style={{ cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}>{label}</span></Text>
        </Tooltip>
      ) : <Text as="span" tone="subdued" variant="bodySm">{label}</Text>}
      <Text as="span" variant="headingLg" tone={tone}>{value}</Text>
      {(sub || delta) ? <InlineStack gap="150" blockAlign="center" wrap={false}>{delta || null}{sub ? <Text as="span" tone="subdued" variant="bodySm">{sub}</Text> : null}</InlineStack> : null}
    </BlockStack>
  );
}
function SectionCard({ title, subtitle, action, children }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="300" wrap>
          <BlockStack gap="050"><Text as="h3" variant="headingSm">{title}</Text>{subtitle ? <Text as="p" tone="subdued" variant="bodySm">{subtitle}</Text> : null}</BlockStack>
          {action || null}
        </InlineStack>
        {children}
      </BlockStack>
    </Card>
  );
}
function ShiftRow({ label, prev, cur, fmt = (x) => String(x) }) {
  return (
    <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
      <Text as="span" tone="subdued" variant="bodySm">{label}</Text>
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <Text as="span" variant="bodyMd" tone="subdued">{fmt(prev)}</Text>
        <Text as="span" variant="bodyMd" tone="subdued">→</Text>
        <Text as="span" variant="headingMd" tone={cur > prev ? 'success' : cur < prev ? 'critical' : undefined}>{fmt(cur)}</Text>
      </InlineStack>
    </InlineStack>
  );
}
function TimelineRow({ e, first }) {
  return (
    <div>
      {first ? null : <Divider />}
      <Box paddingBlock="200">
        <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <div style={{ minWidth: 56 }}><Text as="span" tone="subdued" variant="bodySm">{fmtDate(e.date)}</Text></div>
            <Text as="span" variant="bodyMd" fontWeight={e.milestone ? 'semibold' : undefined} tone={e.tone}>{e.title}</Text>
          </InlineStack>
          {e.detail ? <Text as="span" tone="subdued" variant="bodySm">{e.detail}</Text> : null}
        </InlineStack>
      </Box>
    </div>
  );
}

export function CompanyAnalytics({ company }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState('3m');
  const [compare, setCompare] = useState('previous');
  const [adoptionMode, setAdoptionMode] = useState('orders'); // orders | value

  const products = state.db.products || [];
  const allQuotes = state.db.quotes || [];
  const productBySku = (sku) => products.find((p) => p.sku === sku);
  const productCost = (sku) => { const c = productBySku(sku)?.cost; return c == null ? null : Number(c) || 0; };
  const orderItems = (o) => analyticsOrderItems[o.id] || [];
  const skuName = (s) => productBySku(s)?.title || s;
  const goTab = (id) => dispatch({ type: 'SET_COMPANY_TAB', tab: id });

  // ── date range ───────────────────────────────────────────────────────────────
  const monthsN = period === '6m' ? 6 : period === '12m' ? 12 : period === '30d' ? 1 : 3;
  const rangeStart = period === '30d' ? addDays(TODAY, -29) : addDays(addMonths(TODAY, -monthsN), 1);
  const spanDays = Math.round((TODAY - rangeStart) / DAY) + 1;
  const prevEnd = addDays(rangeStart, -1);
  const prevStart = addDays(prevEnd, -(spanDays - 1));
  const cmp = compare === 'previous';
  const inRange = (d, s, e) => { const t = toDate(d); return t >= s && t <= e; };
  const inPeriod = (d) => inRange(d, rangeStart, TODAY);
  const inPrev = (d) => inRange(d, prevStart, prevEnd);

  // ── orders / quotes ──────────────────────────────────────────────────────────
  const attach = (o) => ({ ...o, companyId: company.id, items: orderItems(o) });
  const allCompleted = (company.orders || []).filter((o) => COMPLETED.has(o.status)).map(attach).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const periodOrders = allCompleted.filter((o) => inPeriod(o.date));
  const prevOrders = allCompleted.filter((o) => inPrev(o.date));
  const companyQuotes = allQuotes.filter((q) => q.company === company.id);
  const openQuotes = companyQuotes.filter((q) => !OPEN_QUOTE_EXCLUDE.has(q.status));
  const periodQuotes = companyQuotes.filter((q) => inPeriod(q.created));

  const quoteVal = (q) => (q.lines || []).reduce((s, l) => s + (Number(l.quoted) || 0) * (Number(l.qty) || 0), 0);
  const openQuoteValue = openQuotes.reduce((s, q) => s + quoteVal(q), 0);

  const orderStat = (os) => {
    const n = os.length; const rev = os.reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const lines = os.reduce((a, o) => a + (o.items || []).length, 0);
    return { n, rev, aov: n ? rev / n : 0, prods: n ? lines / n : 0 };
  };
  const curS = orderStat(periodOrders);
  const prevS = orderStat(prevOrders);
  const salesDelta = cmp ? pctChange(curS.rev, prevS.rev) : null;
  const ordersDelta = cmp ? pctChange(curS.n, prevS.n) : null;
  const aovDelta = cmp ? pctChange(curS.aov, prevS.aov) : null;

  // ── buying rhythm (all-time) ─────────────────────────────────────────────────
  const intervals = allCompleted.slice(1).map((o, i) => daysBetween(allCompleted[i].date, o.date)).filter((n) => n > 0);
  const typical = intervals.length >= 3 ? median(intervals) : null;
  const last = allCompleted.length ? allCompleted[allCompleted.length - 1].date : null;
  const since = last ? daysAgo(last) : null;
  const ratio = typical != null && since != null && typical > 0 ? since / typical : null;
  const overdue = typical != null && since != null ? Math.max(0, since - typical) : null;
  const relState = allCompleted.length < 4 || ratio == null ? 'Insufficient history' : ratio <= 1.25 ? 'Healthy' : ratio <= 1.5 ? 'Watch' : ratio <= 2 ? 'At risk' : 'Inactive';

  // ── quotes: win rate / response / decision ───────────────────────────────────
  const wonAll = companyQuotes.filter((q) => q.status === 'Deal Closed');
  const wonP = periodQuotes.filter((q) => q.status === 'Deal Closed');
  const lostP = periodQuotes.filter((q) => q.status === 'Deal Rejected');
  const finalizedP = wonP.length + lostP.length;
  const winRateCount = finalizedP ? Math.round((wonP.length / finalizedP) * 100) : null;
  // resolvedAt = when the quote became Won/Lost. Prefer an explicit field; else the latest timeline
  // event (the resolution). NOT `updated` — a won quote can keep being edited afterwards.
  const resolvedAt = (q) => {
    if (q.resolvedAt) return String(q.resolvedAt).slice(0, 10);
    const ds = (q.timeline || []).map((e) => timelineDate(e.when, toDate(String(q.created || TODAY)).getFullYear())).filter(Boolean);
    if (ds.length) { const d = new Date(Math.max(...ds.map((x) => x.getTime()))); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    return String(q.updated || '').slice(0, 10) || null;
  };
  const decisionMedian = median(periodQuotes.filter((q) => FINALIZED.has(q.status)).map((q) => { const c = String(q.created || '').slice(0, 10); const r = resolvedAt(q); return c && r ? Math.max(0, daysBetween(c, r)) : null; }).filter((x) => x != null));
  const responseMedian = median(companyQuotes.filter((q) => SENT_PROGRESS.has(q.progress) || q.status === 'Deal Closed').map((q) => {
    const created = String(q.created || '').slice(0, 10); if (!created) return null;
    const first = (q.timeline || []).find((e) => /sent|priced|exported|email/i.test(String(e.what || '')));
    const d = first ? timelineDate(first.when, toDate(created).getFullYear()) : null;
    return d ? Math.max(0, (d - toDate(created)) / DAY) : null;
  }).filter((x) => x != null));
  const lastActivity = (q) => { const ds = (q.timeline || []).map((e) => timelineDate(e.when, toDate(String(q.created || '')).getFullYear())).filter(Boolean); const latest = ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : toDate(String(q.updated || q.created || '')); return latest ? Math.max(0, Math.round((TODAY - latest) / DAY)) : null; };
  const quoteAge = (q) => { const c = String(q.created || '').slice(0, 10); return c ? Math.max(0, daysAgo(c)) : 0; };
  const staleOpen = openQuotes.filter((q) => (lastActivity(q) ?? 0) > 10);

  // ── Quoted price vs company pricing — SNAPSHOT at quote time (`refAtQuote`), NOT a re-run of the
  // current pricing engine (pricing may have changed since the quote). See db.js quotes note.
  const quoteVariance = (q) => {
    let quotedV = 0; let refV = 0;
    (q.lines || []).forEach((l) => { const quoted = Number(l.quoted); const qty = Number(l.qty) || 0; const ref = Number(l.refAtQuote);
      if (!Number.isFinite(ref) || ref <= 0 || !Number.isFinite(quoted) || quoted <= 0 || qty <= 0) return;
      quotedV += quoted * qty; refV += ref * qty; });
    return refV ? { pct: ((quotedV - refV) / refV) * 100, quotedV, refV } : null;
  };
  const recentWon = wonAll.slice().sort((a, b) => String(b.created).localeCompare(String(a.created))).slice(0, 6);
  const varDetails = recentWon.map((q) => quoteVariance(q)).filter(Boolean);
  const varRows = varDetails.map((d) => d.pct);
  const within5 = varRows.filter((v) => Math.abs(v) <= 5).length;
  const below5 = varRows.filter((v) => v < -5).length;
  const below10 = varRows.filter((v) => v < -10).length;
  // Value-weighted across all lines of the recent won quotes (money total, not a mean of per-quote %).
  const totQuoted = varDetails.reduce((a, d) => a + d.quotedV, 0);
  const totRef = varDetails.reduce((a, d) => a + d.refV, 0);
  const avgVariance = totRef ? ((totQuoted - totRef) / totRef) * 100 : null;

  // ── pricing (SHARED engine — same attribution as global Pricing tab, company-scoped) ─────────
  const attributedLines = buildAttributedLines(periodOrders, productCost);
  const b2bLineSet = attributedLines.filter((s) => s.isB2B);
  const b2bOrderIds = new Set(b2bLineSet.map((s) => s.order.id));
  const adoptionOrders = periodOrders.length ? Math.round((b2bOrderIds.size / periodOrders.length) * 100) : null;
  const allEcon = appliedEconomics(attributedLines);
  const b2bEcon = appliedEconomics(attributedLines, (s) => s.isB2B);
  const adoptionValue = allEcon.value ? Math.round((b2bEcon.value / allEcon.value) * 100) : null;
  const resolvedPriced = attributedLines.filter((s) => s.resolvedLineValue !== null);
  const resolvedVal = resolvedPriced.reduce((a, s) => a + s.resolvedLineValue, 0);
  const resolvedRef = resolvedPriced.reduce((a, s) => a + (Number(productBySku(s.sku)?.list) || 0) * s.qty, 0);
  const vsShopify = resolvedRef ? ((resolvedVal - resolvedRef) / resolvedRef) * 100 : null;
  const marginAtCreation = allEcon.margin;
  const companyProfiles = pricingProfileRows(attributedLines, productBySku);
  const exceptionLines = attributedLines.filter((s) => s.lineCost !== null && s.lineValue && ((s.lineValue - s.lineCost) / s.lineValue) * 100 < MARGIN_FLOOR);
  const exceptionValue = exceptionLines.reduce((a, s) => a + s.lineValue, 0);

  // ── attention signals ────────────────────────────────────────────────────────
  const attention = [];
  if (staleOpen.length) attention.push({ text: `${staleOpen.length} open quote${staleOpen.length === 1 ? '' : 's'} inactive for more than 10 days`, tab: 2 });
  if (exceptionValue > 0) attention.push({ text: `${money(exceptionValue)} order value below ${MARGIN_FLOOR}% margin`, tab: 3 });
  if (ratio != null && ratio > 1.5) attention.push({ text: `Last purchase was ${ratio.toFixed(1)}× the usual reorder interval ago`, tab: 1 });

  // ── unified timeline ─────────────────────────────────────────────────────────
  const allEvents = (() => {
    const ev = [];
    allCompleted.forEach((o) => ev.push({ date: String(o.date).slice(0, 10), title: `Order ${o.id}`, detail: money(Number(o.amount) || 0) }));
    companyQuotes.forEach((q) => { const c = String(q.created || '').slice(0, 10); if (c) ev.push({ date: c, title: `Quote #${q.id} created`, detail: q.buyer || '' }); if (q.status === 'Deal Closed') { const w = resolvedAt(q); if (w) ev.push({ date: w, title: `Quote #${q.id} won`, tone: 'success' }); } });
    analyticsPricingChanges.filter((r) => r.companyId === company.id).forEach((r) => ev.push({ date: String(r.date).slice(0, 10), title: 'Pricing updated', detail: r.rule }));
    return ev.filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date));
  })();

  // ── basket behaviour (last 8 completed orders) ───────────────────────────────
  const recent8 = allCompleted.slice(-8);
  const recent4 = allCompleted.slice(-4);
  const earlier = allCompleted.slice(0, -4);
  const skuAppear = (os) => { const m = new Map(); os.forEach((o) => new Set((o.items || []).map((i) => i.sku)).forEach((s) => m.set(s, (m.get(s) || 0) + 1))); return m; };
  const inRecent8 = skuAppear(recent8);
  const inRecent4 = skuAppear(recent4);
  const inEarlier = skuAppear(earlier);
  const firstPurchase = new Map();
  allCompleted.forEach((o) => (o.items || []).forEach((i) => { if (!firstPurchase.has(i.sku)) firstPurchase.set(i.sku, o.date); }));
  const frequently = [...inRecent8.entries()].filter(([, c]) => c >= Math.ceil(recent8.length / 2)).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const recentIdx = allCompleted.length - 3;
  const newInRecent = [...firstPurchase.entries()].filter(([s, d]) => allCompleted.findIndex((o) => o.date === d) >= recentIdx && recentIdx > 0 && (inEarlier.get(s) || 0) === 0).slice(0, 4);
  // "Previously frequent" only when there's enough history to be meaningful (≥8 orders).
  const previouslyFrequent = allCompleted.length >= MIN_HISTORY_FOR_LAPSED
    ? [...inEarlier.entries()].filter(([s, c]) => c >= Math.ceil(earlier.length / 2) && !inRecent4.has(s)).slice(0, 4) : [];

  // ── product-category mix (period vs prev) — SECONDARY: only if taxonomy is usable ────────────
  const categoryMix = (os) => { const m = new Map(); let total = 0; os.forEach((o) => (o.items || []).forEach((it) => { const cat = productBySku(it.sku)?.productType || 'Other'; const rev = Number(it.revenue) || 0; m.set(cat, (m.get(cat) || 0) + rev); total += rev; })); return { m, total }; };
  const curMix = categoryMix(periodOrders);
  const prevMix = categoryMix(prevOrders);
  const mixCats = [...new Set([...curMix.m.keys(), ...prevMix.m.keys()])].sort((a, b) => (curMix.m.get(b) || 0) - (curMix.m.get(a) || 0));
  const mixUsable = mixCats.filter((c) => c !== 'Other').length >= 2 && (curMix.total > 0 || prevMix.total > 0);

  // ── monthly series (sales + adoption toggle) ─────────────────────────────────
  const monthsSpan = [];
  for (let d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); d <= TODAY; d = addMonths(d, 1)) monthsSpan.push(new Date(d));
  const salesSeries = monthsSpan.map((d) => { const key = monthKey(d); return { label: MONTHS[d.getMonth()], value: periodOrders.filter((o) => String(o.date).startsWith(key)).reduce((a, o) => a + (Number(o.amount) || 0), 0) }; });
  const adoptionSeries = monthsSpan.map((d) => {
    const key = monthKey(d); const lines = attributedLines.filter((s) => String(s.order.date).startsWith(key));
    const orders = new Set(lines.map((s) => s.order.id)); const b2bO = new Set(lines.filter((s) => s.isB2B).map((s) => s.order.id));
    const tot = lines.reduce((a, s) => a + s.lineValue, 0); const b2bV = lines.filter((s) => s.isB2B).reduce((a, s) => a + s.lineValue, 0);
    const v = adoptionMode === 'value' ? (tot ? Math.round((b2bV / tot) * 100) : null) : (orders.size ? Math.round((b2bO.size / orders.size) * 100) : null);
    return { label: MONTHS[d.getMonth()], value: v };
  });

  // ── quantity pricing (company-scoped) ────────────────────────────────────────
  const tierEvents = analyticsQuantityEvents.filter((e) => e.type === 'tier_observed' && e.companyId === company.id && inPeriod(e.date));
  const tierReached = tierEvents.filter((e) => e.reached);
  const hasQuantityPricing = tierEvents.length > 0 || !!company.pricing?.quantity;
  const tierRefWeighted = (evs) => { const ref = evs.reduce((a, e) => a + (e.realizedDiscount < 100 ? e.orderValue / (1 - e.realizedDiscount / 100) : e.orderValue), 0); return ref ? evs.reduce((a, e) => a + (e.realizedDiscount < 100 ? e.orderValue / (1 - e.realizedDiscount / 100) : e.orderValue) * e.realizedDiscount, 0) / ref : null; };

  // ── contextual "what changed" sentence (after hero) ──────────────────────────
  let changedSentence = null;
  if (cmp && prevS.n > 0 && curS.n > 0) {
    const sD = salesDelta ?? 0, oD = ordersDelta ?? 0, aD = aovDelta ?? 0;
    if (Math.abs(sD) <= 12 && oD <= -20 && aD >= 20) changedSentence = 'Sales stayed roughly flat while the company placed fewer, larger orders.';
    else if (oD >= 20 && aD <= -15) changedSentence = 'The company is ordering more often, in smaller orders.';
    else if (sD >= 15) changedSentence = 'Sales are up versus the previous period.';
    else if (sD <= -15) changedSentence = 'Sales are down versus the previous period.';
    else changedSentence = 'Buying was broadly similar to the previous period.';
  }

  const money0 = (v) => (v == null ? '—' : money(v));
  const pct1 = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);
  const signedPct = (v) => (v == null ? '—' : `${Math.abs(v).toFixed(1)}% ${v >= 0 ? 'higher' : 'lower'}`);

  const tabs = [{ id: 'overview', content: 'Overview' }, { id: 'buying', content: 'Buying' }, { id: 'quotes', content: 'Quotes' }, { id: 'pricing', content: 'Pricing' }];

  // ── OVERVIEW ──────────────────────────────────────────────────────────────────
  const overview = (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
            <Stat label="Net sales" value={money(curS.rev)} delta={<DeltaChip v={salesDelta} />} sub={cmp ? 'vs previous' : 'in period'} help="Sales this company generated in the selected period (completed orders)." />
            <Stat label="Orders" value={String(curS.n)} delta={<DeltaChip v={ordersDelta} />} sub={cmp ? 'vs previous' : 'in period'} help="Completed orders in the selected period." />
            <Stat label="Average order value" value={money(curS.aov)} delta={<DeltaChip v={aovDelta} />} sub={cmp ? 'vs previous' : 'per order'} help="Average value per completed order in the selected period." />
            <Stat label="Open quote value" value={money(openQuoteValue)} sub="Current snapshot · not affected by date range" help="Total value of this company's still-open quotes. A current snapshot, independent of the date range." />
          </InlineGrid>
          {changedSentence ? <Text as="p" variant="bodyMd">{changedSentence}</Text> : null}
        </BlockStack>
      </Card>

      <SectionCard title="Relationship state" subtitle="How this company is tracking against its own buying rhythm.">
        <InlineStack gap="400" blockAlign="center" wrap>
          <Badge tone={STATE_TONE[relState]} size="large">{relState}</Badge>
          {overdue != null && overdue > 0 ? <Text as="span" tone="subdued">{overdue} days past its usual reorder time</Text> : null}
        </InlineStack>
        <Divider />
        <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
          <Stat label="Last order" value={since == null ? '—' : `${since} days ago`} sub={last ? fmtDate(last) : undefined} />
          <Stat label="Typical reorder" value={typical == null ? '—' : `~${typical} days`} />
          <Stat label="Current gap" value={ratio == null ? '—' : `${ratio.toFixed(1)}× usual`} tone={ratio != null && ratio > 1.5 ? 'critical' : undefined} />
          <Stat label="Order history" value={`${allCompleted.length} orders`} />
        </InlineGrid>
      </SectionCard>

      <SectionCard title="Attention needed" subtitle="Factual signals worth inspecting — no score, no prediction.">
        {attention.length ? (
          <BlockStack gap="0">
            {attention.map((a, i) => (
              <div key={i}>{i ? <Divider /> : null}
                <Box paddingBlock="200"><InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
                  <Text as="span" variant="bodyMd">{a.text}</Text>
                  <Button variant="plain" onClick={() => setTab(a.tab)}>{['Overview', 'Buying', 'Quotes', 'Pricing'][a.tab]} →</Button>
                </InlineStack></Box>
              </div>
            ))}
          </BlockStack>
        ) : <Text as="p" tone="subdued" variant="bodySm">Nothing needs attention right now.</Text>}
      </SectionCard>

      <SectionCard title="Recent activity" action={<Button variant="plain" onClick={() => setTab(2)}>View all activity</Button>}>
        {allEvents.length ? <BlockStack gap="0">{allEvents.slice(0, 6).map((e, i) => <TimelineRow key={i} e={e} first={i === 0} />)}</BlockStack> : <Text as="p" tone="subdued" variant="bodySm">No activity yet.</Text>}
      </SectionCard>
    </BlockStack>
  );

  // ── BUYING ──────────────────────────────────────────────────────────────────
  const cadenceEvents = allCompleted.map((o, i, arr) => ({ amount: o.amount, valueLabel: moneyShort(Number(o.amount) || 0), dateLabel: fmtDate(o.date), gapLabel: i ? `${daysBetween(arr[i - 1].date, o.date)}d` : '' }));
  const largest = allCompleted.reduce((m, o) => Math.max(m, Number(o.amount) || 0), 0);
  const medianOrder = median(allCompleted.map((o) => Number(o.amount) || 0));
  const avgProds = allCompleted.length ? allCompleted.reduce((a, o) => a + (o.items || []).length, 0) / allCompleted.length : 0;
  const buying = (
    <BlockStack gap="400">
      <SectionCard title="Buying rhythm" subtitle="This company's cadence — intervals between its own orders.">
        <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
          <Stat label="Typical reorder" value={typical == null ? '—' : `${typical} days`} help="Median days between this company's completed orders." />
          <Stat label="Last order" value={since == null ? '—' : `${since} days ago`} />
          <Stat label="Current gap" value={ratio == null ? '—' : `${ratio.toFixed(1)}× usual`} tone={ratio != null && ratio > 1.5 ? 'critical' : undefined} />
          <Stat label="Orders in period" value={String(curS.n)} />
        </InlineGrid>
        {cadenceEvents.length ? (<><Divider /><Timeline events={cadenceEvents} empty="No completed orders." /></>) : null}
      </SectionCard>

      <SectionCard title="Purchase trend" subtitle="Is the company buying more, less, or just in different order sizes?">
        <LineChart data={salesSeries} label="Sales over time" />
        <Divider />
        <BlockStack gap="200">
          <ShiftRow label="Net sales" prev={prevS.rev} cur={curS.rev} fmt={moneyShort} />
          <ShiftRow label="Orders" prev={prevS.n} cur={curS.n} />
          <ShiftRow label="Average order value" prev={prevS.aov} cur={curS.aov} fmt={moneyShort} />
        </BlockStack>
        {changedSentence ? <Text as="p" variant="bodySm" tone="subdued">{changedSentence}</Text> : null}
      </SectionCard>

      <SectionCard title="Basket behaviour" subtitle="What this company buys, what's new, and what it used to buy but hasn't lately (last 8 orders).">
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <BlockStack gap="150">
            <Text as="span" variant="bodySm" fontWeight="semibold">Frequently purchased</Text>
            {frequently.length ? frequently.map(([s, c]) => <Text as="p" key={s} variant="bodyMd">{skuName(s)} <Text as="span" tone="subdued" variant="bodySm">· {c} of last {recent8.length}</Text></Text>) : <Text as="p" tone="subdued" variant="bodySm">—</Text>}
          </BlockStack>
          <BlockStack gap="150">
            <Text as="span" variant="bodySm" fontWeight="semibold">New in recent orders</Text>
            {newInRecent.length ? newInRecent.map(([s, d]) => <Text as="p" key={s} variant="bodyMd">{skuName(s)} <Text as="span" tone="subdued" variant="bodySm">· first {fmtDate(d)}</Text></Text>) : <Text as="p" tone="subdued" variant="bodySm">—</Text>}
          </BlockStack>
          <BlockStack gap="150">
            <Text as="span" variant="bodySm" fontWeight="semibold">Previously frequent</Text>
            {allCompleted.length < MIN_HISTORY_FOR_LAPSED ? <Text as="p" tone="subdued" variant="bodySm">Needs ≥{MIN_HISTORY_FOR_LAPSED} orders</Text>
              : previouslyFrequent.length ? previouslyFrequent.map(([s, c]) => <Text as="p" key={s} variant="bodyMd">{skuName(s)} <Text as="span" tone="subdued" variant="bodySm">· was in {c} of {earlier.length}, not in last 4</Text></Text>) : <Text as="p" tone="subdued" variant="bodySm">—</Text>}
          </BlockStack>
        </InlineGrid>
      </SectionCard>

      {mixUsable ? (
        <SectionCard title="Product mix change" subtitle="Where this company's demand is shifting, by product category.">
          <BlockStack gap="200">
            {mixCats.slice(0, 6).map((cat) => {
              const p = prevMix.total ? Math.round(((prevMix.m.get(cat) || 0) / prevMix.total) * 100) : 0;
              const c = curMix.total ? Math.round(((curMix.m.get(cat) || 0) / curMix.total) * 100) : 0;
              return <ShiftRow key={cat} label={cat} prev={p} cur={c} fmt={(x) => `${x}%`} />;
            })}
          </BlockStack>
        </SectionCard>
      ) : null}

      <SectionCard title="Order summary" action={<Button variant="plain" onClick={() => goTab('orders')}>View orders →</Button>}>
        <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
          <Stat label="Largest order" value={money(largest)} />
          <Stat label="Median order value" value={money0(medianOrder)} />
          <Stat label="Products per order" value={avgProds ? avgProds.toFixed(1) : '—'} />
          <Stat label="Days since last order" value={since == null ? '—' : `${since}`} />
        </InlineGrid>
      </SectionCard>
    </BlockStack>
  );

  // ── QUOTES ────────────────────────────────────────────────────────────────────
  const quotes = (
    <BlockStack gap="400">
      <Card>
        <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
          <Stat label="Open quote value" value={money(openQuoteValue)} sub="Current snapshot" help="Value of this company's still-open quotes. Current snapshot, not limited to the date range." />
          <Stat label="Open quotes" value={String(openQuotes.length)} />
          <Stat label="Win rate" value={winRateCount == null ? '—' : `${winRateCount}%`} sub="by count, in period" help="Won quotes as a share of quotes won or lost in the period." />
          <Stat label="First response time" value={fmtDur(responseMedian)} help="Median time from quote creation to the first time it was priced or sent." />
        </InlineGrid>
      </Card>

      <SectionCard title="Open quote attention" subtitle="Open quotes for this company, oldest activity first." action={<Button variant="plain" onClick={() => goTab('quotes')}>View all quotes →</Button>}>
        {openQuotes.length ? (
          <>
            <IndexTable resourceName={{ singular: 'quote', plural: 'quotes' }} itemCount={openQuotes.length} selectable={false}
              headings={[{ title: 'Quote' }, { title: 'Value', alignment: 'end' }, { title: 'Status' }, { title: 'Age', alignment: 'end' }, { title: 'Last activity', alignment: 'end' }]}>
              {openQuotes.slice().sort((a, b) => (lastActivity(b) ?? 0) - (lastActivity(a) ?? 0)).map((q, i) => (
                <IndexTable.Row id={String(q.id)} key={q.id} position={i}>
                  <IndexTable.Cell>{`#${q.id}`}</IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{money(quoteVal(q))}</Text></IndexTable.Cell>
                  <IndexTable.Cell>{q.status}</IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{`${quoteAge(q)}d`}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text as="span" alignment="end">{lastActivity(q) == null ? '—' : `${lastActivity(q)}d ago`}</Text></IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            {staleOpen.length ? <Text as="p" tone="subdued" variant="bodySm">{staleOpen.length} quote{staleOpen.length === 1 ? ' has' : 's have'} had no activity for more than 10 days.</Text> : null}
          </>
        ) : <Text as="p" tone="subdued" variant="bodySm">No open quotes.</Text>}
      </SectionCard>

      <SectionCard title="Negotiation history" subtitle="Quote outcomes for this company in the selected period.">
        <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
          <Stat label="Quotes created" value={String(periodQuotes.length)} />
          <Stat label="Won" value={String(wonP.length)} />
          <Stat label="Lost" value={String(lostP.length)} />
          <Stat label="Win rate by count" value={winRateCount == null ? '—' : `${winRateCount}%`} />
          <Stat label="Median time to decision" value={fmtDur(decisionMedian)} help="Median time from quote creation until it was resolved (won or lost)." />
        </InlineGrid>
      </SectionCard>

      {varRows.length ? (
        <SectionCard title="Quoted price vs company pricing" subtitle="Recent won quotes vs the pricing assigned at quote time (snapshot, not today's pricing).">
          <Stat label="Average difference from company pricing" value={avgVariance == null ? '—' : `${avgVariance > 0 ? '+' : ''}${avgVariance.toFixed(1)}%`} help="Average difference between quoted prices and the company's assigned pricing captured at quote time, weighted by value." />
          <Text as="p" variant="bodyMd">{varRows.length} recent won quote{varRows.length === 1 ? '' : 's'} · {within5} within ±5% of assigned pricing{below10 ? ` · ${below10} quoted >10% below` : below5 ? ` · ${below5} quoted >5% below` : ''}</Text>
          {avgVariance != null ? <Text as="p" tone="subdued" variant="bodySm">Won quotes were priced {Math.abs(avgVariance).toFixed(1)}% {avgVariance >= 0 ? 'above' : 'below'} assigned company pricing on average.</Text> : null}
        </SectionCard>
      ) : null}

      {(() => {
        const finalizedQ = periodQuotes.filter((q) => FINALIZED.has(q.status));
        const discPct = (q) => { let list = 0, quoted = 0; (q.lines || []).forEach((l) => { const p = productBySku(l.sku); const qn = Number(l.qty) || 0; const ql = Number(l.quoted); const li = Number(p?.list) || 0; if (li > 0 && Number.isFinite(ql) && ql > 0 && qn > 0) { list += li * qn; quoted += ql * qn; } }); return list ? Math.max(0, ((list - quoted) / list) * 100) : null; };
        const bands = [{ name: '0–5%', lo: 0, hi: 5 }, { name: '5–10%', lo: 5, hi: 10 }, { name: '10–15%', lo: 10, hi: 15 }, { name: '15%+', lo: 15, hi: Infinity }].map((b, idx) => {
          const rows = finalizedQ.filter((q) => { const d = discPct(q); return d != null && (idx === 0 ? d <= b.hi : d > b.lo) && d <= b.hi; });
          const wins = rows.filter((q) => q.status === 'Deal Closed').length;
          return { ...b, count: rows.length, wins, rate: rows.length ? Math.round((wins / rows.length) * 100) : null };
        });
        const maxRate = Math.max(1, ...bands.map((b) => b.rate || 0));
        return bands.some((b) => b.count) ? (
          <SectionCard title="Win rate by discount" subtitle="For this company only — read with the sample size; association, not cause.">
            <RankBars rows={bands.map((b) => ({ key: b.name, name: `${b.name} off`, sub: `${b.wins} of ${b.count} won or lost`, width: b.rate == null ? 0 : (b.rate / maxRate) * 100, valueLabel: b.rate == null ? '—' : `${b.rate}%` }))} empty="No won or lost quotes." />
          </SectionCard>
        ) : null;
      })()}
    </BlockStack>
  );

  // ── PRICING ────────────────────────────────────────────────────────────────────
  const pricing = (
    <BlockStack gap="400">
      <Card>
        <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
          <Stat label="B2B price vs Shopify" value={vsShopify == null ? '—' : signedPct(vsShopify)} sub="on B2B-priced lines" help="How this company's B2B prices compare with Shopify list, on B2B-priced lines (resolved price)." />
          <Stat label="Margin at order creation" value={pct1(marginAtCreation)} sub="costed lines" help="Gross margin at the price applied when orders were created, on lines with known cost." />
          <Stat label="Orders using B2B pricing" value={adoptionOrders == null ? '—' : `${adoptionOrders}%`} sub={`${b2bOrderIds.size} of ${periodOrders.length}`} help="Share of this company's completed orders using a B2B pricing." />
          <Stat label={`Order value below ${MARGIN_FLOOR}% margin`} value={money(exceptionValue)} sub={`${exceptionLines.length} line${exceptionLines.length === 1 ? '' : 's'}`} help={`Order value from lines whose margin at creation is below ${MARGIN_FLOOR}%.`} />
        </InlineGrid>
      </Card>

      {adoptionSeries.some((s) => s.value != null) ? (
        <SectionCard title="Pricing adoption over time" subtitle="Is this company actually transacting through the pricing you assigned?"
          action={<div style={{ display: 'inline-flex', border: '1px solid var(--p-color-border)', borderRadius: 8, overflow: 'hidden' }}>{[['orders', 'Orders'], ['value', 'Order value']].map(([m, lbl]) => (<button key={m} type="button" onClick={() => setAdoptionMode(m)} style={{ padding: '5px 12px', border: 0, cursor: 'pointer', font: 'inherit', background: adoptionMode === m ? 'var(--p-color-bg-fill-brand)' : 'transparent', color: adoptionMode === m ? 'var(--p-color-text-brand-on-bg-fill)' : 'var(--p-color-text)' }}>{lbl}</button>))}</div>}>
          <LineChart data={adoptionSeries} prefix="" label={`Share of ${adoptionMode === 'value' ? 'order value' : 'orders'} using B2B pricing`} />
          <Text as="p" tone="subdued" variant="bodySm">An order counts as "using B2B pricing" if ≥1 line does — order-value view shows how much value actually went through it.</Text>
        </SectionCard>
      ) : null}

      {varRows.length ? (
        <SectionCard title="Pricing vs negotiation" subtitle="Assigned company pricing (at quote time) vs recent won quotes.">
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">{within5} within ±5% · {Math.max(0, below5 - below10)} 5–10% below · {below10} more than 10% below</Text>
            {below5 ? <Text as="p" tone="subdued" variant="bodySm">{below5} of {varRows.length} recent won quotes were more than 5% below assigned pricing.</Text> : <Text as="p" tone="subdued" variant="bodySm">Recent won quotes are close to the assigned pricing.</Text>}
          </BlockStack>
        </SectionCard>
      ) : null}

      <SectionCard title="Pricing performance" subtitle="How the pricing this company transacts on is performing." action={<Button variant="plain" onClick={() => goTab('pricing')}>View pricing →</Button>}>
        {companyProfiles.length > 1 ? (
          <IndexTable resourceName={{ singular: 'pricing', plural: 'pricings' }} itemCount={companyProfiles.length} selectable={false}
            headings={[{ title: 'Pricing' }, { title: 'Order value', alignment: 'end' }, { title: 'Margin', alignment: 'end' }, { title: 'vs Shopify', alignment: 'end' }, { title: 'Orders', alignment: 'end' }]}>
            {companyProfiles.map((p, i) => (
              <IndexTable.Row id={p.name} key={p.name} position={i}>
                <IndexTable.Cell>{p.name}</IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{money(p.value)}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{pct1(p.margin)}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{p.deltaPct == null ? '—' : signedPct(p.deltaPct)}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{p.orders}</Text></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        ) : companyProfiles.length === 1 ? (
          <BlockStack gap="200">
            <Text as="span" variant="bodyMd" fontWeight="semibold">{companyProfiles[0].name}</Text>
            <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
              <Stat label="Order value" value={money(companyProfiles[0].value)} />
              <Stat label="Margin" value={pct1(companyProfiles[0].margin)} />
              <Stat label="vs Shopify" value={companyProfiles[0].deltaPct == null ? '—' : signedPct(companyProfiles[0].deltaPct)} />
              <Stat label="Orders" value={String(companyProfiles[0].orders)} />
            </InlineGrid>
          </BlockStack>
        ) : <Text as="p" tone="subdued" variant="bodySm">No B2B pricing used on orders in this period.</Text>}
      </SectionCard>

      <SectionCard title="Quantity pricing effectiveness" subtitle="Whether this company reaches the quantity tiers it's eligible for.">
        {hasQuantityPricing && tierEvents.length ? (
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <Stat label="Tier reach rate" value={tierEvents.length ? `${Math.round((tierReached.length / tierEvents.length) * 100)}%` : '—'} sub={`${tierReached.length} of ${tierEvents.length} eligible`} />
            <Stat label="Order value at reached tiers" value={money(tierReached.reduce((a, e) => a + (Number(e.orderValue) || 0), 0))} />
            <Stat label="Average tier discount" value={(() => { const d = tierRefWeighted(tierReached); return d == null ? '—' : `${d.toFixed(1)}%`; })()} />
          </InlineGrid>
        ) : <Text as="p" tone="subdued" variant="bodySm">No quantity pricing assigned.</Text>}
      </SectionCard>

      {exceptionLines.length ? (
        <SectionCard title={`Order value below ${MARGIN_FLOOR}% margin`} subtitle="Lines priced below the margin threshold at creation." action={<Button variant="plain" onClick={() => goTab('pricing')}>View pricing →</Button>}>
          <IndexTable resourceName={{ singular: 'line', plural: 'lines' }} itemCount={exceptionLines.length} selectable={false}
            headings={[{ title: 'Product' }, { title: 'Order value', alignment: 'end' }, { title: 'Margin', alignment: 'end' }, { title: 'Pricing' }]}>
            {exceptionLines.slice(0, 8).map((l, i) => { const m = l.lineValue ? ((l.lineValue - l.lineCost) / l.lineValue) * 100 : 0; return (
              <IndexTable.Row id={`${l.order.id}-${l.sku}-${i}`} key={i} position={i}>
                <IndexTable.Cell>{skuName(l.sku)}</IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{money(l.lineValue)}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" alignment="end">{m.toFixed(1)}%</Text></IndexTable.Cell>
                <IndexTable.Cell>{l.order.pricing && l.order.pricing !== 'None' ? l.order.pricing : '—'}</IndexTable.Cell>
              </IndexTable.Row>
            ); })}
          </IndexTable>
        </SectionCard>
      ) : null}
    </BlockStack>
  );

  const body = [overview, buying, quotes, pricing][tab];
  return (
    <BlockStack gap="400">
      <Card>
        <InlineStack gap="300" blockAlign="end" wrap>
          <div style={{ minWidth: 160 }}><Select label="Date range" options={[{ label: 'Last 30 days', value: '30d' }, { label: 'Last 3 months', value: '3m' }, { label: 'Last 6 months', value: '6m' }, { label: 'Last 12 months', value: '12m' }]} value={period} onChange={setPeriod} /></div>
          <div style={{ minWidth: 170 }}><Select label="Compare" options={[{ label: 'Previous period', value: 'previous' }, { label: 'No comparison', value: 'none' }]} value={compare} onChange={setCompare} /></div>
        </InlineStack>
      </Card>
      <Card padding="0"><Tabs tabs={tabs} selected={tab} onSelect={setTab} /></Card>
      {body}
    </BlockStack>
  );
}
