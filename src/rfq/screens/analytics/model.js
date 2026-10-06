// Analytics model: turns the prototype's RFQ quotes (store state) into the numbers the
// production endpoints return (quoteAnalytic slice + /analytics-reports/profit-leak),
// then the same client-side series building as production's DataVisualize / leakChartData.
import { quoteAmount, money2 } from '../../utils.js';
import { SUBMISSION_ORDER } from '../../data/submissions.js';
import { NUMBER_FORMAT, fmt } from './copy.js';
import {
  DEMO_NOW,
  DRAFT_ORDER_CREATED_AT,
  UNIT_COSTS,
  CLICK_SHARE,
  PRODUCT_INFO,
  TARGET_MARGIN_PERCENT,
  buttonClicksOn,
} from './data.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

// ── Dates ────────────────────────────────────────────────────────────────────
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
// date-fns "PP" (en-US): "Aug 9, 2026"
export const formatPP = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
// date-fns "MMM d": "Aug 9"
export const formatMonthDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
// utils/formatDate.formatReportDate: "Aug 9, 2026"
export const formatReportDate = (value) => {
  const d = parseYmd(value) || new Date(value);
  return Number.isNaN(d.getTime()) ? '' : formatPP(d);
};

export const TODAY = startOfDay(DEMO_NOW);

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// "Received by Aug 05 2026, 11:10 AM" → Date
export function parseReceived(received) {
  const m = /([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)/.exec(String(received || ''));
  if (!m || MONTHS[m[1]] == null) return null;
  let h = Number(m[4]) % 12;
  if (m[6] === 'PM') h += 12;
  return new Date(Number(m[3]), MONTHS[m[1]], Number(m[2]), h, Number(m[5]));
}

// ── Formatting ───────────────────────────────────────────────────────────────
export const money = (v) => {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return n < 0 ? `-${money2(-n)}` : money2(n);
};
// hooks/useFormatNumberToString
export function formatNumberToString(num) {
  const steps = [
    [1e12, 'trillion'],
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
  ];
  for (const [value, symbol] of steps) {
    if (num >= value) return fmt(NUMBER_FORMAT[symbol], { number: (num / value).toFixed(1).replace(/\.0$/, '') });
  }
  return String(num);
}
const round2 = (n) => Math.round(n * 100) / 100;

// ── Quotes → facts ───────────────────────────────────────────────────────────
const SEED_IDS = new Set(SUBMISSION_ORDER);

export function quoteLines(q) {
  if (Array.isArray(q.lines) && q.lines.length) {
    return q.lines.map((l) => ({ title: l.title, sku: l.sku, price: Number(l.price) || 0, qty: Number(l.qty) || 0 }));
  }
  const p = q.product || {};
  return [{ title: p.name, sku: p.sku, price: Number(p.price) || 0, qty: Number(p.quantity) || 1 }];
}

// One row per quote, like the quotes the production API returns for a date range.
export function buildQuoteFacts(state) {
  return (state.order || [])
    .filter((id) => state.quotes[id])
    .map((id) => {
      const q = state.quotes[id];
      const meta = state.meta[id] || {};
      // Quotes created in this session ("Create quote") are dated "now".
      const createdAt = (SEED_IDS.has(id) && parseReceived(q.received)) || DEMO_NOW;
      const converted = meta.progress === 'Draft Order Created' || meta.status === 'Deal Closed';
      return {
        id,
        number: q.number || id,
        createdAt,
        value: quoteAmount(q),
        name: q.customer?.name || '',
        email: q.customer?.email || '',
        lines: quoteLines(q),
        status: meta.status,
        converted,
        draftOrderAt: converted ? DRAFT_ORDER_CREATED_AT[id] || createdAt : null,
        rejected: meta.status === 'Deal Rejected',
      };
    })
    .filter((f) => f.status !== 'Trashed');
}

const inWindow = (date, start, end) => date >= start && date <= end;

// Largest-remainder split of `total` by integer shares.
function splitByShare(total, items) {
  const sum = items.reduce((s, it) => s + it.share, 0) || 1;
  const raw = items.map((it) => ({ ...it, exact: (total * it.share) / sum }));
  const out = raw.map((it) => ({ ...it, value: Math.floor(it.exact) }));
  let left = total - out.reduce((s, it) => s + it.value, 0);
  [...out]
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
    .forEach((it) => {
      if (left > 0) {
        it.value += 1;
        left -= 1;
      }
    });
  return out;
}

// ── Quote analytics (overview) ───────────────────────────────────────────────
export function computeOverview(facts, start, end) {
  const quotes = facts.filter((f) => inWindow(f.createdAt, start, end));
  const totalQuotes = quotes.length;
  const totalQuoteValue = quotes.reduce((s, f) => s + f.value, 0);
  const convertedQuotes = quotes.filter((f) => f.converted);
  const totalQuotesConverted = convertedQuotes.length;
  const totalQuotesRejected = quotes.filter((f) => f.rejected).length;
  const isSingleDate = isSameDay(start, end);

  // DataVisualize.formatDataByDateRange / formatDataBySingleDate
  const sameSlot = (date, day, hour) => isSameDay(date, day) && (hour === undefined || date.getHours() === hour);
  const slots = [];
  if (isSingleDate) {
    for (let hour = 0; hour < 24; hour += 1) slots.push({ day: start, hour, key: `${ymd(start)} ${pad(hour)}:00` });
  } else {
    for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) slots.push({ day: d, key: ymd(d) });
  }
  const quotesValueOverTimes = [];
  const quotesCountOverTimes = [];
  const conversionRateOverTimes = [];
  let accumulation = 0;
  slots.forEach(({ day, hour, key }) => {
    const ofSlot = quotes.filter((f) => sameSlot(f.createdAt, day, hour));
    const draftOrdersOfSlot = convertedQuotes.filter((f) => sameSlot(f.draftOrderAt, day, hour));
    accumulation += ofSlot.length;
    const rate = accumulation === 0 ? 0 : (draftOrdersOfSlot.length / accumulation) * 100;
    accumulation -= draftOrdersOfSlot.length;
    quotesValueOverTimes.push({ key, value: ofSlot.reduce((s, f) => s + f.value, 0) });
    quotesCountOverTimes.push({ key, value: ofSlot.length });
    conversionRateOverTimes.push({ key, value: parseFloat(rate.toFixed(2)) });
  });

  // Storefront quote-button clicks (daily, also for a single date — as the API returns).
  const buttonClicksDaily = [];
  const clickToQuoteRateDaily = [];
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
    const count = buttonClicksOn(d);
    const quotesOfDay = quotes.filter((f) => isSameDay(f.createdAt, d)).length;
    buttonClicksDaily.push({ date: ymd(d), count });
    clickToQuoteRateDaily.push({ date: ymd(d), rate: count ? round2((quotesOfDay / count) * 100) : 0 });
  }
  const totalButtonClicks = buttonClicksDaily.reduce((s, it) => s + it.count, 0);
  const clickToQuoteRate = totalButtonClicks ? round2((totalQuotes / totalButtonClicks) * 100) : 0;

  const topProductsClicked = splitByShare(totalButtonClicks, CLICK_SHARE)
    .filter((it) => it.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((it) => ({
      product_id: it.id,
      product_title: it.title,
      product_image: PRODUCT_INFO[it.title]?.image || null,
      product_handle: PRODUCT_INFO[it.title]?.handle || null,
      clicks: it.value,
    }));

  const productMap = new Map();
  convertedQuotes.forEach((f) =>
    f.lines.forEach((l) => {
      const cur = productMap.get(l.title) || {
        productId: l.sku || l.title,
        productTitle: l.title,
        productImage: PRODUCT_INFO[l.title]?.image || null,
        handle: PRODUCT_INFO[l.title]?.handle || null,
        quotedQuantity: 0,
      };
      cur.quotedQuantity += 1;
      productMap.set(l.title, cur);
    }),
  );
  const productRankings = [...productMap.values()].sort((a, b) => b.quotedQuantity - a.quotedQuantity);

  const customerMap = new Map();
  quotes.forEach((f) => {
    const cur = customerMap.get(f.email) || { customerName: f.name, customerEmail: f.email, quotedQuantity: 0 };
    cur.quotedQuantity += 1;
    customerMap.set(f.email, cur);
  });
  const customerRankings = [...customerMap.values()].sort(
    (a, b) => b.quotedQuantity - a.quotedQuantity || a.customerEmail.localeCompare(b.customerEmail),
  );

  return {
    totalQuotes,
    totalQuoteValue,
    totalQuotesConverted,
    totalQuotesRejected,
    isSingleDate,
    quotesValueOverTimes,
    quotesCountOverTimes,
    conversionRateOverTimes,
    buttonClicksDaily,
    clickToQuoteRateDaily,
    totalButtonClicks,
    clickToQuoteRate,
    topProductsClicked,
    productRankings,
    customerRankings,
  };
}

