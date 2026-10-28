// Order limits: rules on what a B2B buyer or D2C wholesale customer can check out. Two kinds:
//   order   — a minimum / maximum order value and / or total quantity. The value
//             is the cart subtotal (cart.cost.subtotalAmount: B2B prices, before
//             tax, shipping and order-level discounts), set in the store currency
//             and converted with presentmentCurrencyRate for buyers paying in another.
//             Over the maximum value (`maxAction`), checkout is blocked, or — B2B
//             only — the buyer can send the order for review instead.
//   product — rules, each a minimum, maximum and increment (case packs) on a set
//             of products, checked per variant like Shopify's B2B quantity rules.
//             A product is in at most one rule of a limit. Kept in the
//             app, not synced to those: they sit on catalog price lists shared by
//             every location on the catalog, and a location with several catalogs
//             takes the cheapest one's — so they can't follow a company / location.
// A limit applies store-wide, or to companies (every location, including ones
// added later) and / or single locations (`companyId::locationId`). In production
// order and product limits are a Cart and Checkout Validation function, which reads
// the buyer's company location: cart, checkout (express too) and draft orders,
// though merchants can bypass it on a draft; blockOnFailure on, so a failing
// function blocks checkout. It doesn't run for POS, order edits, the Create Order
// API or subscriptions. A maximum sent for review works on every plan: the app's
// theme embed stops the cart going to checkout and lets the buyer reduce the order
// or send an order request (a draft order for the merchant to review), and the
// validation function blocks a checkout that gets past it (express buttons, a
// direct checkout link). An order the merchant already approved — an accepted
// quote, which opens its own checkout (a draft order) right away, or an approved
// order request — isn't sent for review again there; its other limits still apply.
//
// Like pricing, a limit is for B2B buyers (audienceType 'b2b', above) or for D2C
// Wholesale customers outside a company ('d2c'): all, logged-in or non-logged-in
// customers, or specific customers / customer tags (customerTarget +
// customerTargetIds). B2B buyers only get their company's limits. For D2C the
// validation function reads the buyer's customer and tags instead; sending a
// maximum for review is B2B only (the request is a draft order for a company location).
//
// Explicit data. A limit stores each setting with its mode, never as a special
// number: { mode: 'inherit' } (left empty: the wider limits decide), { mode: 'set',
// value } or { mode: 'none' } (explicitly no limit here — it lifts a wider one).
// Order limits keep theirs in `settings`; product rules in `min`, `max` and
// `increment`. The editor works on a flat draft of strings (toDraft /
// normalizeLimit): empty = inherit, 0 for a minimum = none, 1 for a pack = none.
//
// One resolver, one record. resolveBuyer turns the limits that reach a buyer on a
// day into that buyer's effective rules: each setting with the value in force and
// where it comes from (limit, level), each product's minimum, maximum and pack —
// every field taken on its own from the most specific limit that sets it, so a
// location's maximum keeps the company's pack — and every setting another limit
// overrode. When several limits set the same thing, the most specific one wins
// (an Active contract's > location > company > store-wide; for D2C a specific
// customer > a customer tag > all, logged-in or non-logged-in customers); at the
// same level, the strictest, then the one updated last. A product a contract limit
// sets follows the contract's limits only.
// The cart, product page, location card and held orders all read that record. Records are cached per version of the limits; in production the app
// keeps them (a metafield on each company location) and rebuilds them on the
// events that change them — a limit saved, turned on or off or deleted, a contract
// starting or ending, a location added or removed, a limit's date — so the
// validation function only reads numbers.
//
// A maximum order value can count one order, or every order in a week (Monday to
// Sunday) or a month (`period`), so splitting an order doesn't get around it. Each
// period is its own setting: a buyer can have a per-order maximum and a monthly one.
// The cart adds up what the buyer ordered in the period (spentSoFar); in production
// the app keeps that on the buyer's record, updated as orders come in, for the
// validation function to read. Minimums and quantities always count one order.
//
// Limits that win different settings can still contradict each other (an order
// maximum below a product's minimum). Each contradiction is settled so buyers can
// still order: the higher-ranked limit applies, and at the same rank neither does
// (two product limits: the newer one). The app checks only the limits picked for one
// contract against each other, in its editor (contractLimitConflicts), and only what
// needs no prices; elsewhere merchants keep their limits consistent.
//
// A limit can have dates: it applies from its start date through its end date
// (both optional, YYYY-MM-DD). Turned on with a start date still to come it is
// Upcoming; after its end date, Expired (limitState). Where an Active contract gives
// it, it applies on the contract's dates instead.
import { COLLECTIONS } from './data/constants.js';
import { money } from './format.js';
import { companyForCustomerEmail, scopeCollections, TODAY } from './pricing.js';

export const LIMIT_KINDS = {
  order: { label: 'Order limit', description: 'A minimum or maximum order value or total quantity.' },
  product: { label: 'Product limit', description: 'Minimum, maximum and case-pack quantities on selected products.' },
};

export const ORDER_FIELDS = ['minValue', 'maxValue', 'minQty', 'maxQty'];
const PRODUCT_FIELDS = ['min', 'max', 'increment'];

// ── Settings ────────────────────────────────────────────────────────────────
const INHERIT = { mode: 'inherit' };
const NONE = { mode: 'none' };
const setTo = (value) => ({ mode: 'set', value });
const isSetting = (s) => !!s && typeof s === 'object' && typeof s.mode === 'string';
// A setting's number in force, or null (inherit or none).
const num = (s) => (s && s.mode === 'set' ? s.value : null);
const isMinField = (f) => f === 'minValue' || f === 'minQty' || f === 'min';
// For comparing settings: none is no minimum (0), no maximum (Infinity), no pack (1).
// A higher minimum or pack is stricter; a lower maximum.
function strictValue(field, s) {
  if (s.mode === 'set') return s.value;
  if (field === 'increment') return 1;
  return isMinField(field) ? 0 : Infinity;
}
const higherIsStricter = (field) => isMinField(field) || field === 'increment';

// Draft (editor strings) ↔ setting. Empty = inherit; 0 for a minimum and 1 for a
// pack = none.
function fromInput(v, field) {
  if (isSetting(v)) return v;
  if (v === '' || v == null || Number.isNaN(Number(v))) return INHERIT;
  const n = Number(v);
  if ((isMinField(field) && n === 0) || (field === 'increment' && n === 1)) return NONE;
  return setTo(n);
}
function toInput(s, field) {
  if (!isSetting(s)) return s == null ? '' : String(s);
  if (s.mode === 'set') return String(s.value);
  if (s.mode === 'none') return isMinField(field) ? '0' : field === 'increment' ? '1' : '';
  return '';
}

