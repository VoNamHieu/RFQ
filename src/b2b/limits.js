// Order limits: rules on what a B2B buyer or D2C wholesale customer can check out. Two kinds:
//   order   — a minimum / maximum order value and / or total quantity. The value
//             is the cart subtotal (cart.cost.subtotalAmount: B2B prices, before
//             tax, shipping and order-level discounts), set in the store currency
//             and converted with presentmentCurrencyRate for buyers paying in another.
//             Over the maximum value (`maxAction`), checkout is blocked, or — B2B
//             only — the buyer can send the order for review instead.
//   product — rules, each a minimum, maximum and increment (case packs) on a set
//             of products, checked per variant like Shopify's B2B quantity rules.
//             Over a rule's maximum (`maxAction`, for all its rules), checkout is
//             blocked, or — B2B only — the buyer can send the order for review.
//             A rule picks all products, collections, products, or product tags,
//             vendors or product types (matched against the catalog when checked).
//             Rules are in order: a product in more than one rule of a limit
//             takes the first one's quantities, like pricings by priority. Kept in the
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
// number: { mode: 'inherit' } (left empty), { mode: 'set', value } or { mode: 'none' }
// (0 for a minimum, 1 for a pack). Limits never combine, so empty and none both
// mean no limit on that setting. Order limits keep theirs in `settings`; product
// rules in `min`, `max` and `increment`. The editor works on a flat draft of
// strings (toDraft / normalizeLimit): empty = inherit, 0 for a minimum = none, 1
// for a pack = none.
//
// One resolver, one record. resolveBuyer turns the limits that reach a buyer on a
// day into that buyer's effective rules: each setting with the value in force and
// where it comes from (limit, level), and each product's minimum, maximum and
// pack. One limit applies, whole: the most specific (location > company >
// store-wide; for D2C a specific customer > a customer tag > all, logged-in or
// non-logged-in customers), then the newest (the one that started applying last:
// created or turned back on, or its start date when that's later — see newer).
// For order limits that's one limit per buyer; for product limits one
// per product — a limit replaces another only for the products both have. Settings
// are never combined: what the winner leaves empty isn't taken from the limit it
// replaces, so a location's maximum doesn't keep the company's pack. A D2C customer in
// several tag segments follows, for each kind of limit, the segment of the newest
// limit that reaches them through a tag: the limits on their other tags step aside
// (segmentLevel), so two segments never combine into an order that can't check out.
// The cart, product page, location card and held orders all read that record.
// Records are cached per version of the limits; in production the app
// keeps them (a metafield on each company location) and rebuilds them on the
// events that change them — a limit saved, turned on or off or deleted, a contract
// starting or ending, a location added or removed, a limit's date, a product joining
// or leaving a collection a rule uses (it can move the product to another rule) —
// so the validation function only reads numbers.
//
// A maximum order value can count one order, or every order in a week (Monday to
// Sunday) or a month (`period`), so splitting an order doesn't get around it. A
// limit counts one period, and one order limit applies to a buyer, so a buyer has
// one maximum order value. The cart adds up what the buyer ordered in the period (spentSoFar); in production
// the app keeps that on the buyer's record, updated as orders come in, for the
// validation function to read. Minimums and quantities always count one order.
//
// Overlaps. limitOverlaps compares a limit with each other limit on its own — the
// two definitions, no buyer by buyer and no prices: where both apply, which one
// replaces the other there (two order limits; two product limits, for the products
// both have), plus an order limit's maximum quantity below a product limit's
// minimum (the two kinds both apply). They're notes, never a block: the
// merchant can adjust one of the two. Shown when saving a limit, turning one on
// and activating a contract.
//
// A limit can have dates: it applies from its start date through its end date
// (both optional, YYYY-MM-DD). Turned on with a start date still to come it is
// Upcoming; after its end date, Expired (limitState).
import { COLLECTIONS } from './data/constants.js';
import { money } from './format.js';
import { scopeCollections, TODAY } from './pricing.js';

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

// The day a limit started applying: the day it was turned on (or created), or its
// start date when that's later. A limit turned back on counts from that day.
const startedOn = (l) => {
  const on = l.turnedOnAt || l.createdAt || TODAY;
  return l.startDate && l.startDate > on ? l.startDate : on;
};
// Whether limit a (at `pa` in the list) is newer than b (at `pb`): it started
// applying later; on the same day, it's further down the list (limits are added,
// and turned back on, at the end).
const newer = (a, pa, b, pb) => {
  const [sa, sb] = [startedOn(a), startedOn(b)];
  return sa === sb ? pa > pb : sa > sb;
};
// Turning a limit on (in the list, or saving it on in the editor) makes it the
// newest: it moves to the end of the list, turned on today.
export const turnLimitOn = (limits, limit) => [...limits.filter((l) => l.id !== limit.id), { ...limit, status: 'Active', turnedOnAt: TODAY }];

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