// ── Profit leak report ───────────────────────────────────────────────────────
// A quote can be analyzed only when every line has a cost per item.
function analyzeQuote(f) {
  if (!f.lines.every((l) => UNIT_COSTS[l.sku] != null)) return null;
  const revenue = f.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const cost = f.lines.reduce((s, l) => s + UNIT_COSTS[l.sku] * l.qty, 0);
  const profit = round2(revenue - cost);
  const margin = revenue ? Math.round((profit / revenue) * 1000) / 10 : 0;
  const leak = margin < TARGET_MARGIN_PERCENT ? round2((revenue * TARGET_MARGIN_PERCENT) / 100 - profit) : 0;
  return { fact: f, revenue, profit, margin, leak };
}

const WEEKLY_GROUPING_THRESHOLD_DAYS = 45;
// ProfitLeakReport/leakChartData.buildLeakOverTimeSeries (local days).
export function buildLeakOverTimeSeries(leakingQuotes, windowDays, endDate) {
  const bucketSizeDays = windowDays > WEEKLY_GROUPING_THRESHOLD_DAYS ? 7 : 1;
  const bucketCount = Math.ceil(windowDays / bucketSizeDays);
  const windowEnd = startOfDay(endDate);
  const windowStart = addDays(windowEnd, -(windowDays - 1));
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketEnd = addDays(windowEnd, -(bucketCount - 1 - i) * bucketSizeDays);
    const candidate = addDays(bucketEnd, -(bucketSizeDays - 1));
    const bucketStart = candidate < windowStart ? windowStart : candidate;
    const key = bucketSizeDays > 1 ? `${ymd(bucketStart)}|${ymd(bucketEnd)}` : ymd(bucketStart);
    return { key, start: bucketStart.getTime(), end: bucketEnd.getTime(), value: 0 };
  });
  leakingQuotes.forEach((q) => {
    const t = startOfDay(q.createdAt).getTime();
    const bucket = buckets.find((b) => t >= b.start && t <= b.end);
    if (bucket) bucket.value = round2(bucket.value + q.leak_amount);
  });
  return buckets.map(({ key, value }) => ({ key, value }));
}