// An order limit's setting (inherit when it has none for that field).
export const settingOf = (l, field) => (l.settings && isSetting(l.settings[field]) ? l.settings[field] : INHERIT);
const ruleSetting = (r, field) => (isSetting(r[field]) ? r[field] : INHERIT);
// The key a setting competes on: a maximum sent for review competes with other
// review maximums ('threshold'), not with blocking ones — a buyer can have both.
const orderKey = (l, field) => (field === 'maxValue' && l.maxAction === 'review' ? 'threshold' : field);
// What a maximum order value counts: one order, or every order in a week or month.
export const PERIODS = ['order', 'week', 'month'];
const periodOf = (l, field) => (field === 'maxValue' && PERIODS.includes(l.period) ? l.period : 'order');
// The key a setting competes on, with its period: 'maxValue', 'threshold@month', …
const settingKey = (l, field) => {
  const k = orderKey(l, field);
  const p = periodOf(l, field);
  return p === 'order' ? k : `${k}@${p}`;
};
const keyPeriod = (key) => key.split('@')[1] || 'order';
const baseKey = (key) => key.split('@')[0];

// ── Limits ──────────────────────────────────────────────────────────────────
// One rule of a product limit (a draft): which products, and their quantities.
export const newProductRule = () => ({
  id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
  scopeType: 'products', collection: '', selectedProducts: [], min: null, max: null, increment: null,
});
// A product limit's rules. Limits saved before rules held one rule on the limit itself.
export const productRules = (l) =>
  Array.isArray(l.rules)
    ? l.rules
    : [{ id: 'r1', scopeType: l.scopeType || 'products', collection: l.collection || '', selectedProducts: l.selectedProducts || [], min: l.min ?? null, max: l.max ?? null, increment: l.increment ?? null }];

// A new limit, as an editor draft (normalizeLimit turns it into a stored limit).
export function newLimit(kind) {
  return {
    id: null,
    name: '',
    kind,
    status: 'Active',
    ...Object.fromEntries(ORDER_FIELDS.map((k) => [k, null])),
    maxAction: 'block', // over the maximum value: 'block' checkout, or 'review' (B2B)
    period: 'order', // the maximum value counts each order, or every order in a week or month
    audienceType: 'b2b',
    storeWide: true,
    companyIds: [],
    locationKeys: [],
    customerTarget: 'all',
    customerTargetIds: [],
    message: '',
    startDate: null, // null: from now
    endDate: null, // null: no end
    ...(kind === 'product' ? { rules: [newProductRule()] } : {}),
  };
}

// Where a limit is on a day: 'Inactive' (turned off), 'Upcoming' (its start date is
// still to come), 'Active' (it applies) or 'Expired' (its end date has passed).
export function limitState(l, at = TODAY) {
  if (l.status !== 'Active') return 'Inactive';
  if (l.startDate && l.startDate > at) return 'Upcoming';
  if (l.endDate && l.endDate < at) return 'Expired';
  return 'Active';
}

export const isD2CLimit = (l) => l.audienceType === 'd2c';
const PICKED_TARGETS = ['specific', 'tags'];

// A stored limit holds settings; a draft holds strings (or, saved before settings, numbers).
const isStored = (l) => (l.kind === 'order' ? !!l.settings : (l.rules || []).some((r) => PRODUCT_FIELDS.some((f) => isSetting(r[f]))));

// A stored limit as an editor draft.
export function toDraft(l) {
  const d = JSON.parse(JSON.stringify(l));
  if (l.kind === 'order') {
    ORDER_FIELDS.forEach((k) => { d[k] = toInput(settingOf(l, k), k); });
    delete d.settings;
  } else {
    d.rules = productRules(l).map((r) => ({ ...r, ...Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, toInput(r[f], f)])) }));
  }
  return d;
}

const toNumber = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
// An editor draft (or a stored limit) as a stored limit: explicit settings, clean targets.
export function normalizeLimit(input) {
  const d = isStored(input) ? toDraft(input) : input;
  const l = { ...d, name: (d.name || '').trim(), message: (d.message || '').trim(), startDate: d.startDate || null, endDate: d.endDate || null };
  l.maxAction = l.maxAction === 'review' && !isD2CLimit(l) ? 'review' : 'block';
  if (l.kind === 'order') l.period = PERIODS.includes(l.period) ? l.period : 'order';
  else delete l.period;
  if (l.kind === 'order') {
    l.settings = Object.fromEntries(ORDER_FIELDS.map((k) => [k, fromInput(d[k], k)]));
    delete l.rules;
  } else {
    l.rules = productRules(d).map((r) => ({ ...r, ...Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, fromInput(r[f], f)])) }));
  }
  [...ORDER_FIELDS, ...PRODUCT_FIELDS, 'scopeType', 'collection', 'selectedProducts', 'threshold'].forEach((k) => delete l[k]);
  if (isD2CLimit(l)) {
    Object.assign(l, { storeWide: false, companyIds: [], locationKeys: [] });
    if (!PICKED_TARGETS.includes(l.customerTarget)) l.customerTargetIds = [];
  } else {
    Object.assign(l, { audienceType: 'b2b', customerTarget: 'all', customerTargetIds: [] });
    if (l.storeWide) { l.companyIds = []; l.locationKeys = []; }
  }
  return l;
}

// Limits saved in an older shape: review thresholds (now an order limit's maximum
// sent for review) and plain numbers (now settings; an empty field inherits).
export const upgradeLimits = (limits) =>
  limits.map((l) => {
    const x = l.kind === 'review' ? { ...l, kind: 'order', maxValue: l.threshold, maxAction: 'review' } : l;
    return isStored(x) ? { maxAction: 'block', ...x } : normalizeLimit({ maxAction: 'block', ...x });
  });

export const limitKey = (companyId, locationId) => `${companyId}::${locationId}`;

const units = (n) => `${n} unit${n === 1 ? '' : 's'}`;

// The products one rule of a product limit covers.
export function ruleSkus(r, db) {
  if (r.scopeType === 'all') return (db.products || []).map((p) => p.sku);
  if (r.scopeType === 'collection') return [...new Set(scopeCollections(r).flatMap((c) => COLLECTIONS[c] || []))];
  return r.selectedProducts || [];
}
// What a rule's quantities attach to: its products, or '*' for every product (one
// entry, not one per product).
const ruleTargets = (r, db) => (r.scopeType === 'all' ? ['*'] : ruleSkus(r, db));

export function productScopeLabel(r) {
  if (r.scopeType === 'all') return 'all products';
  if (r.scopeType === 'collection') {
    const cs = scopeCollections(r);
    return cs.length === 1 ? cs[0] : `${cs.length} collections`;
  }
  const n = (r.selectedProducts || []).length;
  return `${n} product${n === 1 ? '' : 's'}`;
}