// Rule scopes picked by a product attribute: the field the picks are kept in, and
// whether a product matches them.
export const ATTRIBUTE_SCOPES = {
  tags: { key: 'selectedTags', matches: (p, vals) => (p.tags || []).some((t) => vals.includes(t)) },
  vendors: { key: 'selectedVendors', matches: (p, vals) => vals.includes(p.vendor) },
  productTypes: { key: 'selectedProductTypes', matches: (p, vals) => vals.includes(p.productType) },
};
const attributePicks = (r) => r[ATTRIBUTE_SCOPES[r.scopeType].key] || [];

// The products one rule of a product limit covers.
export function ruleSkus(r, db) {
  if (r.scopeType === 'all') return (db.products || []).map((p) => p.sku);
  if (r.scopeType === 'collection') return [...new Set(scopeCollections(r).flatMap((c) => COLLECTIONS[c] || []))];
  if (ATTRIBUTE_SCOPES[r.scopeType]) {
    const vals = attributePicks(r);
    return (db.products || []).filter((p) => ATTRIBUTE_SCOPES[r.scopeType].matches(p, vals)).map((p) => p.sku);
  }
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
  if (ATTRIBUTE_SCOPES[r.scopeType]) {
    const vals = attributePicks(r);
    const one = { tags: (v) => `products tagged ${v}`, vendors: (v) => `${v} products`, productTypes: (v) => `${v} products` }[r.scopeType];
    const many = { tags: 'product tags', vendors: 'vendors', productTypes: 'product types' }[r.scopeType];
    return vals.length === 1 ? one(vals[0]) : `${vals.length} ${many}`;
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
// A product rule's quantities, e.g. "min 12, multiples of 12" (`review`: its limit
// sends an order over the maximum for review).
const ruleParts = (r, review = false) =>
  PRODUCT_FIELDS.map((f) => [f, ruleSetting(r, f)])
    .filter(([, s]) => s.mode !== 'inherit')
    .map(([f, s]) => (s.mode === 'set' ? `${PRODUCT_TEXT[f][0](s.value)}${review && f === 'max' ? ' without review' : ''}` : PRODUCT_TEXT[f][1]))
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
  const overlaps = ruleOverlaps(l, db);
  return productRules(l).flatMap((r, i) => {
    const parts = ruleParts(r, l.maxAction === 'review');
    if (!parts) return [];
    const left = overlaps[i];
    const from = [...new Set(left.map((x) => x.rule + 1))];
    const except = left.length ? `, except ${left.length} product${left.length === 1 ? '' : 's'} in ${from.length === 1 ? `rule ${from[0]}` : 'earlier rules'}` : '';
    const text = `${parts} on ${productScopeLabel(r)}${except}`;
    const targets = ruleTargets(r, db).filter((t) => !left.some((x) => x.sku === t));
    return [{ rule: r, targets, text: text[0].toUpperCase() + text.slice(1) }];
  });
}

// The products each rule of a product limit leaves to an earlier rule (rules are in
// order: a product in more than one takes the first one's quantities). Per rule,
// [{ sku, rule }] with the index of the rule that has it.
export function ruleOverlaps(l, db) {
  const owner = new Map(); // sku → the first rule that has it
  let allAt = null; // the rule on all products, once one comes
  return productRules(l).map((r, i) => {
    if (allAt != null) return r.scopeType === 'all' ? [] : ruleSkus(r, db).map((sku) => ({ sku, rule: allAt }));
    if (r.scopeType === 'all') {
      allAt = i;
      return [...owner].map(([sku, rule]) => ({ sku, rule }));
    }
    const left = [];
    ruleSkus(r, db).forEach((t) => {
      if (owner.has(t)) left.push({ sku: t, rule: owner.get(t) });
      else owner.set(t, i);
    });
    return left;
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
    const parts = [min && `at least ${min}`, max && `at most ${max}${l.maxAction === 'review' ? ' without review' : ''}`].filter(Boolean);
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

// ── The resolver ─────────────────────────────────────────────────────────────
// The limits that reach a buyer on a day, with how specific each is (rank) and
// where it is in the list (`pos`, for newer).
function reachFor(db, levelOf, at) {
  const reach = [];
  (db.limits || []).forEach((limit, pos) => {
    if (limitState(limit, at) !== 'Active') return;
    const level = levelOf(limit);
    if (level) reach.push({ limit, level, rank: LEVEL_RANK[level], pos });
  });
  return reach;
}

// The one that applies: the most specific, then the newest.
const winnerOf = (list) => list.reduce((w, x) => (!w || x.rank > w.rank || (x.rank === w.rank && newer(x.limit, x.pos, w.limit, w.pos)) ? x : w), null);

// A buyer's effective rules on a day:
//   order      { limit, level } — the order limit that applies, or null
//   settings   { minValue, maxValue, threshold, minQty, maxQty } — its settings:
//              { mode, value, limit, level } (missing: it leaves it empty)
//   products   { '*': entry, [sku]: entry } — for each product a rule names, and
//              for the rest ('*'), the product limit that applies and its rule for
//              the product: { limit, level, min, max, increment } (a field missing
//              when the rule leaves it empty)
//   reach      [{ limit, level }] — every limit in force there
function buildRecord(db, levelOf, at) {
  const reach = reachFor(db, levelOf, at);
  const order = winnerOf(reach.filter((x) => x.limit.kind === 'order'));
  const settings = {};
  if (order) {
    ORDER_FIELDS.forEach((field) => {
      const s = settingOf(order.limit, field);
      const key = settingKey(order.limit, field);
      if (s.mode !== 'inherit') settings[key] = { key, mode: s.mode, value: num(s), limit: order.limit, level: order.level };
    });
  }
  // Rules are in order: a product takes the first rule of a limit that has it, and
  // a rule on all products takes every product left (coverage).
  const productLimits = reach.filter((x) => x.limit.kind === 'product').map((x) => ({ ...x, cov: coverage(x.limit, db) }));
  const entryOf = (w, r) => {
    const e = { limit: w.limit, level: w.level };
    PRODUCT_FIELDS.forEach((field) => {
      const s = ruleSetting(r, field);
      if (s.mode !== 'inherit') e[field] = { mode: s.mode, value: num(s), limit: w.limit, level: w.level };
    });
    return e;
  };
  const products = {};
  const all = winnerOf(productLimits.filter((x) => x.cov.all));
  if (all) products['*'] = entryOf(all, all.cov.all);
  new Set(productLimits.flatMap((x) => [...x.cov.bySku.keys()])).forEach((sku) => {
    const w = winnerOf(productLimits.filter((x) => x.cov.bySku.has(sku) || x.cov.all));
    products[sku] = entryOf(w, w.cov.bySku.get(sku) || w.cov.all);
  });
  return { reach: reach.map(({ limit, level }) => ({ limit, level })), order: order && { limit: order.limit, level: order.level }, settings, products };
}

// Records are kept per version of the limits (a new list on every change).
const records = new WeakMap();
function resolveBuyer(db, buyerKey, levelOf, at = TODAY) {
  const limits = db.limits || [];
  if (!records.has(limits)) records.set(limits, new Map());
  const kept = records.get(limits);
  const k = `${buyerKey}|${at}`;
  if (!kept.has(k)) kept.set(k, buildRecord(db, levelOf, at));
  return kept.get(k);
}
export const effectiveRules = (db, companyId, locationId, at) => resolveBuyer(db, limitKey(companyId, locationId), atLocation(companyId, locationId), at);
export const effectiveRulesForCustomer = (db, customer, at = TODAY) => resolveBuyer(db, customerKey(customer), segmentLevel(db, customer, at), at);

// How a limit reaches a customer outside a company on a day, with tag segments
// settled: when tag limits of one kind reach them through different tags, the
// newest one's tags win — limits on their other tags don't reach them (null).
// Limits on the same tag still combine (the stricter order setting, the newer
// product quantity).
function segmentLevel(db, customer, at) {
  const matched = (l) => (customer?.tags || []).filter((t) => (l.customerTargetIds || []).includes(t));
  const viaTags = (db.limits || []).map((l, pos) => ({ l, pos })).filter(({ l }) => limitState(l, at) === 'Active' && customerLimitLevel(l, customer) === 'tag');
  const aside = new Set();
  Object.keys(LIMIT_KINDS).forEach((kind) => {
    const ofKind = viaTags.filter(({ l }) => l.kind === kind);
    if (ofKind.length < 2) return;
    const segment = matched(ofKind.reduce((x, y) => (newer(y.l, y.pos, x.l, x.pos) ? y : x)).l);
    ofKind.forEach(({ l }) => { if (!matched(l).some((t) => segment.includes(t))) aside.add(l.id); });
  });
  return (l) => (aside.has(l.id) ? null : customerLimitLevel(l, customer));
}

// A product's quantities in a record: its own entry, else the rule on all products.
const productEntry = (rec, sku) => rec.products[sku] || rec.products['*'] || null;
// As numbers, { min, max, increment, review } (increment 1: no pack; review: over the
// maximum the buyer can send the order for review), or null when nothing limits it.
function quantities(e) {
  if (!e) return null;
  const q = { min: num(e.min), max: num(e.max), increment: num(e.increment) || 1, review: num(e.max) != null && e.max.limit.maxAction === 'review' };
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

// Every limit in force at a location, most specific first, with what it sets. An
// order limit another one replaces there names it on each setting (`replacedBy`).
// A product rule names the limit that applies to its products instead: on the rule
// when one limit took them all, else per limit (`partly`: { key, by, label } — the
// products it lost to that limit).
export function locationLimits(db, companyId, locationId) {
  const rec = effectiveRules(db, companyId, locationId);
  const titleOf = (sku) => (db.products || []).find((p) => p.sku === sku)?.title || sku;
  return rec.reach
    .map(({ limit, level }) => ({
      limit,
      level,
      rules: limitRules(limit, db).map((entry) => {
        if (entry.key) return { ...entry, replacedBy: rec.order && rec.order.limit.id !== limit.id ? rec.order.limit : null };
        const losses = entry.targets
          .map((t) => ({ t, by: (t === '*' ? rec.products['*'] : productEntry(rec, t))?.limit }))
          .filter(({ by }) => by && by.id !== limit.id);
        if (!losses.length) return { ...entry, replacedBy: null };
        if (losses.length === entry.targets.length && losses.every(({ by }) => by.id === losses[0].by.id)) return { ...entry, replacedBy: losses[0].by };
        const byLimit = new Map();
        losses.forEach(({ t, by }) => byLimit.set(by.id, { by, skus: [...(byLimit.get(by.id)?.skus || []), t] }));
        const partly = [...byLimit.values()].map(({ by, skus }) => ({ key: by.id, by, label: skus.length > 2 ? `${skus.length} products` : skus.map(titleOf).join(' and ') }));
        return { ...entry, replacedBy: null, partly };
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
// `lines`: [{ sku, title, qty }], one per variant; `subtotal` at the buyer's prices. A 'review' problem
// (an order value, or a product's maximum: with its `sku`) blocks checkout too, but
// in the cart the buyer can send the order as an order request instead.
// `spent`: what the buyer ordered so far this week and month (spentSoFar), for
// weekly and monthly maximums. A merchant's own message is used when the limit
// sets one thing; with several, buyers see the message for the one they broke.
export const cartProblems = (db, companyId, locationId, lines, subtotal, spent = {}) => cartProblemsIn(effectiveRules(db, companyId, locationId), lines, subtotal, spent);
export const cartProblemsForCustomer = (db, customer, lines, subtotal, spent = {}) => cartProblemsIn(effectiveRulesForCustomer(db, customer), lines, subtotal, spent);
const ownMessage = (limit) =>
  limit.message && (limit.kind === 'product' || ORDER_FIELDS.filter((f) => settingOf(limit, f).mode === 'set').length === 1) ? limit.message : null;
function cartProblemsIn(rec, lines, subtotal, spent = {}) {
  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const problems = [];
  const setting = (key) => (rec.settings[key]?.mode === 'set' ? rec.settings[key] : null);
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
    const e = productEntry(rec, line.sku);
    const q = quantities(e);
    if (!q) return;
    // Errors show for the whole cart, not on a line — so the merchant's own message
    // is prefixed with the line it's about. Each field names the limit it came from.
    const addLine = (fieldE, text) => problems.push({ type: 'product', limit: fieldE.limit, message: fieldE.limit.message ? `${line.title}: ${fieldE.limit.message}` : text });
    if (q.min != null && line.qty < q.min) addLine(e.min, `${line.title}: order at least ${q.min}.`);
    else if (q.max != null && line.qty > q.max && !q.review) addLine(e.max, `${line.title}: order at most ${q.max}.`);
    else if (q.increment > 1 && line.qty % q.increment) addLine(e.increment, `${line.title} is sold in packs of ${q.increment}.`);
    // Over a maximum sent for review, the line can go as an order request (`sku`, `item`).
    if (q.review && line.qty > q.max) {
      const own = e.max.limit.message ? `${line.title}: ${e.max.limit.message}` : null;
      problems.push({ type: 'review', limit: e.max.limit, message: own || `${line.title}: you can order up to ${q.max} without review. Reduce it or send an order request.`, value: q.max, period: 'order', sku: line.sku, item: line.title });
    }
  });
  const threshold = setting('threshold');
  if (threshold && subtotal > threshold.value) add('review', threshold, `Your current limit is ${money(threshold.value)}. Reduce your order or send an order request.`, threshold.value);
  ['week', 'month'].forEach((p) => {
    const t = setting(`threshold@${p}`);
    const total = sofar(p) + subtotal;
    if (t && total > t.value && !problems.some((x) => x.type === 'review' && !x.sku)) {
      add('review', t, `Your orders this ${p} come to ${money(sofar(p))}. With this one you’d be at ${money(total)}, over the ${money(t.value)} a ${p} you can order without review. Reduce your order or send an order request.`, t.value, p);
    }
  });
  return problems;
}

// ── Overlaps ────────────────────────────────────────────────────────────────
// Read off two limits alone: where both apply (their targets), what both set and
// who wins there — the same order of precedence as the resolver.
const quote = (l) => `“${l.name || 'This limit'}”`;
const capFirst = (s) => s[0].toUpperCase() + s.slice(1);
const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] || '');
// Product titles can hold commas ("Industrial filter, XL"), so a list uses semicolons.
function titles(skus, db) {
  const names = skus.slice(0, 3).map((sku) => (db.products || []).find((p) => p.sku === sku)?.title || sku);
  if (skus.length > 3) return `${names.join('; ')} and ${skus.length - 3} more`;
  return names.length > 1 ? `${names.slice(0, -1).join('; ')} and ${names.at(-1)}` : names[0];
}

// The first day (today or later) two limits both apply, or null when their dates never meet.
function datesMeet(a, b) {
  const start = (l) => (l.startDate && l.startDate > TODAY ? l.startDate : TODAY);
  const end = (l) => l.endDate || '9999-12-31';
  const from = start(a) > start(b) ? start(a) : start(b);
  return from <= end(a) && from <= end(b) ? from : null;
}

// Where two limits both apply, with how each reaches there: [{ label, noun, a, b }]
// (a, b: each one's level). B2B: store-wide, a company or a location — a location
// deleted in Shopify can't order, so it's left out.
function placesB2B(db, a, b) {
  const company = (id) => (db.companies || []).find((c) => c.id === id);
  const companyOf = (key) => key.split('::')[0];
  const spots = (l) => [
    ...(l.companyIds || []).map((id) => ({ key: id, label: company(id)?.name || 'Company', noun: 'company', level: 'company' })),
    ...(l.locationKeys || []).flatMap((k) => {
      const c = company(companyOf(k));
      const loc = c?.locations?.find((x) => x.id === k.split('::')[1]);
      return loc && loc.status !== 'Deleted' ? [{ key: k, label: `${loc.name} · ${c.name}`, noun: 'location', level: 'location' }] : [];
    }),
  ];
  if (a.storeWide && b.storeWide) return [{ label: 'store-wide', noun: 'store', a: 'store', b: 'store' }];
  if (a.storeWide) return spots(b).map((s) => ({ ...s, a: 'store', b: s.level }));
  if (b.storeWide) return spots(a).map((s) => ({ ...s, a: s.level, b: 'store' }));
  const out = [];
  spots(a).forEach((s) => spots(b).forEach((t) => {
    if (s.key === t.key) out.push({ ...s, a: s.level, b: t.level });
    else if (s.level === 'company' && t.level === 'location' && companyOf(t.key) === s.key) out.push({ ...t, a: 'company', b: 'location' });
    else if (s.level === 'location' && t.level === 'company' && companyOf(s.key) === t.key) out.push({ ...s, a: 'location', b: 'company' });
  }));
  return out;
}
// D2C: all, logged-in or non-logged-in customers ('everyone'), a customer tag or a customer.
const BROAD_TARGETS = ['all', 'logged_in', 'logged_out'];
const PICKED_LEVEL = { tags: 'tag', specific: 'customer' };
function placesD2C(db, a, b) {
  const ta = a.customerTarget || 'all';
  const tb = b.customerTarget || 'all';
  const customer = (id) => (db.customers || []).find((c) => c.id === id);
  const place = (target, id) =>
    target === 'tags'
      ? { key: id, label: `customers tagged ${(db.tagPricing || []).find((t) => t.id === id)?.name || id}`, noun: 'customer tag' }
      : { key: id, label: customer(id)?.name || 'a customer', noun: 'customer' };
  if (BROAD_TARGETS.includes(ta) && BROAD_TARGETS.includes(tb)) {
    if (ta !== 'all' && tb !== 'all' && ta !== tb) return []; // logged in, and not
    return [{ label: D2C_TARGET_LABEL[ta === 'all' ? tb : ta].toLowerCase(), noun: 'customer group', a: 'everyone', b: 'everyone' }];
  }
  if (BROAD_TARGETS.includes(ta) || BROAD_TARGETS.includes(tb)) {
    const broadIsA = BROAD_TARGETS.includes(ta);
    const [broad, picked] = broadIsA ? [ta, b] : [tb, a];
    if (broad === 'logged_out') return []; // picked customers and tags are logged in
    const level = PICKED_LEVEL[picked.customerTarget];
    return (picked.customerTargetIds || []).map((id) => ({ ...place(picked.customerTarget, id), a: broadIsA ? 'everyone' : level, b: broadIsA ? level : 'everyone' }));
  }
  const ia = a.customerTargetIds || [];
  const ib = b.customerTargetIds || [];
  // Different tags can meet at a customer who has both too, but which customers is
  // their data, not the limits' — see segmentNote.
  if (ta === tb) return ia.filter((id) => ib.includes(id)).map((id) => ({ ...place(ta, id), a: PICKED_LEVEL[ta], b: PICKED_LEVEL[ta] }));
  // A customer tag and picked customers meet at the customers who have the tag.
  const [tagIds, people] = ta === 'tags' ? [ia, ib] : [ib, ia];
  return people
    .filter((id) => (customer(id)?.tags || []).some((t) => tagIds.includes(t)))
    .map((id) => ({ ...place('specific', id), a: PICKED_LEVEL[ta], b: PICKED_LEVEL[tb] }));
}
const meetingPlaces = (db, a, b) => (isD2CLimit(a) ? placesD2C(db, a, b) : placesB2B(db, a, b));
// How a limit covers the whole of a place, if it does (a limit on one location
// covers only part of its company). Everyone and a customer tag are never covered
// whole.
function levelAtPlace(l, p) {
  if (p.noun === 'store') return l.storeWide ? 'store' : null;
  if (p.noun === 'company') return (l.companyIds || []).includes(p.key) ? 'company' : l.storeWide ? 'store' : null;
  if (p.noun === 'location') return (l.locationKeys || []).includes(p.key) ? 'location' : (l.companyIds || []).includes(p.key.split('::')[0]) ? 'company' : l.storeWide ? 'store' : null;
  if (p.noun === 'customer') return l.customerTarget === 'specific' && (l.customerTargetIds || []).includes(p.key) ? 'customer' : null;
  return null;
}

// " store-wide", " at ABC Construction", " at 2 companies and 4 locations",
// " for customers tagged VIP".
function whereText(places) {
  if (places.length === 1 && places[0].noun === 'store') return ' store-wide';
  const prep = ['company', 'location'].includes(places[0]?.noun) ? 'at' : 'for';
  if (places.length <= 3) return ` ${prep} ${andList(places.map((p) => p.label))}`;
  const counts = new Map();
  places.forEach((p) => counts.set(p.noun, (counts.get(p.noun) || 0) + 1));
  return ` ${prep} ${andList([...counts].map(([noun, n]) => `${n} ${n === 1 ? noun : noun === 'company' ? 'companies' : `${noun}s`}`))}`;
}

const rankWinner = (p) => (LEVEL_RANK[p.a] === LEVEL_RANK[p.b] ? null : { who: LEVEL_RANK[p.a] > LEVEL_RANK[p.b] ? 'a' : 'b', why: 'more specific' });
// The places grouped by who wins there: [{ who, why, places }].
function byWinner(places, winnerAt) {
  const groups = new Map();
  places.forEach((p) => {
    const w = winnerAt(p);
    const k = `${w.who}|${w.why || ''}`;
    if (!groups.has(k)) groups.set(k, { ...w, places: [] });
    groups.get(k).places.push(p);
  });
  return [...groups.values()];
}

// Which rule of a product limit each product takes (rules are in order; a rule on
// all products takes the rest, and the rules after it get nothing).
function coverage(l, db) {
  const bySku = new Map();
  let all = null;
  for (const r of productRules(l)) {
    if (r.scopeType === 'all') {
      all = r;
      break;
    }
    ruleSkus(r, db).forEach((sku) => { if (!bySku.has(sku)) bySku.set(sku, r); });
  }
  return { bySku, all };
}
// The products both product limits set quantities for, by the pair of rules that
// have them: [{ ra, rb, skus }] — skus ['*'] for every product neither names.
function sharedProducts(a, b, db) {
  const ca = coverage(a, db);
  const cb = coverage(b, db);
  const pairs = new Map(); // rule of a → (rule of b → entry)
  const put = (ra, rb, sku) => {
    if (!ruleParts(ra) || !ruleParts(rb)) return;
    if (!pairs.has(ra)) pairs.set(ra, new Map());
    if (!pairs.get(ra).has(rb)) pairs.get(ra).set(rb, { ra, rb, skus: [] });
    pairs.get(ra).get(rb).skus.push(sku);
  };
  new Set([...ca.bySku.keys(), ...cb.bySku.keys()]).forEach((sku) => {
    const ra = ca.bySku.get(sku) || ca.all;
    const rb = cb.bySku.get(sku) || cb.all;
    if (ra && rb) put(ra, rb, sku);
  });
  if (ca.all && cb.all) put(ca.all, cb.all, '*');
  const rest = ca.bySku.size + cb.bySku.size > 0;
  return [...pairs.values()].flatMap((m) => [...m.values()]).map((x) => ({ ...x, label: x.skus[0] === '*' ? (rest ? 'All other products' : 'All products') : titles(x.skus, db), many: x.skus[0] === '*' || x.skus.length > 1 }));
}

// What two limits that meet (`places`, from the day `from`) have to say about each
// other. Two limits of one kind don't combine: where both apply, one replaces the
// other — the more specific, then the newer (`aNewer`: a is newer than b) — a
// product limit only for the products both have. An order limit and a product
// limit both apply, so an order maximum below a product minimum stops orders
// (`stops`). `posOf`: where a limit is in the list (a draft not saved yet, or one
// being turned on, is the newest).
function pairNotes(db, a, b, places, names, aNewer, from, posOf) {
  const stops = [];
  const notes = [];
  const other = (who) => (who === 'a' ? 'b' : 'a');
  const groups = byWinner(places, (p) => rankWinner(p) || { who: aNewer ? 'a' : 'b', why: 'newer' });
  if (a.kind === 'order' && b.kind === 'order') {
    groups.forEach((g) => {
      notes.push(`${capFirst(names[g.who])} replaces ${names[other(g.who)]}${whereText(g.places)}: it’s ${g.why}, so none of ${names[other(g.who)]}’s settings apply there.`);
    });
  } else if (a.kind === 'product' && b.kind === 'product') {
    const sides = { a, b };
    sharedProducts(a, b, db).forEach(({ ra, rb, label, many }) => {
      const rules = { a: ra, b: rb };
      const parts = (who) => ruleParts(rules[who], sides[who].maxAction === 'review');
      groups.forEach((g) => {
        notes.push(`${label} ${many ? 'are' : 'is'} in both limits${whereText(g.places)}: ${names[g.who]} (${parts(g.who)}) applies, not ${names[other(g.who)]} (${parts(other(g.who))}). It’s ${g.why}.`);
      });
    });
  } else {
    // An order limit's maximum units against a product limit's minimum (or pack).
    // Where a third order limit replaces the order limit (more specific, or as
    // specific and newer), it doesn't apply, so it can't stop orders there.
    const [o, p, oSide, pSide] = a.kind === 'order' ? [a, b, 'a', 'b'] : [b, a, 'b', 'a'];
    const replaced = (pl) =>
      (db.limits || []).some((z) => {
        if (z.id === a.id || z.id === b.id || z.kind !== 'order' || limitState(z, from) !== 'Active' || isD2CLimit(z) !== isD2CLimit(a)) return false;
        const level = levelAtPlace(z, pl);
        if (!level) return false;
        const [rz, ro] = [LEVEL_RANK[level], LEVEL_RANK[pl[oSide]]];
        return rz > ro || (rz === ro && newer(z, posOf(z), o, posOf(o)));
      });
    const maxQty = num(settingOf(o, 'maxQty'));
    const where = places.filter((pl) => !replaced(pl));
    if (maxQty != null && where.length) {
      const cov = coverage(p, db);
      [...new Set(cov.bySku.values()), ...(cov.all ? [cov.all] : [])].forEach((r) => {
        const pack = num(ruleSetting(r, 'increment'));
        const min = num(ruleSetting(r, 'min')) ?? (pack > 1 ? pack : null);
        if (min == null || min <= maxQty) return;
        const skus = r === cov.all ? null : [...cov.bySku].filter(([, x]) => x === r).map(([sku]) => sku);
        const label = skus ? titles(skus, db) : cov.bySku.size ? 'All other products' : 'All products';
        const each = !skus || skus.length > 1 ? ' of each' : '';
        stops.push(`${label} can’t be ordered${whereText(where)}: ${names[pSide]} needs at least ${min}${each}, but ${names[oSide]} allows at most ${units(maxQty)} per order.`);
      });
    }
  }
  return { lines: [...stops, ...notes], stops: stops.length > 0, attention: stops.length > 0 };
}

// The other limits a limit (a draft or a stored one) overlaps: ones of its kind it
// replaces or that replace it for some of their buyers (or products), or ones that
// together with it stop orders. One per other limit, the ones that stop orders first:
//   { key, id, name, from, text, stops, attention }
// `from`: the day they start to meet, when it's later than today. `attention`: it
// stops orders. `self`: what to call the limit in the text
// (its name by default; the editor says "this limit"). Last, for a limit on customer
// tags, a soft note when other tags already have limits of its kind (`soft`, no
// `id`: see segmentNote).
export function limitOverlaps(db, draft, { self } = {}) {
  const list = db.limits || [];
  // A limit being created, or turned on (it's off now), is the newest (turnLimitOn).
  const saved = list.find((x) => x.id === draft.id);
  const turningOn = !saved || saved.status !== 'Active';
  const a = { ...normalizeLimit(draft), id: draft.id || 'new', ...(turningOn ? { turnedOnAt: TODAY } : {}) };
  if (a.status !== 'Active' || !isLimitAssigned(a)) return [];
  const pos = (l) => {
    const i = turningOn && l.id === a.id ? -1 : list.findIndex((x) => x.id === l.id);
    return i === -1 ? Infinity : i;
  };
  const out = [];
  list.forEach((b) => {
    if (b.id === a.id || b.status !== 'Active' || isD2CLimit(b) !== isD2CLimit(a) || !isLimitAssigned(b)) return;
    const from = datesMeet(a, b);
    if (!from) return;
    const places = meetingPlaces(db, a, b);
    if (!places.length) return;
    const found = pairNotes(db, a, b, places, { a: self || quote(a), b: quote(b) }, newer(a, pos(a), b, pos(b)), from, pos);
    if (!found.lines.length) return;
    const text = [...found.lines, 'Consider adjusting one of the two.'].join(' ');
    out.push({ key: `${b.id}|${from}`, id: b.id, name: b.name, from: from > TODAY ? from : null, text: capFirst(text), stops: found.stops, attention: found.attention });
  });
  out.sort((x, y) => Number(y.stops) - Number(x.stops) || Number(y.attention) - Number(x.attention));
  const soft = segmentNote(db, a);
  return soft ? [...out, soft] : out;
}

// A customer can have several tags, and with tag limits of one kind on different
// tags, they get only the newest one (segmentLevel). Which customers have which
// tags is their data, not the limits', so this only says which other tags already
// have limits of the kind — no customer is looked up.
function segmentNote(db, a) {
  if (!isD2CLimit(a) || a.customerTarget !== 'tags' || !(a.customerTargetIds || []).length) return null;
  const others = (db.limits || []).filter((b) => b.id !== a.id && b.status === 'Active' && isD2CLimit(b) && b.kind === a.kind
    && b.customerTarget === 'tags' && datesMeet(a, b) && !(b.customerTargetIds || []).some((t) => a.customerTargetIds.includes(t)));
  if (!others.length) return null;
  const tagName = (id) => (db.tagPricing || []).find((t) => t.id === id)?.name || id;
  const tags = [...new Set(others.flatMap((b) => b.customerTargetIds || []))].map(tagName);
  const shown = tags.length > 3 ? `${tags.slice(0, 3).join(', ')} and ${tags.length - 3} more` : andList(tags);
  const kind = a.kind === 'order' ? 'order limits' : 'product limits';
  return {
    key: 'segments', id: null, name: null, from: null, stops: false, attention: false, soft: true,
    text: `Other customer tags already have ${kind} (${shown}). A customer with several tags gets only the newest of these limits, so check them if they may overlap.`,
  };
}

// The overlaps some limits have once a change is made (`nextLimits`, e.g. a
// contract going live), each pair once.
export function overlapsOf(db, nextLimits, ids) {
  const next = { ...db, limits: nextLimits };
  const seen = new Set();
  return ids.flatMap((id) => {
    const l = nextLimits.find((x) => x.id === id);
    if (!l) return [];
    return limitOverlaps(next, l).filter((o) => {
      const k = [id, o.id].sort().join('|');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map((o) => ({ ...o, key: `${id}|${o.key}` }));
  });
}

// ── Validation ──────────────────────────────────────────────────────────────
// Problems that keep a draft from being saved, keyed by field.
export function limitErrors(d) {
  const e = {};
  const n = (k) => toNumber(d[k]);
  // A minimum can be 0 (none); a maximum of 0 would stop every order, so it must be
  // above 0.
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
  // Product limit: each rule on its own (keys `rule-<i>-<field>`). Rules can share
  // products, a rule on all products too: the first one wins them (see
  // ruleOverlaps). A minimum of 0 is none; a pack of 1 is no pack.
  if (d.kind === 'product') {
    const rules = productRules(d);
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
      if (ATTRIBUTE_SCOPES[r.scopeType] && !attributePicks(r).length) {
        e[key('products')] = { tags: 'Pick at least one tag', vendors: 'Pick at least one vendor', productTypes: 'Pick at least one product type' }[r.scopeType];
      }
    });
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