export function computeProfitLeak(facts, start, end) {
  const days = Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1;
  const inRange = facts.filter((f) => inWindow(f.createdAt, start, end));
  const analyzed = inRange.map(analyzeQuote).filter(Boolean);
  const below = analyzed.filter((a) => a.margin < TARGET_MARGIN_PERCENT);
  const totalLeak = round2(below.reduce((s, a) => s + a.leak, 0));

  const prevEnd = new Date(startOfDay(start).getTime() - 1000);
  const prevStart = addDays(startOfDay(start), -days);
  const previousLeak = round2(
    facts
      .filter((f) => inWindow(f.createdAt, prevStart, prevEnd))
      .map(analyzeQuote)
      .filter((a) => a && a.margin < TARGET_MARGIN_PERCENT)
      .reduce((s, a) => s + a.leak, 0),
  );

  const quotes = [...below]
    .sort((a, b) => b.fact.createdAt - a.fact.createdAt)
    .map((a) => ({
      quote_id: a.fact.number,
      createdAt: a.fact.createdAt,
      email: a.fact.email,
      margin_percent: a.margin,
      quote_value: a.revenue,
      profit: a.profit,
      leak_amount: a.leak,
    }));

  const customerMap = new Map();
  below.forEach((a) => {
    const cur = customerMap.get(a.fact.email) || { email: a.fact.email, quote_count: 0, leak_amount: 0 };
    cur.quote_count += 1;
    cur.leak_amount = round2(cur.leak_amount + a.leak);
    customerMap.set(a.fact.email, cur);
  });
  const productMap = new Map();
  below.forEach((a) =>
    a.fact.lines.forEach((l) => {
      const share = a.revenue ? (l.price * l.qty) / a.revenue : 0;
      const cur = productMap.get(l.title) || {
        title: l.title,
        image: PRODUCT_INFO[l.title]?.image || null,
        handle: PRODUCT_INFO[l.title]?.handle || null,
        leak_amount: 0,
      };
      cur.leak_amount = round2(cur.leak_amount + a.leak * share);
      productMap.set(l.title, cur);
    }),
  );

  return {
    days,
    target_margin_percent: TARGET_MARGIN_PERCENT,
    total_leak_amount: totalLeak,
    previous_total_leak_amount: previousLeak,
    below_target_quote_count: below.length,
    quote_count_analyzed: analyzed.length,
    quote_count_total: inRange.length,
    quotes,
    customers: [...customerMap.values()].sort((a, b) => b.leak_amount - a.leak_amount),
    products: [...productMap.values()].sort((a, b) => b.leak_amount - a.leak_amount),
    series: buildLeakOverTimeSeries(quotes, days, end),
  };
}

// ProfitLeakHighlightCard: always the last 90 days.
export function leakSummary90(facts) {
  return computeProfitLeak(facts, addDays(TODAY, -89), endOfDay(TODAY));
}