// ── What a limit sets, as text ───────────────────────────────────────────────
const ORDER_TEXT = {
  minValue: [(v) => `Minimum order ${money(v)}`, 'No minimum order'],
  maxValue: [(v) => `Maximum order ${money(v)}`, 'No maximum order'],
  threshold: [(v) => `Orders over ${money(v)} need your review`, 'No review maximum'],
  minQty: [(v) => `At least ${units(v)} per order`, 'No minimum quantity'],
  maxQty: [(v) => `At most ${units(v)} per order`, 'No maximum quantity'],
};
const PERIOD_TEXT = {
  maxValue: [(v, p) => `Maximum ${money(v)} per ${p}`, (p) => `No ${p}ly maximum`],
  threshold: [(v, p) => `Orders over ${money(v)} a ${p} need your review`, (p) => `No ${p}ly review maximum`],
};
function settingText(key, s) {
  const p = keyPeriod(key);
  const b = baseKey(key);
  if (p === 'order') return s.mode === 'set' ? ORDER_TEXT[b][0](s.value) : ORDER_TEXT[b][1];
  return s.mode === 'set' ? PERIOD_TEXT[b][0](s.value, p) : PERIOD_TEXT[b][1](p);
}
const PRODUCT_TEXT = {
  min: [(v) => `min ${v}`, 'no minimum'],
  max: [(v) => `max ${v}`, 'no maximum'],
  increment: [(v) => `multiples of ${v}`, 'no pack size'],
};
// A product rule's quantities, e.g. "min 12, multiples of 12".
const ruleParts = (r) =>
  PRODUCT_FIELDS.map((f) => [f, ruleSetting(r, f)])
    .filter(([, s]) => s.mode !== 'inherit')
    .map(([f, s]) => (s.mode === 'set' ? PRODUCT_TEXT[f][0](s.value) : PRODUCT_TEXT[f][1]))
    .join(', ');

// The settings a limit makes (not the ones it leaves to wider limits), each as a
// line of text. An order setting carries its `key` and `value` (null for none); a
// product rule carries the rule and what it attaches to (`targets`).
export function limitRules(l, db) {
  if (l.kind === 'order') {
    return ORDER_FIELDS.map((field) => ({ field, key: settingKey(l, field), s: settingOf(l, field) }))
      .filter((x) => x.s.mode !== 'inherit')
      .map((x) => ({ ...x, value: num(x.s), text: settingText(x.key, x.s) }));
  }
  return productRules(l).flatMap((r) => {
    const parts = ruleParts(r);
    if (!parts) return [];
    const text = `${parts} on ${productScopeLabel(r)}`;
    return [{ rule: r, targets: ruleTargets(r, db), text: text[0].toUpperCase() + text.slice(1) }];
  });
}

export const limitSummary = (l, db) => limitRules(l, db).map((r) => r.text).join(' · ') || 'No limit set';

// What buyers see when an order breaks the limit, unless the merchant wrote their
// own. A setting of none never stops an order, so it has no message.
export function defaultLimitMessage(l) {
  if (l.kind === 'product') {
    const rules = productRules(l);
    if (rules.length > 1) return 'This product has a minimum, maximum or pack size.';
    const r = rules[0] || {};
    const [min, max, pack] = PRODUCT_FIELDS.map((f) => num(ruleSetting(r, f)));
    if (pack > 1) return `This product is sold in packs of ${pack}${min ? `, minimum ${min}` : ''}.`;
    const parts = [min && `at least ${min}`, max && `at most ${max}`].filter(Boolean);
    return parts.length ? `You can order ${parts.join(' and ')} per order.` : '';
  }
  const v = (k) => num(settingOf(l, k));
  if (v('minValue')) return `Your order must be at least ${money(v('minValue'))} to check out.`;
  if (v('maxValue') != null) {
    const p = l.period && l.period !== 'order' ? l.period : null;
    if (p) {
      return l.maxAction === 'review'
        ? `Your limit is ${money(v('maxValue'))} a ${p}. Reduce your order or send an order request.`
        : `Your orders can’t add up to more than ${money(v('maxValue'))} a ${p}.`;
    }
    return l.maxAction === 'review'
      ? `Your current limit is ${money(v('maxValue'))}. Reduce your order or send an order request.`
      : `Orders can’t be more than ${money(v('maxValue'))}.`;
  }
  if (v('minQty')) return `Your order needs at least ${units(v('minQty'))}.`;
  if (v('maxQty') != null) return `Orders can’t have more than ${units(v('maxQty'))}.`;
  return '';
}

export const isLimitAssigned = (l) =>
  isD2CLimit(l)
    ? !PICKED_TARGETS.includes(l.customerTarget) || !!(l.customerTargetIds || []).length
    : !!(l.storeWide || (l.companyIds || []).length || (l.locationKeys || []).length);

const D2C_TARGET_LABEL = { all: 'All customers', logged_in: 'Logged-in customers', logged_out: 'Non logged-in customers' };

