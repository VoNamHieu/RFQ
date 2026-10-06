import React, { useState } from 'react';
import { MetricTooltip } from './MetricTooltip.jsx';
import { MenuButton, wcTone } from '../../shared/wc.jsx';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { moneyShort, LineChart, RankBars } from './charts.jsx';
import { buildAttributedLines, pricingProfileRows, appliedEconomics } from '../pricingAttribution.js';
import { analyticsPricingChanges, analyticsQuantityEvents, analyticsOrderItems } from '../data/analytics.js';

// Date range + comparison, shown as filter buttons above the analytics.
const PERIOD_OPTIONS = [
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 3 months', value: '3m' },
  { label: 'Last 6 months', value: '6m' },
  { label: 'Last 12 months', value: '12m' },
];
const COMPARE_OPTIONS = [
  { label: 'Previous period', value: 'previous' },
  { label: 'No comparison', value: 'none' },
];

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
// Prototype: show the dev toggles in production too (flip to import.meta.env.DEV to hide in prod).
const SHOW_DEV_TOOLS = true;
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

// Dotted underline on a label that carries a metric tooltip.
const HELP_UNDERLINE = { cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 2 };
// Stat value (Polaris React headingLg): s-text has no size that large, so a native span inside
// s-text keeps the s-text tone colour (critical / success) at the s-heading large-200 size.
const STAT_VALUE = { fontSize: 18, lineHeight: '24px', fontWeight: 600 };
// Responsive stat grid (Polaris React InlineGrid columns={{ xs: narrow, sm|md: wide }}): `wide`
// columns once the card is wider than `at` px, `narrow` below. (The responsive value is split on
// commas, so the tracks are written out as "1fr 1fr …" rather than repeat()/minmax().)
const fr = (n) => Array(n).fill('1fr').join(' ');
function StatGrid({ narrow, wide, at = 490, children }) {
  return (
    <s-query-container>
      <s-grid
        gridTemplateColumns={`@container (inline-size > ${at}px) ${fr(wide)}, ${fr(narrow)}`}
        gap="base"
      >
        {children}
      </s-grid>
    </s-query-container>
  );
}

// `suffix` is the unit ('%' for changes, ' pp' for percentage-point diffs). `goodDown` flips the
// colour for metrics where a decrease is good (time-to-decision, below-margin value, lost quotes).
function DeltaChip({ v, suffix = '%', goodDown = false }) {
  if (v == null) {
    // A compared metric whose previous period has no baseline (e.g. no quotes back then): still
    // show a signal instead of nothing, so "compared but nothing to compare with" is visible.
    return (
      <MetricTooltip help="No data in the previous period to compare with.">
        <s-text fontSize="small" color="subdued">—</s-text>
      </MetricTooltip>
    );
  }
  const up = v > 0, down = v < 0;
  const good = goodDown ? down : up;
  const bad = goodDown ? up : down;
  return (
    <s-text fontSize="small" tone={good ? 'success' : bad ? 'critical' : undefined} color={good || bad ? undefined : 'subdued'}>
      {`${up ? '↑ ' : down ? '↓ ' : ''}${Math.abs(v)}${suffix}`}
    </s-text>
  );
}
// `blank` (dev "Compare only") = this stat has no previous-period comparison: keep the label and
// its tooltip, show "—" and drop the sub line / delta — the layout stays put.
function Stat({ label, value, sub, help, formula, tone, delta, blank = false }) {
  if (blank) { value = '—'; sub = null; delta = null; tone = undefined; }
  return (
    <s-stack gap="small-500">
      {help ? (
        <MetricTooltip title={label} help={help} formula={formula}>
          <s-text color="subdued" fontSize="small"><span style={HELP_UNDERLINE}>{label}</span></s-text>
        </MetricTooltip>
      ) : <s-text color="subdued" fontSize="small">{label}</s-text>}
      <s-text tone={tone}><span style={STAT_VALUE}>{value}</span></s-text>
      {(sub || delta) ? (
        <s-stack direction="inline" gap="small-300" alignItems="center">
          {delta || null}
          {sub ? <s-text color="subdued" fontSize="small">{sub}</s-text> : null}
        </s-stack>
      ) : null}
    </s-stack>
  );
}
function SectionCard({ title, subtitle, action, help, children }) {
  const titleEl = help ? (
    <MetricTooltip title={title} help={help}>
      <s-heading><span style={{ ...HELP_UNDERLINE, textUnderlineOffset: 3 }}>{title}</span></s-heading>
    </MetricTooltip>
  ) : <s-heading>{title}</s-heading>;
  return (
    <s-section>
      <s-stack gap="small">
        <s-stack direction="inline" justifyContent="space-between" alignItems="start" gap="small">
          <s-stack gap="small-500">
            {titleEl}
            {subtitle ? <s-paragraph color="subdued" fontSize="small">{subtitle}</s-paragraph> : null}
          </s-stack>
          {action || null}
        </s-stack>
        {children}
      </s-stack>
    </s-section>
  );
}
// Column heading with a dotted-underline hover tooltip, for s-table-header.
function ColHelp({ label, help, formula }) {
  return (
    <MetricTooltip title={label} help={help} formula={formula}>
      <span style={HELP_UNDERLINE}>{label}</span>
    </MetricTooltip>
  );
}
function ShiftRow({ label, prev, cur, fmt = (x) => String(x) }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
      <s-text color="subdued" fontSize="small">{label}</s-text>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-text color="subdued">{fmt(prev)}</s-text>
        <s-text color="subdued">→</s-text>
        <s-text fontSize="large" fontWeight="semibold" tone={cur > prev ? 'success' : cur < prev ? 'critical' : undefined}>{fmt(cur)}</s-text>
      </s-stack>
    </s-grid>
  );
}
function TimelineRow({ e, first }) {
  return (
    <div>
      {first ? null : <s-divider />}
      <s-box paddingBlock="small-200">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
          <s-grid gridTemplateColumns="auto 1fr" alignItems="center" gap="small">
            <div style={{ minWidth: 56 }}><s-text color="subdued" fontSize="small">{fmtDate(e.date)}</s-text></div>
            <s-text fontWeight={e.milestone ? 'semibold' : undefined} tone={e.tone}>{e.title}</s-text>
          </s-grid>
          {e.detail ? <s-text color="subdued" fontSize="small">{e.detail}</s-text> : null}
        </s-grid>
      </s-box>
    </div>
  );
}

