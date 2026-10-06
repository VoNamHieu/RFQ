// Order limits: rules on what a B2B buyer can check out. Three kinds:
//   order   — a minimum / maximum order value and / or total quantity
//   product — per-product minimum, maximum and increment (case packs); the same
//             shape as Shopify's native B2B quantity rules, so it can sync there
//   review  — orders above an amount can't be checked out directly; the buyer
//             submits them for the merchant's review instead
// A limit applies store-wide, or to companies (every location, including ones
// added later) and / or single locations (`companyId::locationId`). In production
// they're enforced by a Cart and Checkout Validation function (cart, checkout and
// draft orders), which reads the buyer's company location.
//
// When several limits set the same thing for a location, the most specific one
// wins (location > company > store-wide) — so a key account can get a lower
// minimum than everyone else. At the same level, the strictest one wins.
import { COLLECTIONS } from './data/constants.js';
import { money } from './format.js';

export const LIMIT_KINDS = {
  order: { label: 'Order limit', description: 'A minimum or maximum order value or total quantity.' },
  product: { label: 'Product limit', description: 'Minimum, maximum and case-pack quantities on selected products.' },
  review: { label: 'Review threshold', description: 'Orders above an amount come to you for review instead of checking out.' },
};

export const ORDER_FIELDS = ['minValue', 'maxValue', 'minQty', 'maxQty'];
const PRODUCT_FIELDS = ['min', 'max', 'increment'];
const NUMBER_FIELDS = [...ORDER_FIELDS, ...PRODUCT_FIELDS, 'threshold'];

export function newLimit(kind) {
  return {
    id: null,
    name: '',
    kind,
    status: 'Active',
    ...Object.fromEntries(NUMBER_FIELDS.map((k) => [k, null])),
    scopeType: 'products',
    collection: '',
    selectedProducts: [],
    storeWide: true,
    companyIds: [],
    locationKeys: [],
    message: '',
  };
}

// Editor fields hold strings; the db holds numbers or null ("no limit").
const toNumber = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
export function normalizeLimit(draft) {
  const l = { ...draft, name: draft.name.trim(), message: (draft.message || '').trim() };
  NUMBER_FIELDS.forEach((k) => { l[k] = toNumber(l[k]); });
  if (l.storeWide) { l.companyIds = []; l.locationKeys = []; }
  return l;
}

export const limitKey = (companyId, locationId) => `${companyId}::${locationId}`;

const units = (n) => `${n} unit${n === 1 ? '' : 's'}`;

export function limitSkus(l, db) {
  if (l.scopeType === 'all') return (db.products || []).map((p) => p.sku);
  if (l.scopeType === 'collection') return COLLECTIONS[l.collection] || [];
  return l.selectedProducts || [];
}

export function productScopeLabel(l) {
  if (l.scopeType === 'all') return 'all products';
  if (l.scopeType === 'collection') return l.collection || 'a collection';
  const n = (l.selectedProducts || []).length;
  return `${n} product${n === 1 ? '' : 's'}`;
}

// The settings a limit makes, each as a line of text plus the keys it competes on
// with other limits. A product limit competes per product as one whole rule
// (Shopify needs min and max to be multiples of the increment, so they can't be
// mixed across limits).
export function limitRules(l, db) {
  if (l.kind === 'order') {
    const text = {
      minValue: (v) => `Minimum order ${money(v)}`,
      maxValue: (v) => `Maximum order ${money(v)}`,
      minQty: (v) => `At least ${units(v)} per order`,
      maxQty: (v) => `At most ${units(v)} per order`,
    };
    return ORDER_FIELDS.filter((k) => l[k] != null).map((k) => ({ keys: [k], text: text[k](l[k]), value: l[k], strict: k.startsWith('min') ? 'high' : 'low' }));
  }
  if (l.kind === 'review') {
    return l.threshold != null ? [{ keys: ['threshold'], text: `Orders over ${money(l.threshold)} need your review`, value: l.threshold, strict: 'low' }] : [];
  }
  const parts = [
    l.min != null && `min ${l.min}`,
    l.max != null && `max ${l.max}`,
    l.increment != null && l.increment > 1 && `multiples of ${l.increment}`,
  ].filter(Boolean);
  if (!parts.length) return [];
  const text = `${parts.join(', ')} on ${productScopeLabel(l)}`;
  return [{ keys: limitSkus(l, db).map((sku) => `product:${sku}`), text: text[0].toUpperCase() + text.slice(1), value: l.min ?? l.increment ?? 0, strict: 'high' }];
}