export function limitTargetsLabel(l, db) {
  if (isD2CLimit(l)) {
    const ids = l.customerTargetIds || [];
    if (!PICKED_TARGETS.includes(l.customerTarget)) return D2C_TARGET_LABEL[l.customerTarget] || D2C_TARGET_LABEL.all;
    if (!ids.length) return 'Not assigned';
    if (l.customerTarget === 'tags') {
      return ids.length === 1 ? `Tag: ${(db.tagPricing || []).find((t) => t.id === ids[0])?.name || ids[0]}` : `${ids.length} customer tags`;
    }
    return ids.length === 1 ? (db.customers || []).find((c) => c.id === ids[0])?.name || 'Customer' : `${ids.length} customers`;
  }
  if (l.storeWide) return 'Store-wide';
  const companyIds = l.companyIds || [];
  const locationKeys = l.locationKeys || [];
  if (!companyIds.length && !locationKeys.length) return 'Not assigned';
  const companyName = (id) => (db.companies || []).find((c) => c.id === id)?.name || 'Company';
  if (companyIds.length + locationKeys.length === 1) {
    if (companyIds.length) return companyName(companyIds[0]);
    const [cid, lid] = locationKeys[0].split('::');
    const loc = (db.companies || []).find((c) => c.id === cid)?.locations?.find((x) => x.id === lid);
    return `${loc?.name || 'Location'} · ${companyName(cid)}`;
  }
  return [
    companyIds.length && `${companyIds.length} compan${companyIds.length === 1 ? 'y' : 'ies'}`,
    locationKeys.length && `${locationKeys.length} location${locationKeys.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');
}

// How a limit reaches a location, if it does: 'location' | 'company' | 'store'.
export function limitLevel(l, companyId, locationId) {
  if (isD2CLimit(l)) return null;
  if ((l.locationKeys || []).includes(limitKey(companyId, locationId))) return 'location';
  if ((l.companyIds || []).includes(companyId)) return 'company';
  if (l.storeWide) return 'store';
  return null;
}

// How a D2C limit reaches a customer outside a company (null: not logged in), if
// it does: 'customer' | 'tag' | 'everyone'.
export function customerLimitLevel(l, customer) {
  if (!isD2CLimit(l)) return null;
  const ids = l.customerTargetIds || [];
  if (l.customerTarget === 'specific') return customer && ids.includes(customer.id) ? 'customer' : null;
  if (l.customerTarget === 'tags') return (customer?.tags || []).some((t) => ids.includes(t)) ? 'tag' : null;
  if (l.customerTarget === 'logged_in') return customer ? 'everyone' : null;
  if (l.customerTarget === 'logged_out') return customer ? null : 'everyone';
  return 'everyone';
}

const LEVEL_RANK = { location: 3, company: 2, store: 1, customer: 3, tag: 2, everyone: 1 };
const atLocation = (companyId, locationId) => (l) => limitLevel(l, companyId, locationId);
const customerKey = (cu) => (cu ? `cu:${cu.id || ''}:${[...(cu.tags || [])].sort().join(',')}` : 'guest');

// The Active contract giving a limit here, by number (`contractAt`: location keys, or
// `companyId::*` for all of a company's — agreements.js stampContractLimits), else
// null. There it applies on the contract's dates, whatever its own, and outranks
// every other limit: rank 4, above a location's own.
const contractAtBuyer = (limit, buyerKey) => {
  const key = String(buyerKey || '').split('|')[0];
  const at = limit.contractAt || {};
  return at[key] || at[`${key.split('::')[0]}::*`] || null;
};
const CONTRACT_RANK = 4;

// ── The resolver ─────────────────────────────────────────────────────────────
// Every setting the limits that reach a buyer on a day make there (not the ones
// they inherit), with how specific each is (rank). A product setting is per
// product (`target`: a SKU, or '*' for a rule on all products) and per field.
function claimsFor(db, levelOf, at, buyerKey) {
  const reach = [];
  const claims = [];
  (db.limits || []).forEach((limit) => {
    const contract = contractAtBuyer(limit, buyerKey);
    if (contract ? limit.status !== 'Active' : limitState(limit, at) !== 'Active') return;
    const level = levelOf(limit);
    if (!level) return;
    const rank = contract ? CONTRACT_RANK : LEVEL_RANK[level];
    reach.push({ limit, level, contract });
    if (limit.kind === 'order') {
      ORDER_FIELDS.forEach((field) => {
        const s = settingOf(limit, field);
        if (s.mode !== 'inherit') claims.push({ key: settingKey(limit, field), field, s, limit, level, rank, contract });
      });
      return;
    }
    productRules(limit).forEach((r) => {
      const targets = ruleTargets(r, db);
      PRODUCT_FIELDS.forEach((field) => {
        const s = ruleSetting(r, field);
        if (s.mode !== 'inherit') targets.forEach((target) => claims.push({ key: `p:${target}:${field}`, target, field, s, limit, level, rank, contract }));
      });
    });
  });
  return { reach, claims };
}

// Most specific first (a contract's, then a location's, …), then strictest.
function byPrecedence(a, b) {
  if (a.rank !== b.rank) return b.rank - a.rank;
  const x = strictValue(a.field, a.s);
  const y = strictValue(b.field, b.s);
  if (x === y) return 0;
  return higherIsStricter(a.field) ? (y > x ? 1 : -1) : (x > y ? 1 : -1);
}
// Can a product be ordered at all under these quantities: some amount at or over the
// minimum, at or under the maximum, in whole packs?
function contradicts(e) {
  const min = Math.max(1, num(e.min) ?? 0);
  const max = num(e.max) ?? Infinity;
  const pack = num(e.increment) || 1;
  return Math.ceil(min / pack) * pack > max;
}

// A buyer's effective rules on a day:
//   settings   { minValue, maxValue, threshold, minQty, maxQty } — each the
//              winning setting: { mode, value, limit, level, rank, contract }
//              (missing: nothing sets it)
//   products   { '*': { min, max, increment }, [sku]: { … } } — per field, the same
//              shape; a product named by a rule weighs the all-products rules too
//   overridden [{ key, field, limit, s, by, byS, sameLevel }] — settings another
//              limit won (`sameLevel`: only strictness decided it)
//   dropped    [{ limit, target | key, by, contract, why }] — limits left out here:
//              on a product a contract limit sets ('contract'), or because they
//              contradict another limit — the newer one at the same level wins on a
//              product ('newer'), else the higher-ranked one ('contract',
//              'specific'); two order settings at the same rank: neither ('same').
//   reach      [{ limit, level, contract }] — every limit in force there
// An order setting and a product's limit that contradict are settled per order, in
// the cart (cartProblemsIn), as only then is the product's price known.
function buildRecord(db, levelOf, at, buyerKey) {
  const { reach, claims } = claimsFor(db, levelOf, at, buyerKey);
  const byKey = new Map();
  claims.forEach((c) => {
    if (!byKey.has(c.key)) byKey.set(c.key, []);
    byKey.get(c.key).push(c);
  });
  // Ties go to the limit updated most recently (then the one added later).
  const pos = new Map((db.limits || []).map((l, i) => [l.id, i]));
  const newerFirst = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || (pos.get(b.id) ?? 0) - (pos.get(a.id) ?? 0);
  const precedence = (a, b) => byPrecedence(a, b) || newerFirst(a.limit, b.limit);
  const winnerOf = (list) => [...list].sort(precedence)[0];
  const entryOf = (w) => ({ key: w.key, mode: w.s.mode, value: num(w.s), limit: w.limit, level: w.level, rank: w.rank, contract: w.contract, target: w.target });
  const overridden = [];
  const dropped = [];
  const report = (key, list, win, keep = () => true) =>
    list.forEach((c) => {
      if (c !== win && keep(win, c)) overridden.push({ key, field: c.field, limit: c.limit, s: c.s, by: win.limit, byS: win.s, sameLevel: c.rank === win.rank });
    });
  const settings = {};
  [...byKey.keys()].filter((key) => !key.startsWith('p:')).forEach((key) => {
    const list = byKey.get(key);
    const win = winnerOf(list);
    report(key, list, win);
    settings[key] = entryOf(win);
  });
  const products = {};
  const productEntryFor = (target) => {
    let cands = PRODUCT_FIELDS.flatMap((f) => [...(byKey.get(`p:${target}:${f}`) || []), ...(target === '*' ? [] : byKey.get(`p:*:${f}`) || [])]);
    const merge = (list) => {
      const e = {};
      PRODUCT_FIELDS.forEach((f) => {
        const w = winnerOf(list.filter((c) => c.field === f));
        if (w) e[f] = entryOf(w);
      });
      return e;
    };
    const limitsIn = (list) => [...new Set(list.map((c) => c.limit))];
    const drop = (list, by, why) => {
      const winner = by && cands.find((c) => c.limit === by);
      limitsIn(list).forEach((limit) => dropped.push({ limit, target, by, contract: winner?.contract || null, why }));
      cands = cands.filter((c) => !list.includes(c));
    };
    // A product a contract limit sets here follows the contract's limits only.
    if (cands.some((c) => c.contract) && cands.some((c) => !c.contract)) {
      drop(cands.filter((c) => !c.contract), winnerOf(cands.filter((c) => c.contract)).limit, 'contract');
    }
    // Limits that leave it impossible to order: at the same level the newer one
    // applies; across levels the more specific one.
    if (contradicts(merge(cands))) {
      const top = Math.max(...cands.map((c) => c.rank));
      const atTop = limitsIn(cands.filter((c) => c.rank === top)).sort(newerFirst);
      if (atTop.length > 1) drop(cands.filter((c) => c.rank === top && c.limit !== atTop[0]), atTop[0], 'newer');
      if (contradicts(merge(cands))) drop(cands.filter((c) => c.rank < top), atTop[0], top === CONTRACT_RANK ? 'contract' : 'specific');
    }
    // Two all-products rules are reported once, under '*', not again for each product.
    PRODUCT_FIELDS.forEach((f) => {
      const list = cands.filter((c) => c.field === f);
      if (list.length) report(`p:${target}:${f}`, list, winnerOf(list), (w, c) => target === '*' || w.target !== '*' || c.target !== '*');
    });
    return merge(cands);
  };
  if (claims.some((c) => c.target === '*')) products['*'] = productEntryFor('*');
  new Set(claims.filter((c) => c.target && c.target !== '*').map((c) => c.target)).forEach((sku) => {
    products[sku] = productEntryFor(sku);
  });
  // A minimum above a maximum from another limit: the higher-ranked one applies (a
  // contract's, else the more specific); at the same rank neither does.
  [['minValue', ['maxValue', 'maxValue@week', 'maxValue@month']], ['minQty', ['maxQty']]].forEach(([minKey, maxKeys]) =>
    maxKeys.forEach((maxKey) => {
      const lo = settings[minKey];
      const hi = settings[maxKey];
      if (!lo || !hi || lo.mode !== 'set' || hi.mode !== 'set' || lo.value <= hi.value) return;
      if (lo.rank === hi.rank) {
        delete settings[minKey];
        delete settings[maxKey];
        dropped.push({ limit: lo.limit, key: minKey, by: null, contract: null, why: 'same' });
        dropped.push({ limit: hi.limit, key: maxKey, by: null, contract: null, why: 'same' });
        return;
      }
      const [win, lose, loseKey] = lo.rank > hi.rank ? [lo, hi, maxKey] : [hi, lo, minKey];
      delete settings[loseKey];
      dropped.push({ limit: lose.limit, key: loseKey, by: win.limit, contract: win.contract, why: win.contract ? 'contract' : 'specific' });
    }),
  );
  return { reach, settings, products, overridden, dropped };
}

// Records are kept per version of the limits (a new list on every change).
const records = new WeakMap();
function resolveBuyer(db, buyerKey, levelOf, at = TODAY) {
  const limits = db.limits || [];
  if (!records.has(limits)) records.set(limits, new Map());
  const kept = records.get(limits);
  const k = `${buyerKey}|${at}`;
  if (!kept.has(k)) kept.set(k, buildRecord(db, levelOf, at, buyerKey));
  return kept.get(k);
}
export const effectiveRules = (db, companyId, locationId, at) => resolveBuyer(db, limitKey(companyId, locationId), atLocation(companyId, locationId), at);
export const effectiveRulesForCustomer = (db, customer, at) => resolveBuyer(db, customerKey(customer), (l) => customerLimitLevel(l, customer), at);

// A product's quantities in a record: its own entry, else the rule on all products.
const productEntry = (rec, sku) => rec.products[sku] || rec.products['*'] || null;
// As numbers, { min, max, increment } (increment 1: no pack), or null when nothing limits it.
function quantities(e) {
  if (!e) return null;
  const q = { min: num(e.min), max: num(e.max), increment: num(e.increment) || 1 };
  return q.min == null && q.max == null && q.increment === 1 ? null : q;
}

// The quantity rule in effect for one product at a location (for D2C: for a
// customer outside a company, null when not logged in), or null.
export const productRuleFor = (db, companyId, locationId, sku) => quantities(productEntry(effectiveRules(db, companyId, locationId), sku));
export const productRuleForCustomer = (db, customer, sku) => quantities(productEntry(effectiveRulesForCustomer(db, customer), sku));

// The maximum sent for review in effect at a location for a period ('order',
// 'week' or 'month'), or null: { limit, value }.
export function reviewMaximumFor(db, companyId, locationId, period = 'order') {
  const e = effectiveRules(db, companyId, locationId).settings[period === 'order' ? 'threshold' : `threshold@${period}`];
  return e && e.mode === 'set' ? { limit: e.limit, value: e.value } : null;
}

// Every limit in force at a location, most specific first, with what it sets. A
// setting another limit wins there names it (`replacedBy`, and `replacedByContract`
// when a contract's limit wins — on a product the contract sets, too).
// Contradictions aren't shown. A product rule that still wins some of its fields
// lists the ones it lost (`partly`: the field, the limit that won it and, when it
// lost only some products, which — `label`).
const FIELD_LABEL = { min: 'Minimum', max: 'Maximum', increment: 'Pack size' };
export function locationLimits(db, companyId, locationId) {
  const rec = effectiveRules(db, companyId, locationId);
  const titleOf = (sku) => (db.products || []).find((p) => p.sku === sku)?.title || sku;
  return rec.reach
    .map(({ limit, level }) => ({
      limit,
      level,
      rules: limitRules(limit, db).map((entry) => {
        if (entry.key) {
          const e = rec.settings[entry.key];
          return { ...entry, replacedBy: e && e.limit.id !== limit.id ? e.limit : null, replacedByContract: e && e.limit.id !== limit.id ? e.contract : null };
        }
        // Who won a field on a product: the contract that sets the product here, or
        // another limit's field winning it.
        const winnerAt = (t, f) => {
          const d = rec.dropped.find((x) => x.target === t && x.limit.id === limit.id && x.why === 'contract');
          if (d) return { limit: d.by, contract: d.contract };
          const w = (t === '*' ? rec.products['*'] : productEntry(rec, t))?.[f];
          return w && w.limit.id !== limit.id ? { limit: w.limit, contract: w.contract } : null;
        };
        const fields = PRODUCT_FIELDS.filter((f) => ruleSetting(entry.rule, f).mode !== 'inherit');
        const lost = fields
          .map((f) => {
            const losses = entry.targets.map((t) => ({ t, w: winnerAt(t, f) })).filter(({ w }) => w);
            if (!losses.length) return null;
            const all = losses.length === entry.targets.length;
            const on = losses.length > 2 ? `${losses.length} products` : losses.map(({ t }) => titleOf(t)).join(' and ');
            return { field: f, all, by: losses[0].w.limit, contract: losses[0].w.contract, label: all ? FIELD_LABEL[f] : `${FIELD_LABEL[f]} for ${on}` };
          })
          .filter(Boolean);
        if (lost.length === fields.length && lost.every((x) => x.all)) return { ...entry, replacedBy: lost[0].by, replacedByContract: lost[0].contract };
        return { ...entry, replacedBy: null, partly: lost };
      }),
    }))
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
}

// The day a week (Monday) or month starts, for a day (YYYY-MM-DD), and the day the next one starts.
const shiftDay = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function periodRange(period, day = TODAY) {
  if (period === 'week') {
    const start = shiftDay(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
    return [start, shiftDay(start, 7)];
  }
  const [y, m] = day.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  return [start, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];
}
// What a buyer has ordered in the week and the month `day` falls in: their orders
// ([{ date: 'YYYY-MM-DD', amount, status }]) except declined or cancelled ones,
// counting orders waiting for review. { week, month }.
export function spentSoFar(orders, day = TODAY) {
  const out = { week: 0, month: 0 };
  ['week', 'month'].forEach((p) => {
    const [from, to] = periodRange(p, day);
    (orders || []).forEach((o) => {
      if (o.date >= from && o.date < to && !['Declined', 'Cancelled'].includes(o.status)) out[p] += Number(o.amount) || 0;
    });
  });
  return out;
}

// What's wrong with a cart under the limits in effect for a location (for D2C, a
// customer) — what the Cart and Checkout Validation function returns as errors.
// `lines`: [{ sku, title, qty, price }], one per variant (`price`: the buyer's unit
// price, optional); `subtotal` at the buyer's prices. A 'review' problem
// blocks checkout too, but in the cart the buyer can send the order as an order
// request instead.
// `spent`: what the buyer ordered so far this week and month (spentSoFar), for
// weekly and monthly maximums. A merchant's own message is used when the limit
// sets one thing; with several, buyers see the message for the one they broke.
export const cartProblems = (db, companyId, locationId, lines, subtotal, spent = {}) => cartProblemsIn(effectiveRules(db, companyId, locationId), lines, subtotal, spent);
export const cartProblemsForCustomer = (db, customer, lines, subtotal, spent = {}) => cartProblemsIn(effectiveRulesForCustomer(db, customer), lines, subtotal, spent);
const ownMessage = (limit) =>
  limit.message && (limit.kind === 'product' || ORDER_FIELDS.filter((f) => settingOf(limit, f).mode === 'set').length === 1) ? limit.message : null;
// The least of a product one order can hold under its limit — its minimum, else its
// pack — and the setting that asks for it, or null.
function leastOf(e) {
  const q = quantities(e);
  const min = q && (q.min ?? (q.increment > 1 ? q.increment : null));
  return min ? { min, e: q.min != null ? e.min : e.increment } : null;
}
// An order setting and a product's limit that contradict — the product's least is
// over the order's maximum units, or costs more than its maximum value (at the line's
// `price`) — are settled for an order with that product: the higher-ranked one
// applies (a contract's, else the more specific); at the same rank neither does.
// What's left out: { keys: order settings, skus: products whose limit isn't checked }.
function orderProductClashes(rec, lines) {
  const keys = new Set();
  const skus = new Set();
  lines.forEach((line) => {
    const least = leastOf(productEntry(rec, line.sku));
    if (!least) return;
    const clash = (key, over) => {
      const s = rec.settings[key];
      if (!s || s.mode !== 'set' || !over(s.value)) return;
      if (least.e.rank >= s.rank) keys.add(key);
      if (s.rank >= least.e.rank) skus.add(line.sku);
    };
    clash('maxQty', (v) => least.min > v);
    if (line.price != null) ['maxValue', 'maxValue@week', 'maxValue@month'].forEach((k) => clash(k, (v) => least.min * line.price > v));
  });
  return { keys, skus };
}
function cartProblemsIn(rec, lines, subtotal, spent = {}) {
  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const problems = [];
  const left = orderProductClashes(rec, lines);
  const setting = (key) => (!left.keys.has(key) && rec.settings[key]?.mode === 'set' ? rec.settings[key] : null);
  const add = (type, e, text, value, period = 'order') => problems.push({ type, limit: e.limit, message: ownMessage(e.limit) || text, value, period });

  const minValue = setting('minValue');
  if (minValue && subtotal < minValue.value) add('minValue', minValue, `Your order must be at least ${money(minValue.value)} to check out. Add ${money(minValue.value - subtotal)} more.`);
  const maxValue = setting('maxValue');
  if (maxValue && subtotal > maxValue.value) add('maxValue', maxValue, `Orders can’t be more than ${money(maxValue.value)}. Remove ${money(subtotal - maxValue.value)} to check out.`);
  // Weekly and monthly maximums: this order on top of what was ordered in the period.
  const sofar = (p) => Number(spent[p]) || 0;
  ['week', 'month'].forEach((p) => {
    const cap = setting(`maxValue@${p}`);
    const total = sofar(p) + subtotal;
    if (cap && total > cap.value) add('maxValue', cap, `Your orders this ${p} come to ${money(sofar(p))}. This one would take you to ${money(total)}, over your ${money(cap.value)} ${p}ly limit. Remove ${money(total - cap.value)} to check out.`, cap.value, p);
  });
  const minQty = setting('minQty');
  if (minQty && totalQty < minQty.value) add('minQty', minQty, `Your order needs at least ${units(minQty.value)}. Add ${units(minQty.value - totalQty)} more.`);
  const maxQty = setting('maxQty');
  if (maxQty && totalQty > maxQty.value) add('maxQty', maxQty, `Orders can’t have more than ${units(maxQty.value)}.`);
  lines.forEach((line) => {
    if (left.skus.has(line.sku)) return;
    const e = productEntry(rec, line.sku);
    const q = quantities(e);
    if (!q) return;
    // Errors show for the whole cart, not on a line — so the merchant's own message
    // is prefixed with the line it's about. Each field names the limit it came from.
    const addLine = (fieldE, text) => problems.push({ type: 'product', limit: fieldE.limit, message: fieldE.limit.message ? `${line.title}: ${fieldE.limit.message}` : text });
    if (q.min != null && line.qty < q.min) addLine(e.min, `${line.title}: order at least ${q.min}.`);
    else if (q.max != null && line.qty > q.max) addLine(e.max, `${line.title}: order at most ${q.max}.`);
    else if (q.increment > 1 && line.qty % q.increment) addLine(e.increment, `${line.title} is sold in packs of ${q.increment}.`);
  });
  const threshold = setting('threshold');
  if (threshold && subtotal > threshold.value) add('review', threshold, `Your current limit is ${money(threshold.value)}. Reduce your order or send an order request.`, threshold.value);
  ['week', 'month'].forEach((p) => {
    const t = setting(`threshold@${p}`);
    const total = sofar(p) + subtotal;
    if (t && total > t.value && !problems.some((x) => x.type === 'review')) {
      add('review', t, `Your orders this ${p} come to ${money(sofar(p))}. With this one you’d be at ${money(total)}, over the ${money(t.value)} a ${p} you can order without review. Reduce your order or send an order request.`, t.value, p);
    }
  });
  return problems;
}

// ── A contract's limits against each other ──────────────────────────────────
// The limits picked for a contract that contradict each other, as lines for its
// editor (a warning: it still saves). In one contract they rank the same, so they're
// settled as the resolver and the cart settle them: an order minimum over another's
// maximum — neither applies; a product they leave impossible to order — only the
// newest applies to it; a product's least over an order's maximum units — neither, in
// an order with it. Only what needs no prices (a product's least against a maximum
// order value is settled in the cart). Limits that are off don't contradict; the rest
// apply on the contract's dates, so they're all in force together.
export function contractLimitConflicts(db, limits) {
  const live = limits.filter((l) => l.status !== 'Inactive').map((l) => ({ l }));
  const name = (l) => `“${l.name}”`;
  const out = [];

  const orders = live.filter((x) => x.l.kind === 'order');
  orders.forEach((a) =>
    orders.forEach((b) => {
      if (a === b) return;
      const minValue = num(settingOf(a.l, 'minValue'));
      const maxValue = b.l.maxAction === 'review' ? null : num(settingOf(b.l, 'maxValue'));
      if (minValue != null && maxValue != null && minValue > maxValue) {
        const period = periodOf(b.l, 'maxValue');
        out.push(`${name(a.l)} needs at least ${money(minValue)} per order, but ${name(b.l)} allows at most ${money(maxValue)} ${period === 'order' ? 'per order' : `a ${period}`}. Neither the minimum nor the maximum applies.`);
      }
      const minQty = num(settingOf(a.l, 'minQty'));
      const maxQty = num(settingOf(b.l, 'maxQty'));
      if (minQty != null && maxQty != null && minQty > maxQty) {
        out.push(`${name(a.l)} needs at least ${units(minQty)} per order, but ${name(b.l)} allows at most ${units(maxQty)}. Neither the minimum nor the maximum applies.`);
      }
    }),
  );

  // A product limit's quantities per product ('*': every product), the strictest per
  // field; a product's own take in the limit's rule on every product.
  const stricter = (f, s, than) => (higherIsStricter(f) ? strictValue(f, s) > strictValue(f, than) : strictValue(f, s) < strictValue(f, than));
  const combine = (...entries) => {
    const e = {};
    entries.filter(Boolean).forEach((x) =>
      PRODUCT_FIELDS.forEach((f) => {
        if (x[f] && (!e[f] || stricter(f, x[f], e[f]))) e[f] = x[f];
      }),
    );
    return e;
  };
  const entriesOf = (l) => {
    const m = new Map();
    productRules(l).forEach((r) => {
      const e = Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, ruleSetting(r, f)]).filter(([, s]) => s.mode !== 'inherit'));
      ruleTargets(r, db).forEach((t) => m.set(t, combine(m.get(t), e)));
    });
    return m;
  };
  const on = (m, t) => (t === '*' ? m.get('*') : combine(m.get(t), m.get('*')));
  const joined = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
  const titles = new Map((db.products || []).map((p) => [p.sku, p.title]));
  const listed = (skus) => {
    const names = skus.slice(0, 3).map((s) => titles.get(s) || s);
    return skus.length > 3 ? `${names.join(', ')} and ${skus.length - 3} more` : joined(names);
  };
  const parts = (e) => PRODUCT_FIELDS.filter((f) => e[f]).map((f) => (e[f].mode === 'set' ? PRODUCT_TEXT[f][0](e[f].value) : PRODUCT_TEXT[f][1])).join(', ');
  // Newest first: updated most recently, then added later (as in buildRecord).
  const pos = new Map((db.limits || []).map((l, i) => [l.id, i]));
  const newerFirst = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || (pos.get(b.id) ?? 0) - (pos.get(a.id) ?? 0);

  // Products the limits on them leave impossible to order: per product, the limits
  // on it.
  const products = live.filter((x) => x.l.kind === 'product').map((x) => ({ ...x, m: entriesOf(x.l) }));
  const onAll = products.filter((p) => p.m.has('*'));
  const bySku = new Map();
  products.forEach((p) =>
    p.m.forEach((_, t) => {
      if (t === '*') return;
      if (!bySku.has(t)) bySku.set(t, []);
      bySku.get(t).push(p);
    }),
  );
  const impossible = new Map();
  const check = (t, members) => {
    if (members.length < 2) return;
    const inForce = [...members].sort((a, b) => newerFirst(b.l, a.l));
    const entries = inForce.map((p) => on(p.m, t));
    if (entries.some(contradicts) || !contradicts(combine(...entries))) return;
    const key = inForce.map((p, i) => `${p.l.id}:${parts(entries[i])}`).join('|');
    if (!impossible.has(key)) impossible.set(key, { inForce, entries, skus: [] });
    impossible.get(key).skus.push(t);
  };
  check('*', onAll);
  bySku.forEach((own, t) => check(t, [...own, ...onAll.filter((p) => !own.includes(p))]));
  impossible.forEach(({ inForce, entries, skus }) => {
    const what = skus.includes('*') ? 'All products' : listed(skus);
    const which = inForce.length === 2 ? 'the newer one' : 'the newest';
    out.push(`${what}: ${joined(inForce.map((p, i) => `${name(p.l)} (${parts(entries[i])})`))} leave no quantity that can be ordered. Only ${which}, ${name(inForce.at(-1).l)}, applies.`);
  });

  // A product's least over an order's maximum units.
  const capped = orders.filter((o) => num(settingOf(o.l, 'maxQty')) != null);
  if (!capped.length) return out;
  products.forEach((p) => {
    // Its least per product, most first.
    const all = p.m.has('*') ? leastOf(p.m.get('*'))?.min ?? 0 : 0;
    const skus = [...p.m.keys()].filter((t) => t !== '*').map((t) => [leastOf(on(p.m, t))?.min ?? 0, t]).sort((a, b) => b[0] - a[0]);
    capped.forEach((o) => {
      const maxQty = num(settingOf(o.l, 'maxQty'));
      const but = `but ${name(o.l)} allows at most ${units(maxQty)} per order`;
      if (all > maxQty) return out.push(`${name(p.l)} needs at least ${all} of each product in an order, ${but}. Neither applies.`);
      const over = new Map();
      for (const [n, t] of skus) {
        if (n <= maxQty) break;
        if (!over.has(n)) over.set(n, []);
        over.get(n).push(t);
      }
      over.forEach((list, n) => out.push(`${name(p.l)} needs at least ${n} of ${listed(list)} in an order, ${but}. In an order with ${list.length === 1 ? 'it' : 'them'}, neither applies.`));
    });
  });
  return out;
}

// ── Buyers ──────────────────────────────────────────────────────────────────
// The buyers limits apply to, each with a `key` for their record, how a
// limit reaches them (`levelOf`) and a name for where. B2B: every company location.
// D2C: non-logged-in customers, logged-in customers without tags, each customer
// tag (so a tag no customer has yet still counts) and the customers who differ
// from those — picked by name, with several tags, or with their own pricing.
// Customers in a company are B2B buyers.
function buyers(db) {
  const list = [];
  // A location deleted in Shopify can't order, so it isn't checked.
  (db.companies || []).forEach((c) => (c.locations || []).filter((loc) => loc.status !== 'Deleted').forEach((loc) => list.push({
    key: limitKey(c.id, loc.id),
    audience: 'b2b',
    where: `${loc.name} · ${c.name}`,
    levelOf: atLocation(c.id, loc.id),
  })));

  const d2c = (db.limits || []).filter(isD2CLimit);
  const picked = new Set(d2c.filter((l) => l.customerTarget === 'specific').flatMap((l) => l.customerTargetIds || []));
  const tags = new Set([...(db.tagPricing || []).map((t) => t.id), ...d2c.filter((l) => l.customerTarget === 'tags').flatMap((l) => l.customerTargetIds || [])]);
  const tagName = (id) => (db.tagPricing || []).find((t) => t.id === id)?.name || id;
  const customer = (cu, where) => list.push({
    key: customerKey(cu),
    audience: 'd2c',
    where,
    levelOf: (l) => customerLimitLevel(l, cu),
  });
  customer(null, 'Non logged-in customers');
  customer({ id: null, tags: [] }, 'Logged-in customers');
  tags.forEach((t) => customer({ id: null, tags: [t] }, `Customers tagged ${tagName(t)}`));
  (db.customers || [])
    .filter((cu) => !companyForCustomerEmail(db, cu.email) && (picked.has(cu.id) || (cu.tags || []).length > 1 || cu.policyId))
    .forEach((cu) => customer(cu, cu.name));
  return list;
}

// ── Inherited values, for the editor ─────────────────────────────────────────
// What the buyers a draft reaches get for one setting when the draft leaves it
// empty: the value from the other limits at the draft's level or wider (more
// specific ones override the draft anyway). The winning setting ({ mode, value,
// limit }) when it's the same for every buyer, 'varies' when they differ, null
// when nothing sets it. `others` = the db without the draft's saved version, kept
// the same while editing so the buyers' records are reused.
export function inheritedSetting(others, draft, field, rule = null) {
  const target = normalizeLimit(draft);
  const people = buyers({ ...others, limits: [...(others.limits || []), target] });
  const found = new Map();
  people.forEach((b) => {
    const level = b.levelOf(target);
    if (!level) return;
    const cap = LEVEL_RANK[level];
    const capped = (l) => {
      const lv = b.levelOf(l);
      return lv && LEVEL_RANK[lv] <= cap ? lv : null;
    };
    const rec = resolveBuyer(others, `${b.key}|up to ${cap}`, capped);
    const values = rule
      ? ruleTargets(rule, others).map((t) => (t === '*' ? rec.products['*'] : productEntry(rec, t))?.[field] || null)
      : [rec.settings[settingKey(target, field)] || null];
    values.forEach((e) => found.set(e ? `${e.mode}|${e.value}|${e.limit.id}` : '', e));
  });
  if (!found.size || (found.size === 1 && found.has(''))) return null;
  return found.size === 1 ? [...found.values()][0] : 'varies';
}

// ── Validation ──────────────────────────────────────────────────────────────
// Problems that keep a draft from being saved, keyed by field.
export function limitErrors(d) {
  const e = {};
  const n = (k) => toNumber(d[k]);
  // A minimum can be 0 (none: it lifts a wider limit's minimum where this one is
  // more specific); a maximum of 0 would stop every order, so it must be above 0.
  const isMin = (k) => k.startsWith('min');
  const allowed = (k, v) => (isMin(k) ? v >= 0 : v > 0);
  const bad = (k) => d[k] !== '' && d[k] != null && !allowed(k, Number(d[k]));
  if (!(d.name || '').trim()) e.name = 'Name is required';
  if (d.startDate && d.endDate && d.endDate < d.startDate) e.endDate = 'Must be after the start date';
  else if (d.endDate && d.endDate < TODAY) e.endDate = 'This date has passed';
  if (d.kind === 'order') {
    ORDER_FIELDS.forEach((k) => { if (bad(k)) e[k] = isMin(k) ? 'Enter 0 or more' : 'Enter a number above 0'; });
    ['minQty', 'maxQty'].forEach((k) => {
      if (n(k) != null && !(Number.isInteger(n(k)) && allowed(k, n(k)))) e[k] = isMin(k) ? 'Enter a whole number, 0 or more' : 'Enter a whole number above 0';
    });
    if (!ORDER_FIELDS.some((k) => n(k) != null)) e.order = 'Set at least one limit';
    if (n('minValue') != null && n('maxValue') != null && n('minValue') > n('maxValue')) e.maxValue = 'Must be more than the minimum';
    if (n('minQty') != null && n('maxQty') != null && n('minQty') > n('maxQty')) e.maxQty = 'Must be more than the minimum';
  }
  // Product limit: each rule on its own (keys `rule-<i>-<field>`), and no product
  // in two rules — a rule on all products can't share the limit with others. A
  // minimum of 0 is none; a pack of 1 is no pack (it lifts a wider one).
  if (d.kind === 'product') {
    const rules = productRules(d);
    const owner = new Map(); // sku → the earlier rule that has it
    rules.forEach((r, i) => {
      const key = (f) => `rule-${i}-${f}`;
      const rn = (f) => toNumber(r[f]);
      PRODUCT_FIELDS.forEach((f) => {
        const v = Number(r[f]);
        if (r[f] === '' || r[f] == null) return;
        if (!Number.isInteger(v)) e[key(f)] = f === 'min' ? 'Enter a whole number, 0 or more' : 'Enter a whole number above 0';
        else if (f === 'min' ? v < 0 : v < 1) e[key(f)] = f === 'min' ? 'Enter a whole number, 0 or more' : 'Enter a whole number above 0';
      });
      if (PRODUCT_FIELDS.every((f) => rn(f) == null)) e[`rule-${i}`] = 'Set at least one quantity';
      const inc = rn('increment');
      if (inc > 1) {
        if (rn('min') && rn('min') % inc) e[key('min')] = `Must be a multiple of ${inc}`;
        if (rn('max') != null && rn('max') % inc) e[key('max')] = `Must be a multiple of ${inc}`;
      }
      if (rn('min') && rn('max') != null && rn('min') > rn('max')) e[key('max')] = 'Must be more than the minimum';
      if (r.scopeType === 'products' && !(r.selectedProducts || []).length) e[key('products')] = 'Pick at least one product';
      if (r.scopeType === 'collection' && !scopeCollections(r).length) e[key('products')] = 'Pick at least one collection';
      const skus = r.scopeType === 'collection' ? scopeCollections(r).flatMap((c) => COLLECTIONS[c] || []) : r.scopeType === 'products' ? r.selectedProducts || [] : [];
      const taken = skus.map((sku) => owner.get(sku)).find((j) => j != null);
      if (taken != null && !e[key('products')]) e[key('products')] = `Some of these products are already in rule ${taken + 1}`;
      skus.forEach((sku) => { if (!owner.has(sku)) owner.set(sku, i); });
    });
    if (rules.length > 1 && rules.some((r) => r.scopeType === 'all')) e.rules = 'A rule on all products can’t share a limit with other rules';
  }
  if (isD2CLimit(d)) {
    if (PICKED_TARGETS.includes(d.customerTarget) && !(d.customerTargetIds || []).length) {
      e.targets = d.customerTarget === 'tags' ? 'Pick at least one customer tag' : 'Pick at least one customer';
    }
  } else if (!d.storeWide && !(d.companyIds || []).length && !(d.locationKeys || []).length) {
    e.targets = 'Pick at least one company or location';
  }
  return e;
}