export function CompanyAnalytics({ company }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState('3m');
  const [compare, setCompare] = useState('previous');
  const [marginFloor, setMarginFloor] = useState(MARGIN_FLOOR); // merchant-adjustable margin threshold
  const [devEmpty, setDevEmpty] = useState(false); // dev-only: preview the empty state on a company that has data
  const [compareOnly, setCompareOnly] = useState(false); // dev-only: "Compare only" — data only where there's a previous-period comparison

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
  const cmp = compare === 'previous' || compareOnly;
  // Dev "Compare only": same layout, but only stats / blocks WITH a previous-period comparison show
  // data — the rest go "—" (Stat `blank`) or render their per-block empty state (rows emptied here).
  const blankRows = (rows) => (compareOnly ? [] : rows);
  const inRange = (d, s, e) => { const t = toDate(d); return t >= s && t <= e; };
  const inPeriod = (d) => inRange(d, rangeStart, TODAY);
  const inPrev = (d) => inRange(d, prevStart, prevEnd);

  // ── orders / quotes ──────────────────────────────────────────────────────────
  const attach = (o) => ({ ...o, companyId: company.id, items: orderItems(o) });
  const rawCompleted = (company.orders || []).filter((o) => COMPLETED.has(o.status)).map(attach).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const rawQuotes = allQuotes.filter((q) => q.company === company.id);
  // Empty state: this company has never ordered AND has no quotes (or the dev "Preview empty state"
  // toggle is on). Zeroing the source data here makes every downstream block render its own
  // per-block empty state (empty charts, "—" KPIs, "No … yet" tables) while the dashboard layout,
  // controls and tabs stay in place — so the screen reads as "waiting for data", not "broken".
  const genuinelyEmpty = !rawCompleted.length && !rawQuotes.length;
  const showEmpty = genuinelyEmpty || devEmpty;
  const allCompleted = showEmpty ? [] : rawCompleted;
  const companyQuotes = showEmpty ? [] : rawQuotes;
  const periodOrders = allCompleted.filter((o) => inPeriod(o.date));
  const prevOrders = allCompleted.filter((o) => inPrev(o.date));
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
  // ── previous-period comparisons (Compare = previous → drive delta chips across every tab) ─────
  const dPct = (cur, prev) => (cmp ? pctChange(cur, prev) : null); // % change, gated on Compare
  const dPP = (cur, prev) => (cmp && cur != null && prev != null ? Math.round(cur - prev) : null); // pp diff
  // Delta slot for a compared stat: with Compare on it ALWAYS renders a signal (↑/↓, "0%" when flat,
  // "—" when the previous period has no baseline); Compare off → nothing.
  const cmpDelta = (v, opts = {}) => (cmp ? <DeltaChip v={v} {...opts} /> : null);
  const prevQuotes = companyQuotes.filter((q) => inPrev(q.created));
  const prevWonN = prevQuotes.filter((q) => q.status === 'Deal Closed').length;
  const prevLostN = prevQuotes.filter((q) => q.status === 'Deal Rejected').length;
  const prevFinalized = prevWonN + prevLostN;
  const prevWinRate = prevFinalized ? Math.round((prevWonN / prevFinalized) * 100) : null;
  const prevDecisionMedian = median(prevQuotes.filter((q) => FINALIZED.has(q.status)).map((q) => { const c = String(q.created || '').slice(0, 10); const r = resolvedAt(q); return c && r ? Math.max(0, daysBetween(c, r)) : null; }).filter((x) => x != null));
  const quotesCreatedDelta = dPct(periodQuotes.length, prevQuotes.length);
  const wonDelta = dPct(wonP.length, prevWonN);
  const lostDelta = dPct(lostP.length, prevLostN);
  const winRateDelta = dPP(winRateCount, prevWinRate);
  const decisionDelta = decisionMedian != null && prevDecisionMedian ? dPct(decisionMedian, prevDecisionMedian) : null;
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
  // ±5% is an internal noise threshold (not shown to merchants): above = won higher than the
  // pricing set for the company, below = won lower (possible over-discounting), else ~ at price.
  const above5 = varRows.filter((v) => v > 5).length;
  const below5 = varRows.filter((v) => v < -5).length;
  // Concrete number for merchants: value-weighted average difference vs the pricing set (money total).
  const totQuoted = varDetails.reduce((a, d) => a + d.quotedV, 0);
  const totRef = varDetails.reduce((a, d) => a + d.refV, 0);
  const avgVariance = totRef ? ((totQuoted - totRef) / totRef) * 100 : null;
  const negoAbs = avgVariance == null ? 0 : Math.round(Math.abs(avgVariance));
  const negoDir = negoAbs === 0 ? 'about the same as' : avgVariance >= 0 ? 'above' : 'below';
  const negoSummary = below5
    ? 'Worth a quick look — you may be discounting below their agreed price on those quotes.'
    : above5
    ? 'Won quotes are landing at or above your set price — nothing discounted below it.'
    : 'Won quotes are staying right around your set price.';

  // ── pricing (SHARED engine — same attribution as global Pricing tab, company-scoped) ─────────
  const attributedLines = buildAttributedLines(periodOrders, productCost);
  const b2bLineSet = attributedLines.filter((s) => s.isB2B);
  const b2bOrderIds = new Set(b2bLineSet.map((s) => s.order.id));
  const adoptionOrders = periodOrders.length ? Math.round((b2bOrderIds.size / periodOrders.length) * 100) : null;
  const allEcon = appliedEconomics(attributedLines);
  const b2bEcon = appliedEconomics(attributedLines, (s) => s.isB2B);
  const adoptionValue = allEcon.value ? Math.round((b2bEcon.value / allEcon.value) * 100) : null;
  // Rule-based adoption summary — surfaces breadth (orders) vs depth (value) in one sentence.
  const adoptionSummary = (() => {
    if (!periodOrders.length) return 'No order activity in this period.';
    const o = adoptionOrders ?? 0; const v = adoptionValue ?? 0;
    if (o < 50) return 'Most purchasing in this period did not use B2B pricing.';
    if (o >= 90 && v >= 90) return 'B2B pricing was used across nearly all orders and order value in this period.';
    if (o === 100) return `All orders used B2B pricing, but ${100 - v}% of order value still came from other pricing.`;
    if (o - v >= 25) return `B2B pricing appeared in most orders, but only ${v}% of order value used it.`;
    return `B2B pricing covered ${o}% of orders and ${v}% of order value this period.`;
  })();
  const resolvedPriced = attributedLines.filter((s) => s.resolvedLineValue !== null);
  const resolvedVal = resolvedPriced.reduce((a, s) => a + s.resolvedLineValue, 0);
  const resolvedRef = resolvedPriced.reduce((a, s) => a + (Number(productBySku(s.sku)?.list) || 0) * s.qty, 0);
  const vsShopify = resolvedRef ? ((resolvedVal - resolvedRef) / resolvedRef) * 100 : null;
  const marginAtCreation = allEcon.margin;
  const companyProfiles = pricingProfileRows(attributedLines, productBySku);
  const exceptionLines = attributedLines.filter((s) => s.lineCost !== null && s.lineValue && ((s.lineValue - s.lineCost) / s.lineValue) * 100 < marginFloor);
  const exceptionValue = exceptionLines.reduce((a, s) => a + s.lineValue, 0);
  // Previous-period pricing (for delta chips on the Pricing tab).
  const prevLines = buildAttributedLines(prevOrders, productCost);
  const prevEcon = appliedEconomics(prevLines);
  const prevB2bOrderIds = new Set(prevLines.filter((s) => s.isB2B).map((s) => s.order.id));
  const prevAdoptionOrders = prevOrders.length ? Math.round((prevB2bOrderIds.size / prevOrders.length) * 100) : null;
  const prevB2bEcon = appliedEconomics(prevLines, (s) => s.isB2B);
  const prevAdoptionValue = prevEcon.value ? Math.round((prevB2bEcon.value / prevEcon.value) * 100) : null;
  const prevExceptionValue = prevLines.filter((s) => s.lineCost !== null && s.lineValue && ((s.lineValue - s.lineCost) / s.lineValue) * 100 < marginFloor).reduce((a, s) => a + s.lineValue, 0);
  const marginDelta = dPP(marginAtCreation == null ? null : Math.round(marginAtCreation * 10) / 10, prevEcon.margin == null ? null : Math.round(prevEcon.margin * 10) / 10);
  const orderValueDelta = dPct(allEcon.value, prevEcon.value);
  const adoptionOrdersDelta = dPP(adoptionOrders, prevAdoptionOrders);
  const adoptionValueDelta = dPP(adoptionValue, prevAdoptionValue);
  const exceptionDelta = dPct(exceptionValue, prevExceptionValue);

  // ── attention signals ────────────────────────────────────────────────────────
  const attention = [];
  if (staleOpen.length) attention.push({ text: `${staleOpen.length} open quote${staleOpen.length === 1 ? '' : 's'} with no activity for more than 10 days`, tab: 2 });
  if (exceptionValue > 0) attention.push({ text: `${money(exceptionValue)} in order value from lines below ${marginFloor}% margin`, tab: 3 });
  if (ratio != null && ratio > 1.5) attention.push({ text: `It's been ${ratio.toFixed(1)}× the usual reorder interval since the last purchase`, tab: 1 });

  // ── unified timeline ─────────────────────────────────────────────────────────
  const allEvents = (() => {
    const ev = [];
    allCompleted.forEach((o) => ev.push({ date: String(o.date).slice(0, 10), title: `Order ${o.id}`, detail: money(Number(o.amount) || 0) }));
    companyQuotes.forEach((q) => { const c = String(q.created || '').slice(0, 10); if (c) ev.push({ date: c, title: `Quote #${q.id} created`, detail: q.buyer || '' }); if (q.status === 'Deal Closed') { const w = resolvedAt(q); if (w) ev.push({ date: w, title: `Quote #${q.id} won`, tone: 'success' }); } });
    (showEmpty ? [] : analyticsPricingChanges.filter((r) => r.companyId === company.id)).forEach((r) => ev.push({ date: String(r.date).slice(0, 10), title: 'Pricing updated', detail: r.rule }));
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
  // "Previously frequent" (lapsed SKUs) only when there's enough history to be meaningful (≥8
  // orders). Below that the column is HIDDEN entirely — not shown with a placeholder — because a
  // dead column exposing the ≥8 threshold is worse than one fewer column.
  const showLapsed = allCompleted.length >= MIN_HISTORY_FOR_LAPSED;
  const previouslyFrequent = showLapsed
    ? [...inEarlier.entries()].filter(([s, c]) => c >= Math.ceil(earlier.length / 2) && !inRecent4.has(s)).slice(0, 4) : [];

  // ── monthly sales series (Purchase-trend line chart) ─────────────────────────
  const monthsSpan = [];
  for (let d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); d <= TODAY; d = addMonths(d, 1)) monthsSpan.push(new Date(d));
  const salesSeries = monthsSpan.map((d) => { const key = monthKey(d); return { label: MONTHS[d.getMonth()], value: periodOrders.filter((o) => String(o.date).startsWith(key)).reduce((a, o) => a + (Number(o.amount) || 0), 0) }; });

  // ── quantity pricing (company-scoped) ────────────────────────────────────────
  const tierEvents = showEmpty ? [] : analyticsQuantityEvents.filter((e) => e.type === 'tier_observed' && e.companyId === company.id && inPeriod(e.date));
  const tierReached = tierEvents.filter((e) => e.reached);
  const hasQuantityPricing = tierEvents.length > 0 || company.pricing?.quantity?.length > 0;
  const tierRefWeighted = (evs) => { const ref = evs.reduce((a, e) => a + (e.realizedDiscount < 100 ? e.orderValue / (1 - e.realizedDiscount / 100) : e.orderValue), 0); return ref ? evs.reduce((a, e) => a + (e.realizedDiscount < 100 ? e.orderValue / (1 - e.realizedDiscount / 100) : e.orderValue) * e.realizedDiscount, 0) / ref : null; };

  // ── contextual "what changed" sentence (after hero) ──────────────────────────
  let changedSentence = null;
  if (cmp && prevS.n > 0 && curS.n > 0) {
    const sD = salesDelta ?? 0, oD = ordersDelta ?? 0, aD = aovDelta ?? 0;
    if (Math.abs(sD) <= 12 && oD <= -20 && aD >= 20) changedSentence = 'Sales stayed roughly flat while the company placed fewer, larger orders.';
    else if (oD >= 20 && aD <= -15) changedSentence = 'The company placed more orders, but each order was smaller on average.';
    else if (sD >= 15) changedSentence = 'Sales increased compared with the previous period.';
    else if (sD <= -15) changedSentence = 'Sales decreased compared with the previous period.';
    else changedSentence = 'Sales and order patterns were broadly similar to the previous period.';
  }

  const money0 = (v) => (v == null ? '—' : money(v));
  const pct1 = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);
  const signedPct = (v) => (v == null ? '—' : `${Math.abs(v).toFixed(1)}% ${v >= 0 ? 'higher' : 'lower'}`);

  const tabs = [{ id: 'overview', content: 'Overview' }, { id: 'buying', content: 'Buying' }, { id: 'quotes', content: 'Quotes' }, { id: 'pricing', content: 'Pricing' }];

  // ── OVERVIEW ──────────────────────────────────────────────────────────────────
  const overview = (
    <s-stack gap="base">
      <s-section>
        <s-stack gap="small">
          <StatGrid narrow={2} wide={4}>
            <Stat label="Net sales" value={money(curS.rev)} delta={cmpDelta(salesDelta)} sub={cmp ? 'vs previous period' : 'in selected period'} help="Net sales generated by this company in the selected period." formula="Net sales = gross sales − discounts − returns" />
            <Stat label="Orders" value={String(curS.n)} delta={cmpDelta(ordersDelta)} sub={cmp ? 'vs previous period' : 'in selected period'} help="Number of orders placed by this company in the selected period." />
            <Stat label="Average order value" value={money(curS.aov)} delta={cmpDelta(aovDelta)} sub={cmp ? 'vs previous period' : 'per order'} help="Average net sales per order in the selected period." formula="Average order value = net sales / orders" />
            <Stat blank={compareOnly} label="Open quote value" value={money(openQuoteValue)} sub="Current snapshot · not affected by date range" help="Total value of this company's quotes that are still open as of today. Not limited to the selected date range." />
          </StatGrid>
          {changedSentence ? <s-paragraph>{changedSentence}</s-paragraph> : null}
        </s-stack>
      </s-section>

      <SectionCard title="Relationship state" subtitle="How this company is tracking against its own buying rhythm." help="Shows whether this company is still ordering around its usual schedule or has gone quieter than normal, based on its own order history.">
        <s-stack direction="inline" gap="base" alignItems="center">
          {compareOnly ? <s-text><span style={STAT_VALUE}>—</span></s-text> : (
            <>
              <s-badge tone={wcTone(STATE_TONE[relState])} size="large">{relState}</s-badge>
              {overdue != null && overdue > 0 ? <s-text color="subdued">{overdue} days past its usual reorder time</s-text> : null}
            </>
          )}
        </s-stack>
        <s-divider />
        <StatGrid narrow={2} wide={4}>
          <Stat blank={compareOnly} label="Last order" value={since == null ? '—' : `${since} days ago`} sub={last ? fmtDate(last) : undefined} help="How long ago this company placed its most recent order." />
          <Stat blank={compareOnly} label="Typical reorder" value={typical == null ? '—' : `~${typical} days`} help="How long this company typically goes between orders." formula="Typical reorder = median(days between orders)" />
          <Stat blank={compareOnly} label="Current gap" value={ratio == null ? '—' : `${ratio.toFixed(1)}× usual`} tone={ratio != null && ratio > 1.5 ? 'critical' : undefined} help="How long it has been since the last order, compared with how long this company usually waits between orders." formula="Current gap = days since last order / usual days between orders" />
          <Stat blank={compareOnly} label="Order history" value={`${allCompleted.length} orders`} help="Total number of past orders available for this company." />
        </StatGrid>
      </SectionCard>

      <SectionCard title="Attention needed" subtitle="Things in this account that may need a closer look." help="Highlights current account signals from quotes, margins, and reorder timing. These are factual indicators, not predictions.">
        {blankRows(attention).length ? (
          <div>
            {attention.map((a, i) => (
              <div key={i}>{i ? <s-divider /> : null}
                <s-box paddingBlock="small-200">
                  <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
                    <s-text>{a.text}</s-text>
                    <s-link onClick={() => setTab(a.tab)}>{['Overview', 'Buying', 'Quotes', 'Pricing'][a.tab]} →</s-link>
                  </s-grid>
                </s-box>
              </div>
            ))}
          </div>
        ) : <s-paragraph color="subdued" fontSize="small">Nothing needs attention right now.</s-paragraph>}
      </SectionCard>

      <SectionCard title="Recent activity" help="The latest orders, quotes, and pricing changes for this company, newest first." action={<s-link onClick={() => setTab(2)}>View all activity</s-link>}>
        {blankRows(allEvents).length ? <div>{allEvents.slice(0, 6).map((e, i) => <TimelineRow key={i} e={e} first={i === 0} />)}</div> : <s-paragraph color="subdued" fontSize="small">No activity yet.</s-paragraph>}
      </SectionCard>
    </s-stack>
  );

  // ── BUYING ──────────────────────────────────────────────────────────────────
  const largest = allCompleted.reduce((m, o) => Math.max(m, Number(o.amount) || 0), 0);
  const medianOrder = median(allCompleted.map((o) => Number(o.amount) || 0));
  const avgProds = allCompleted.length ? allCompleted.reduce((a, o) => a + (o.items || []).length, 0) / allCompleted.length : 0;
  // Top products — highest line revenue in the selected period (company-scoped).
  const productAgg = new Map();
  periodOrders.forEach((o) => (o.items || []).forEach((it) => {
    const cur = productAgg.get(it.sku) || { sku: it.sku, revenue: 0, qty: 0 };
    cur.revenue += Number(it.revenue) || 0;
    cur.qty += Number(it.qty) || 0;
    productAgg.set(it.sku, cur);
  }));
  const topProducts = [...productAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topMax = Math.max(1, ...topProducts.map((p) => p.revenue));
  // One basket column: a small bold title, then product lines (or "—").
  const basketColumn = (title, items) => (
    <s-stack gap="small-300">
      <s-text fontSize="small" fontWeight="semibold">{title}</s-text>
      {items.length ? items : <s-paragraph color="subdued" fontSize="small">—</s-paragraph>}
    </s-stack>
  );
  const buying = (
    <s-stack gap="base">
      <SectionCard title="Buying rhythm" subtitle="How often and how large this company orders." help="Summarizes this company's usual reorder timing and order size using its own purchase history." action={<s-link onClick={() => goTab('orders')}>View orders →</s-link>}>
        <StatGrid narrow={2} wide={4}>
          <Stat blank={compareOnly} label="Typical reorder" value={typical == null ? '—' : `${typical} days`} help="How long this company typically goes between orders." formula="Typical reorder = median(days between orders)" />
          <Stat blank={compareOnly} label="Last order" value={since == null ? '—' : `${since} days ago`} sub={last ? fmtDate(last) : undefined} help="How long ago this company placed its most recent order." />
          <Stat blank={compareOnly} label="Current gap" value={ratio == null ? '—' : `${ratio.toFixed(1)}× usual`} tone={ratio != null && ratio > 1.5 ? 'critical' : undefined} help="How long it has been since the last order, compared with how long this company usually waits between orders." formula="Current gap = days since last order / usual days between orders" />
          <Stat label="Orders in period" value={String(curS.n)} delta={cmpDelta(ordersDelta)} help="Number of orders placed in the selected period." />
          <Stat blank={compareOnly} label="Total orders" value={`${allCompleted.length}`} help="Total number of past orders for this company." />
          <Stat blank={compareOnly} label="Largest order" value={money(largest)} help="The largest order this company has placed." />
          <Stat blank={compareOnly} label="Median order value" value={money0(medianOrder)} help="The typical order size for this company, using the middle value across its order history." formula="Median order value = median(order value)" />
          <Stat blank={compareOnly} label="Products per order" value={avgProds ? avgProds.toFixed(1) : '—'} help="Average number of different products purchased in each order." formula="Products per order = products across all orders / orders" />
        </StatGrid>
      </SectionCard>

      <SectionCard title="Purchase trend" subtitle="See whether this company is spending more, less, or simply changing its order size." help="Compares this company's sales, order count, and average order value with the previous period.">
        <LineChart data={salesSeries} label="Sales over time" empty="No sales in this period yet." />
        <s-divider />
        <s-stack gap="small-200">
          <ShiftRow label="Net sales" prev={prevS.rev} cur={curS.rev} fmt={moneyShort} />
          <ShiftRow label="Orders" prev={prevS.n} cur={curS.n} />
          <ShiftRow label="Average order value" prev={prevS.aov} cur={curS.aov} fmt={moneyShort} />
        </s-stack>
        {changedSentence ? <s-paragraph fontSize="small" color="subdued">{changedSentence}</s-paragraph> : null}
      </SectionCard>

      <SectionCard title="Top products" subtitle="This company's highest-revenue products in the selected period." help="Ranks the products this company spent the most on during the selected period.">
        <RankBars rows={blankRows(topProducts).map((p) => ({ key: p.sku, name: skuName(p.sku), sub: `${p.qty.toLocaleString('en-US')} units`, value: p.revenue, width: (p.revenue / topMax) * 100, valueLabel: money(p.revenue) }))} empty="No completed orders in this period." />
      </SectionCard>

      <SectionCard title="Basket behavior" subtitle={showLapsed ? "What this company keeps buying, what's new, and what it used to buy but hasn't lately." : "What this company keeps buying and what's new in recent orders."} help="Shows recurring products, products that recently appeared for the first time, and — when there is enough order history — products that used to appear often but have not appeared lately.">
        <StatGrid narrow={1} wide={showLapsed ? 3 : 2} at={700}>
          {basketColumn('Frequently purchased', blankRows(frequently).map(([s, c]) => <s-paragraph key={s}>{skuName(s)} <s-text color="subdued" fontSize="small">· {c} of last {recent8.length}</s-text></s-paragraph>))}
          {basketColumn('New in recent orders', blankRows(newInRecent).map(([s, d]) => <s-paragraph key={s}>{skuName(s)} <s-text color="subdued" fontSize="small">· first {fmtDate(d)}</s-text></s-paragraph>))}
          {showLapsed
            ? basketColumn('Previously frequent', blankRows(previouslyFrequent).map(([s, c]) => <s-paragraph key={s}>{skuName(s)} <s-text color="subdued" fontSize="small">· was in {c} of {earlier.length}, not in last 4</s-text></s-paragraph>))
            : null}
        </StatGrid>
      </SectionCard>
    </s-stack>
  );

  // ── QUOTES ────────────────────────────────────────────────────────────────────
  const quotes = (
    <s-stack gap="base">
      <s-section>
        <StatGrid narrow={2} wide={4}>
          <Stat blank={compareOnly} label="Open quote value" value={money(openQuoteValue)} sub="Current snapshot" help="Total value of this company's quotes that are still open as of today." />
          <Stat blank={compareOnly} label="Open quotes" value={String(openQuotes.length)} help="Number of quotes that are still open and have not yet been won or lost." />
          <Stat label="Win rate" value={winRateCount == null ? '—' : `${winRateCount}%`} delta={cmpDelta(winRateDelta, { suffix: ' pp' })} sub="by count, in period" help="Share of this company's decided quotes that were won in the selected period." formula="Win rate = won quotes / (won quotes + lost quotes)" />
          <Stat blank={compareOnly} label="First response time" value={fmtDur(responseMedian)} help="How long this company's quotes typically take to receive their first price or reply." formula="First response time = median(first priced or sent − created)" />
        </StatGrid>
      </s-section>

      <SectionCard title="Open quotes to review" subtitle="Open quotes for this company, with the longest-idle quotes first." help="Shows this company's open quotes and puts the ones with the oldest activity at the top so they are easier to follow up." action={<s-link onClick={() => goTab('quotes')}>View all quotes →</s-link>}>
        {blankRows(openQuotes).length ? (
          <>
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Quote</s-table-header>
                <s-table-header listSlot="labeled" format="currency">Value</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header listSlot="labeled" format="numeric">Age</s-table-header>
                <s-table-header listSlot="labeled" format="numeric">Last activity</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {openQuotes.slice().sort((a, b) => (lastActivity(b) ?? 0) - (lastActivity(a) ?? 0)).map((q) => (
                  <s-table-row key={q.id}>
                    <s-table-cell>{`#${q.id}`}</s-table-cell>
                    <s-table-cell>{money(quoteVal(q))}</s-table-cell>
                    <s-table-cell>{q.status}</s-table-cell>
                    <s-table-cell>{`${quoteAge(q)}d`}</s-table-cell>
                    <s-table-cell>{lastActivity(q) == null ? '—' : `${lastActivity(q)}d ago`}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            {staleOpen.length ? <s-paragraph color="subdued" fontSize="small">{staleOpen.length} quote{staleOpen.length === 1 ? ' has' : 's have'} had no activity for more than 10 days.</s-paragraph> : null}
          </>
        ) : <s-paragraph color="subdued" fontSize="small">No open quotes.</s-paragraph>}
      </SectionCard>

      <SectionCard title="Quote outcomes" subtitle="How this company's quotes turned out in the selected period." help="Summarizes quotes created for this company, how many were won or lost, and how long decided quotes typically took to close.">
        <StatGrid narrow={2} wide={4}>
          <Stat label="Quotes created" value={String(periodQuotes.length)} delta={cmpDelta(quotesCreatedDelta)} help="Number of quotes created for this company in the selected period." />
          <Stat label="Won" value={String(wonP.length)} delta={cmpDelta(wonDelta)} help="Number of quotes that ended as won in the selected period." />
          <Stat label="Lost" value={String(lostP.length)} delta={cmpDelta(lostDelta, { goodDown: true })} help="Number of quotes that ended as lost in the selected period." />
          <Stat label="Win rate by count" value={winRateCount == null ? '—' : `${winRateCount}%`} delta={cmpDelta(winRateDelta, { suffix: ' pp' })} help="Share of decided quotes that were won." formula="Win rate by count = won quotes / (won quotes + lost quotes)" />
          <Stat label="Typical time to decision" value={fmtDur(decisionMedian)} delta={cmpDelta(decisionDelta, { goodDown: true })} help="How long a quote typically takes to be won or lost after it is created." formula="Typical time to decision = median(won or lost date − created date)" />
        </StatGrid>
      </SectionCard>


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
          <SectionCard title="Win rate by discount" subtitle="Compare win rate across discount ranges from the Shopify price." help="Shows the share of won quotes within each discount range, compared with your regular Shopify prices. Only won and lost quotes are included. This shows a pattern, not that the discount caused the outcome.">
            <RankBars rows={blankRows(bands).map((b) => ({ key: b.name, name: `${b.name} off`, sub: `${b.wins} of ${b.count} won or lost`, width: b.rate == null ? 0 : (b.rate / maxRate) * 100, valueLabel: b.rate == null ? '—' : `${b.rate}%` }))} empty="No won or lost quotes." />
          </SectionCard>
        ) : null;
      })()}
    </s-stack>
  );

  // ── PRICING ────────────────────────────────────────────────────────────────────
  const pricing = (
    <s-stack gap="base">
      <s-section>
        <StatGrid narrow={2} wide={4}>
          <Stat blank={compareOnly} label="B2B price vs Shopify" value={vsShopify == null ? '—' : signedPct(vsShopify)} sub="on B2B-priced lines" help="How much lower or higher this company's B2B prices are than its regular Shopify prices." formula="B2B price vs Shopify = (B2B price − Shopify price) / Shopify price" />
          <Stat label="Margin at order creation" value={pct1(marginAtCreation)} delta={cmpDelta(marginDelta, { suffix: ' pp' })} sub="costed lines" help="The share of order value you keep as profit, based on prices and product costs when each order was placed. Items without a product cost aren't included." formula="Margin at order creation = (order value − product cost) / order value" />
          <Stat label="Order value" value={money(allEcon.value)} delta={cmpDelta(orderValueDelta)} sub="in selected period" help="Total value of what this company ordered in the selected period." />
          <Stat label={`Order value below ${marginFloor}% margin`} value={money(exceptionValue)} delta={cmpDelta(exceptionDelta, { goodDown: true })} sub={`${exceptionLines.length} line${exceptionLines.length === 1 ? '' : 's'}`} help="Total value of items sold below your selected profit-margin threshold." />
        </StatGrid>
      </s-section>

      <SectionCard title="B2B pricing usage" subtitle="How much of this company's purchasing used B2B pricing in the selected period." help="Shows both how many orders used B2B pricing and how much order value actually came from B2B-priced items.">
        <StatGrid narrow={1} wide={2}>
          <Stat label="Orders using B2B pricing" value={adoptionOrders == null ? '—' : `${adoptionOrders}%`} delta={cmpDelta(adoptionOrdersDelta, { suffix: ' pp' })} sub={`${b2bOrderIds.size} of ${periodOrders.length} orders`} help="Share of this company's orders where at least one item used B2B pricing." formula="Orders using B2B pricing = orders with a B2B-priced line / orders" />
          <Stat label="Order value using B2B pricing" value={adoptionValue == null ? '—' : `${adoptionValue}%`} delta={cmpDelta(adoptionValueDelta, { suffix: ' pp' })} sub={`${money(b2bEcon.value)} of ${money(allEcon.value)} order value`} help="Share of this company's order value that came from items using B2B pricing." formula="Order value using B2B pricing = B2B-priced order value / order value" />
        </StatGrid>
        <s-paragraph>{adoptionSummary}</s-paragraph>
      </SectionCard>

      {varRows.length ? (
        <SectionCard title="Won quotes vs your pricing" subtitle="How recent won quotes compare with the pricing set for this company." help="Compares recent won quote prices with the B2B pricing that was in place for this company at the time of each quote.">
          <StatGrid narrow={1} wide={2}>
            <Stat blank={compareOnly} label="Average vs your pricing" value={`${negoAbs}%`} sub={`${negoDir} your set price`} help="Average difference between recent won quote prices and the pricing that was set for this company at the time." formula="Average vs your pricing = (won quote price − your set price) / your set price" />
            <Stat blank={compareOnly} label={below5 ? 'Below your set price' : 'At or above your set price'} value={`${below5 || varRows.length} of ${varRows.length}`} sub="recent won quotes" help={below5 ? 'Number of recent won quotes that landed below your set price.' : 'Number of recent won quotes that landed at or above your set price.'} />
          </StatGrid>
          {!compareOnly && <s-paragraph>{negoSummary}</s-paragraph>}
        </SectionCard>
      ) : null}

      <SectionCard title="Pricing performance" subtitle="How the B2B pricing this company actually buys on is performing." help="Shows the order value, margin, Shopify-price difference, and order count for each B2B pricing used by this company." action={<s-link onClick={() => goTab('pricing')}>View pricing →</s-link>}>
        {blankRows(companyProfiles).length > 1 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary"><ColHelp label="Pricing" help="The B2B pricing that set the price for these items." /></s-table-header>
              <s-table-header listSlot="labeled" format="currency"><ColHelp label="Order value" help="Total order value on this pricing in the selected period." /></s-table-header>
              <s-table-header listSlot="labeled" format="numeric"><ColHelp label="Margin" help="Profit margin on orders that used this pricing." formula="Margin = gross profit / order value" /></s-table-header>
              <s-table-header listSlot="labeled" format="numeric"><ColHelp label="vs Shopify" help="How this pricing compares with this company's regular Shopify prices." formula="vs Shopify = (B2B price − Shopify price) / Shopify price" /></s-table-header>
              <s-table-header listSlot="labeled" format="numeric"><ColHelp label="Orders" help="Number of orders that used this pricing." /></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {companyProfiles.map((p) => (
                <s-table-row key={p.name}>
                  <s-table-cell>{p.name}</s-table-cell>
                  <s-table-cell>{money(p.value)}</s-table-cell>
                  <s-table-cell>{pct1(p.margin)}</s-table-cell>
                  <s-table-cell>{p.deltaPct == null ? '—' : signedPct(p.deltaPct)}</s-table-cell>
                  <s-table-cell>{p.orders}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : blankRows(companyProfiles).length === 1 ? (
          <s-stack gap="small-200">
            <s-text fontWeight="semibold">{companyProfiles[0].name}</s-text>
            <StatGrid narrow={2} wide={4}>
              <Stat label="Order value" value={money(companyProfiles[0].value)} help="Total order value on this pricing in the selected period." />
              <Stat label="Margin" value={pct1(companyProfiles[0].margin)} help="Profit margin on orders that used this pricing." formula="Margin = gross profit / order value" />
              <Stat label="vs Shopify" value={companyProfiles[0].deltaPct == null ? '—' : signedPct(companyProfiles[0].deltaPct)} help="How this pricing compares with this company's regular Shopify prices." formula="vs Shopify = (B2B price − Shopify price) / Shopify price" />
              <Stat label="Orders" value={String(companyProfiles[0].orders)} help="Number of orders that used this pricing." />
            </StatGrid>
          </s-stack>
        ) : <s-paragraph color="subdued" fontSize="small">No B2B pricing used on orders in this period.</s-paragraph>}
      </SectionCard>

      <SectionCard title="Quantity pricing usage" subtitle="How often this company buys enough to reach the quantity pricing available to it." help="Shows whether this company reaches its available quantity tiers, how much order value those purchases create, and the average discount received.">
        {hasQuantityPricing && tierEvents.length ? (
          <StatGrid narrow={1} wide={3}>
            <Stat blank={compareOnly} label="Tier reach rate" value={tierEvents.length ? `${Math.round((tierReached.length / tierEvents.length) * 100)}%` : '—'} sub={`${tierReached.length} of ${tierEvents.length} eligible`} help="Share of eligible purchases where this company ordered enough to reach a quantity-price tier." formula="Tier reach rate = purchases that reached a tier / eligible purchases" />
            <Stat blank={compareOnly} label="Order value at reached tiers" value={money(tierReached.reduce((a, e) => a + (Number(e.orderValue) || 0), 0))} help="Total value of purchases where this company reached a quantity-price tier." />
            <Stat blank={compareOnly} label="Average tier discount" value={(() => { const d = tierRefWeighted(tierReached); return d == null ? '—' : `${d.toFixed(1)}%`; })()} help="Average discount received on purchases that reached a quantity-price tier." formula="Average tier discount = discount from tiers / value before tier discount" />
          </StatGrid>
        ) : <s-paragraph color="subdued" fontSize="small">No quantity pricing assigned.</s-paragraph>}
      </SectionCard>

      <SectionCard
        title={`Products below ${marginFloor}% margin`}
        subtitle="Products sold below your selected profit-margin threshold."
        help={`Shows products this company bought below ${marginFloor}% margin, including the value sold, margin, and pricing used. Change the threshold with the picker.`}
        action={
          <s-stack direction="inline" gap="small" alignItems="center">
            <div style={{ minWidth: 160 }}>
              <s-select
                label="Margin threshold"
                labelAccessibilityVisibility="exclusive"
                value={String(marginFloor)}
                onChange={(e) => setMarginFloor(Number(e.currentTarget.value))}
              >
                {[10, 15, 20, 25, 30].map((n) => (
                  <s-option key={n} value={String(n)}>{`Below ${n}% margin`}</s-option>
                ))}
              </s-select>
            </div>
            <s-link onClick={() => goTab('pricing')}>View pricing →</s-link>
          </s-stack>
        }
      >
        {blankRows(exceptionLines).length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary"><ColHelp label="Product" help="Product sold below the selected margin threshold." /></s-table-header>
              <s-table-header listSlot="labeled" format="currency"><ColHelp label="Value below threshold" help="Total value sold below the selected margin threshold." /></s-table-header>
              <s-table-header listSlot="labeled" format="numeric"><ColHelp label="Margin" help="Profit margin on the value shown in this row." formula="Margin = gross profit / order value" /></s-table-header>
              <s-table-header listSlot="labeled"><ColHelp label="Pricing" help="B2B pricing used for the value shown in this row." /></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {exceptionLines.slice(0, 8).map((l, i) => { const m = l.lineValue ? ((l.lineValue - l.lineCost) / l.lineValue) * 100 : 0; return (
                <s-table-row key={i}>
                  <s-table-cell>{skuName(l.sku)}</s-table-cell>
                  <s-table-cell>{money(l.lineValue)}</s-table-cell>
                  <s-table-cell>{`${m.toFixed(1)}%`}</s-table-cell>
                  <s-table-cell>{l.order.pricing && l.order.pricing !== 'None' ? l.order.pricing : '—'}</s-table-cell>
                </s-table-row>
              ); })}
            </s-table-body>
          </s-table>
        ) : <s-paragraph color="subdued" fontSize="small">No items were sold below {marginFloor}% margin in this period.</s-paragraph>}
      </SectionCard>
    </s-stack>
  );

  const body = [overview, buying, quotes, pricing][tab];
  return (
    <s-stack gap="base">
      {SHOW_DEV_TOOLS && (
        <s-box background="subdued" border="base" borderRadius="base" padding="small-200">
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge tone="info">Dev</s-badge>
              <s-text fontSize="small" color="subdued">
                {genuinelyEmpty
                  ? 'This company has no orders or quotes, so analytics is showing its empty state.'
                  : devEmpty
                  ? 'Previewing the empty state — this company actually has data.'
                  : 'Preview the analytics empty state (how it looks for a company with no orders or quotes).'}
              </s-text>
              <s-press-button pressed={devEmpty} disabled={genuinelyEmpty} onClick={() => setDevEmpty((v) => !v)}>
                {devEmpty ? 'Show data' : 'Preview empty state'}
              </s-press-button>
            </s-stack>
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge tone="info">Dev</s-badge>
              <s-text fontSize="small" color="subdued">
                {compareOnly
                  ? 'Compare only: Compare is locked to Previous period. Stats with a previous-period comparison show data; everything else shows its empty state.'
                  : 'Keep the layout but show data only for stats compared with the previous period (stats with a delta, the purchase trend).'}
              </s-text>
              <s-press-button pressed={compareOnly} disabled={genuinelyEmpty} onClick={() => setCompareOnly((v) => !v)}>
                {compareOnly ? 'Show all data' : 'Compare only'}
              </s-press-button>
            </s-stack>
          </s-stack>
        </s-box>
      )}
      {showEmpty && (
        <s-banner tone="info">
          This company hasn't placed any orders or received any quotes yet. As it starts buying and you send quotes, its buying rhythm, quotes and pricing performance will fill in below.
        </s-banner>
      )}
      {/* One bar: the section tabs, compact on the left, and the date range /
          comparison as filter buttons on the right (like Shopify Analytics). */}
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small">
        <s-box background="base" border="base" borderRadius="base" padding="small-400">
          <s-stack direction="inline" gap="small-400">
            {tabs.map((t, i) => (
              <s-press-button key={t.id} variant="tertiary" pressed={tab === i} onClick={() => setTab(i)}>{t.content}</s-press-button>
            ))}
          </s-stack>
        </s-box>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <MenuButton
            icon="calendar"
            disabled={showEmpty}
            items={PERIOD_OPTIONS.map((o) => ({ content: o.label, onAction: () => setPeriod(o.value) }))}
          >
            {PERIOD_OPTIONS.find((o) => o.value === period)?.label}
          </MenuButton>
          <MenuButton
            icon="calendar-time"
            disabled={showEmpty || compareOnly}
            items={COMPARE_OPTIONS.map((o) => ({ content: o.label, onAction: () => setCompare(o.value) }))}
          >
            {COMPARE_OPTIONS.find((o) => o.value === (compareOnly ? 'previous' : compare))?.label}
          </MenuButton>
        </s-stack>
      </s-stack>
      {body}
    </s-stack>
  );
}