export const limitSummary = (l, db) => limitRules(l, db).map((r) => r.text).join(' · ') || 'No limit set';

// What buyers see when an order breaks the limit, unless the merchant wrote their own.
export function defaultLimitMessage(l) {
  if (l.kind === 'review') return `Orders over ${money(l.threshold || 0)} need our approval. Submit your order for review and we’ll confirm it.`;
  if (l.kind === 'product') {
    if (l.increment > 1) return `This product is sold in packs of ${l.increment}${l.min ? `, minimum ${l.min}` : ''}.`;
    return `You can order ${[l.min && `at least ${l.min}`, l.max && `at most ${l.max}`].filter(Boolean).join(' and ') || 'this product'} per order.`;
  }
  if (l.minValue != null) return `Your order must be at least ${money(l.minValue)} to check out.`;
  if (l.maxValue != null) return `Orders can’t be more than ${money(l.maxValue)}.`;
  if (l.minQty != null) return `Your order needs at least ${units(l.minQty)}.`;
  if (l.maxQty != null) return `Orders can’t have more than ${units(l.maxQty)}.`;
  return '';
}

export const isLimitAssigned = (l) => !!(l.storeWide || (l.companyIds || []).length || (l.locationKeys || []).length);

export function limitTargetsLabel(l, db) {
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
  if ((l.locationKeys || []).includes(limitKey(companyId, locationId))) return 'location';
  if ((l.companyIds || []).includes(companyId)) return 'company';
  if (l.storeWide) return 'store';
  return null;
}

const LEVEL_RANK = { location: 3, company: 2, store: 1 };

// Every active limit that reaches a location, with its rules, plus the limit that
// wins each setting there (keyed like limitRules' keys).
function resolveLimits(db, companyId, locationId) {
  const reach = (db.limits || [])
    .filter((l) => l.status === 'Active')
    .map((limit) => ({ limit, level: limitLevel(limit, companyId, locationId), rules: limitRules(limit, db) }))
    .filter((r) => r.level);
  const winner = {};
  reach.forEach(({ limit, level, rules }) => {
    const rank = LEVEL_RANK[level];
    rules.forEach((rule) => rule.keys.forEach((key) => {
      const cur = winner[key];
      const stricter = cur && rank === cur.rank && (rule.strict === 'high' ? rule.value > cur.value : rule.value < cur.value);
      if (!cur || rank > cur.rank || stricter) winner[key] = { limit, rank, value: rule.value };
    }));
  });
  return { reach, winner };
}

// Every active limit that reaches a location, most specific first. Each rule is
// marked with the limit that replaces it there, if a more specific (or, at the
// same level, stricter) limit sets the same thing.
export function locationLimits(db, companyId, locationId) {
  const { reach, winner } = resolveLimits(db, companyId, locationId);
  return reach
    .map(({ limit, level, rules }) => ({
      limit,
      level,
      rules: rules.map((rule) => {
        // A product rule stays in effect while it still wins on any of its products.
        const wins = rule.keys.some((key) => winner[key]?.limit.id === limit.id);
        const by = wins ? null : winner[rule.keys[0]]?.limit || null;
        return { ...rule, replacedBy: by };
      }),
    }))
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
}

// The quantity rule in effect for one product at a location, or null.
export function productRuleFor(db, companyId, locationId, sku) {
  const w = resolveLimits(db, companyId, locationId).winner[`product:${sku}`];
  return w ? { min: w.limit.min, max: w.limit.max, increment: w.limit.increment || 1, limit: w.limit } : null;
}

// What's wrong with a cart under the limits in effect for a location — what the
// Cart and Checkout Validation function returns as errors. `lines`: [{ sku, title,
// qty }]; `subtotal` at the buyer's prices. A 'review' problem doesn't block the
// order outright: the buyer can send it for review instead of checking out.
export function cartProblems(db, companyId, locationId, lines, subtotal) {
  const { winner } = resolveLimits(db, companyId, locationId);
  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const problems = [];
  const add = (type, limit, text) => problems.push({ type, limit, message: limit.message || text });
  const rule = (key) => winner[key] && { limit: winner[key].limit, v: winner[key].value };

  const minValue = rule('minValue');
  if (minValue && subtotal < minValue.v) add('minValue', minValue.limit, `Your order must be at least ${money(minValue.v)} to check out. Add ${money(minValue.v - subtotal)} more.`);
  const maxValue = rule('maxValue');
  if (maxValue && subtotal > maxValue.v) add('maxValue', maxValue.limit, `Orders can’t be more than ${money(maxValue.v)}. Remove ${money(subtotal - maxValue.v)} to check out.`);
  const minQty = rule('minQty');
  if (minQty && totalQty < minQty.v) add('minQty', minQty.limit, `Your order needs at least ${units(minQty.v)}. Add ${units(minQty.v - totalQty)} more.`);
  const maxQty = rule('maxQty');
  if (maxQty && totalQty > maxQty.v) add('maxQty', maxQty.limit, `Orders can’t have more than ${units(maxQty.v)}.`);
  lines.forEach((line) => {
    const w = winner[`product:${line.sku}`];
    if (!w) return;
    const { min, max, increment } = w.limit;
    if (min != null && line.qty < min) add('product', w.limit, `${line.title}: order at least ${min}.`);
    else if (max != null && line.qty > max) add('product', w.limit, `${line.title}: order at most ${max}.`);
    else if (increment > 1 && line.qty % increment) add('product', w.limit, `${line.title} is sold in packs of ${increment}.`);
  });
  const threshold = rule('threshold');
  if (threshold && subtotal > threshold.v) add('review', threshold.limit, `Orders over ${money(threshold.v)} need our approval. Submit your order for review and we’ll confirm it.`);
  return problems;
}

// Problems that keep a draft from being saved, keyed by field.
export function limitErrors(d) {
  const e = {};
  const n = (k) => toNumber(d[k]);
  const bad = (k) => d[k] !== '' && d[k] != null && !(Number(d[k]) > 0);
  if (!(d.name || '').trim()) e.name = 'Name is required';
  if (d.kind === 'order') {
    ORDER_FIELDS.forEach((k) => { if (bad(k)) e[k] = 'Enter a number above 0'; });
    if (!ORDER_FIELDS.some((k) => n(k) != null)) e.order = 'Set at least one limit';
    if (n('minValue') != null && n('maxValue') != null && n('minValue') > n('maxValue')) e.maxValue = 'Must be more than the minimum';
    if (n('minQty') != null && n('maxQty') != null && n('minQty') > n('maxQty')) e.maxQty = 'Must be more than the minimum';
  }
  if (d.kind === 'product') {
    PRODUCT_FIELDS.forEach((k) => { if (bad(k) || (d[k] !== '' && d[k] != null && !Number.isInteger(Number(d[k])))) e[k] = 'Enter a whole number above 0'; });
    if (!PRODUCT_FIELDS.some((k) => n(k) != null)) e.product = 'Set at least one quantity';
    const inc = n('increment');
    if (inc > 1) {
      if (n('min') != null && n('min') % inc) e.min = `Must be a multiple of ${inc}`;
      if (n('max') != null && n('max') % inc) e.max = `Must be a multiple of ${inc}`;
    }
    if (n('min') != null && n('max') != null && n('min') > n('max')) e.max = 'Must be more than the minimum';
    if (d.scopeType === 'products' && !(d.selectedProducts || []).length) e.products = 'Pick at least one product';
  }
  if (d.kind === 'review' && !(n('threshold') > 0)) e.threshold = 'Enter an amount above 0';
  if (!d.storeWide && !(d.companyIds || []).length && !(d.locationKeys || []).length) e.targets = 'Pick at least one company or location';
  return e;
}
