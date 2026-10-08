// Order limits: rules on what a B2B buyer or D2C wholesale customer can check out. Three kinds:
//   order   — a minimum / maximum order value and / or total quantity. The value
//             is the cart subtotal (cart.cost.subtotalAmount: B2B prices, before
//             tax, shipping and order-level discounts), set in the store currency
//             and converted with presentmentCurrencyRate for buyers paying in another.
//   product — minimum, maximum and increment (case packs) on selected products,
//             checked per variant like Shopify's B2B quantity rules. Kept in the
//             app, not synced to those: they sit on catalog price lists shared by
//             every location on the catalog, and a location with several catalogs
//             takes the cheapest one's — so they can't follow a company / location.
//   review  — orders above an amount go to the merchant for review instead of
//             checking out
// A limit applies store-wide, or to companies (every location, including ones
// added later) and / or single locations (`companyId::locationId`). In production
// order and product limits are a Cart and Checkout Validation function, which reads
// the buyer's company location: cart, checkout (express too) and draft orders,
// though merchants can bypass it on a draft; blockOnFailure on, so a failing
// function blocks checkout. It doesn't run for POS, order edits, the Create Order
// API or subscriptions. A review threshold isn't a validation error: a Payment
// Customization function (orderReviewAdd) submits that checkout as a draft for
// review — B2B orders on Shopify Plus only.
//
// Like pricing, a limit is for B2B buyers (audienceType 'b2b', above) or for D2C
// Wholesale customers outside a company ('d2c'): all, logged-in or non-logged-in
// customers, or specific customers / customer tags (customerTarget +
// customerTargetIds). B2B buyers only get their company's limits. For D2C the
// validation function reads the buyer's customer and tags instead; a review
// threshold is B2B only, since orderReviewAdd is.
//
// When several limits set the same thing for a location, the most specific one
// wins (location > company > store-wide) — so a key account can get a lower
// minimum than everyone else. For D2C: a specific customer > a customer tag > all
// (or logged-in / non-logged-in) customers. At the same level, the strictest one wins.
// Limits that win different settings can still contradict each other (an order
// maximum below a product's minimum): newConflicts finds the ones a change would
// cause — saving, turning on or off or deleting a limit, or an agreement.
import { COLLECTIONS } from './data/constants.js';
import { money } from './format.js';
import { resolveDetail, resolveCustomer, companyForCustomerEmail, policyPriceBreakdown } from './pricing.js';

export const LIMIT_KINDS = {
  order: { label: 'Order limit', description: 'A minimum or maximum order value or total quantity.' },
  product: { label: 'Product limit', description: 'Minimum, maximum and case-pack quantities on selected products.' },
  review: { label: 'Review threshold', description: 'Orders above an amount come to you for review instead of checking out. Shopify Plus only.' },
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
    audienceType: 'b2b',
    storeWide: true,
    companyIds: [],
    locationKeys: [],
    customerTarget: 'all',
    customerTargetIds: [],
    message: '',
  };
}

export const isD2CLimit = (l) => l.audienceType === 'd2c';
const PICKED_TARGETS = ['specific', 'tags'];

// Editor fields hold strings; the db holds numbers or null ("no limit").
const toNumber = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
export function normalizeLimit(draft) {
  const l = { ...draft, name: draft.name.trim(), message: (draft.message || '').trim() };
  NUMBER_FIELDS.forEach((k) => { l[k] = toNumber(l[k]); });
  if (isD2CLimit(l)) {
    Object.assign(l, { storeWide: false, companyIds: [], locationKeys: [] });
    if (!PICKED_TARGETS.includes(l.customerTarget)) l.customerTargetIds = [];
  } else {
    Object.assign(l, { audienceType: 'b2b', customerTarget: 'all', customerTargetIds: [] });
    if (l.storeWide) { l.companyIds = []; l.locationKeys = []; }
  }
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
// mixed across limits); the stricter one has the higher minimum, then the lower
// maximum, then the bigger pack.
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
  const value = [productMin(l) ?? 0, -(l.max ?? Infinity), l.increment ?? 1];
  return [{ keys: limitSkus(l, db).map((sku) => `product:${sku}`), text: text[0].toUpperCase() + text.slice(1), value, strict: 'high' }];
}

// The fewest units of a product a product limit lets a buyer order, or null.
const productMin = (l) => l.min ?? (l.increment > 1 ? l.increment : null);

// Above 0 when `a` is the higher value. A product rule's value is a list,
// compared in order.
function compareValues(a, b) {
  if (!Array.isArray(a)) return a - b;
  const i = a.findIndex((x, k) => x !== b[k]);
  return i < 0 ? 0 : a[i] - b[i];
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

// Every active limit that reaches a buyer, with its rules, plus the limit that
// wins each setting there (keyed like limitRules' keys). `levelOf(limit)` is how
// it reaches them (limitLevel / customerLimitLevel).
function resolveLimits(db, levelOf) {
  const reach = (db.limits || [])
    .filter((l) => l.status === 'Active')
    .map((limit) => ({ limit, level: levelOf(limit), rules: limitRules(limit, db) }))
    .filter((r) => r.level);
  const winner = {};
  reach.forEach(({ limit, level, rules }) => {
    const rank = LEVEL_RANK[level];
    rules.forEach((rule) => rule.keys.forEach((key) => {
      const cur = winner[key];
      const diff = cur && compareValues(rule.value, cur.value);
      const stricter = cur && rank === cur.rank && (rule.strict === 'high' ? diff > 0 : diff < 0);
      if (!cur || rank > cur.rank || stricter) winner[key] = { limit, rank, value: rule.value };
    }));
  });
  return { reach, winner };
}

// Every active limit that reaches a location, most specific first. Each rule is
// marked with the limit that replaces it there, if a more specific (or, at the
// same level, stricter) limit sets the same thing.
export function locationLimits(db, companyId, locationId) {
  const { reach, winner } = resolveLimits(db, atLocation(companyId, locationId));
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

// The quantity rule in effect for one product at a location (for D2C: for a
// customer outside a company, null when not logged in), or null.
function productRuleWith(db, levelOf, sku) {
  const w = resolveLimits(db, levelOf).winner[`product:${sku}`];
  return w ? { min: w.limit.min, max: w.limit.max, increment: w.limit.increment || 1, limit: w.limit } : null;
}
export const productRuleFor = (db, companyId, locationId, sku) => productRuleWith(db, atLocation(companyId, locationId), sku);
export const productRuleForCustomer = (db, customer, sku) => productRuleWith(db, (l) => customerLimitLevel(l, customer), sku);

// What's wrong with a cart under the limits in effect for a location (for D2C, a
// customer) — what the Cart and Checkout Validation function returns as errors.
// `lines`: [{ sku, title, qty }], one per variant; `subtotal` at the buyer's prices. A 'review' problem
// isn't a validation error and doesn't block the order: in production a Payment
// Customization function sends that checkout for review.
export const cartProblems = (db, companyId, locationId, lines, subtotal) => cartProblemsWith(db, atLocation(companyId, locationId), lines, subtotal);
export const cartProblemsForCustomer = (db, customer, lines, subtotal) => cartProblemsWith(db, (l) => customerLimitLevel(l, customer), lines, subtotal);
function cartProblemsWith(db, levelOf, lines, subtotal) {
  const { winner } = resolveLimits(db, levelOf);
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
    // Errors show for the whole cart, not on a line — so the merchant's own message
    // is prefixed with the line it's about.
    const addLine = (text) => problems.push({ type: 'product', limit: w.limit, message: w.limit.message ? `${line.title}: ${w.limit.message}` : text });
    if (min != null && line.qty < min) addLine(`${line.title}: order at least ${min}.`);
    else if (max != null && line.qty > max) addLine(`${line.title}: order at most ${max}.`);
    else if (increment > 1 && line.qty % increment) addLine(`${line.title} is sold in packs of ${increment}.`);
  });
  const threshold = rule('threshold');
  if (threshold && subtotal > threshold.v) add('review', threshold.limit, `Orders over ${money(threshold.v)} need our approval. Submit your order for review and we’ll confirm it.`);
  return problems;
}

// The buyers limits are checked for, each with how a limit reaches them (`levelOf`),
// what they pay (`priceOf(product, variant)`) and a name for where. B2B: every
// company location. D2C: non-logged-in customers, logged-in customers without
// tags, each customer tag (so a tag no customer has yet still counts) and the
// customers who differ from those — picked by name, with several tags, or with
// their own pricing. Customers in a company are B2B buyers.
function buyers(db) {
  const list = [];
  (db.companies || []).forEach((c) => (c.locations || []).forEach((loc) => list.push({
    audience: 'b2b',
    where: `${loc.name} · ${c.name}`,
    levelOf: atLocation(c.id, loc.id),
    priceOf: (product, v) => resolveDetail(c, product, db.policies || [], v, loc).price,
  })));
  const d2c = (db.limits || []).filter(isD2CLimit);
  const picked = new Set(d2c.filter((l) => l.customerTarget === 'specific').flatMap((l) => l.customerTargetIds || []));
  const tags = new Set([...(db.tagPricing || []).map((t) => t.id), ...d2c.filter((l) => l.customerTarget === 'tags').flatMap((l) => l.customerTargetIds || [])]);
  const tagName = (id) => (db.tagPricing || []).find((t) => t.id === id)?.name || id;
  const customer = (cu, where) => list.push({
    audience: 'd2c',
    where,
    levelOf: (l) => customerLimitLevel(l, cu),
    // Non-logged-in customers pay Shopify prices.
    priceOf: (product, v) => {
      const profile = cu && resolveCustomer(db, cu).profile;
      const b = profile && policyPriceBreakdown(profile, product, v);
      return b && b.inScope && b.final != null ? b.final : v?.list ?? product.list;
    },
  });
  customer(null, 'Non logged-in customers');
  customer({ id: null, tags: [] }, 'Logged-in customers');
  tags.forEach((t) => customer({ id: null, tags: [t] }, `Customers tagged ${tagName(t)}`));
  (db.customers || [])
    .filter((cu) => !companyForCustomerEmail(db, cu.email) && (picked.has(cu.id) || (cu.tags || []).length > 1 || cu.policyId))
    .forEach((cu) => customer(cu, cu.name));
  return list;
}

// Every contradiction among the active limits, per buyer: the settings that win
// there contradict each other — an order minimum above the maximum, a product's
// minimum above the order's maximum units or value, or a review threshold below
// the order minimum (every order goes to review). `key` matches the same
// contradiction before and after a change; `ids` are the limits in it.
function allConflicts(db) {
  const list = [];
  const name = (l) => `“${l.name}”`;
  buyers(db).forEach(({ audience, where, levelOf, priceOf }) => {
    const { winner } = resolveLimits(db, levelOf);
    const add = (type, ws, text, detail = '') => list.push({ key: `${where}|${type}|${ws.map((w) => w.limit.id).join('|')}|${detail}`, ids: ws.map((w) => w.limit.id), audience, where, text });
    const { minValue, maxValue, minQty, maxQty, threshold } = winner;
    if (minValue && maxValue && minValue.value > maxValue.value) {
      add('value', [minValue, maxValue], `No order can check out: ${name(minValue.limit)} needs at least ${money(minValue.value)}, but ${name(maxValue.limit)} allows at most ${money(maxValue.value)}.`);
    }
    if (minQty && maxQty && minQty.value > maxQty.value) {
      add('qty', [minQty, maxQty], `No order can check out: ${name(minQty.limit)} needs at least ${units(minQty.value)}, but ${name(maxQty.limit)} allows at most ${units(maxQty.value)}.`);
    }
    if (threshold && minValue && threshold.value < minValue.value) {
      add('review', [minValue, threshold], `Every order goes to review: ${name(minValue.limit)} needs at least ${money(minValue.value)}, and ${name(threshold.limit)} sends orders over ${money(threshold.value)} to you.`);
    }
    Object.keys(winner).filter((key) => key.startsWith('product:')).forEach((key) => {
      const w = winner[key];
      const min = productMin(w.limit);
      const product = (db.products || []).find((p) => `product:${p.sku}` === key);
      if (!min || !product) return;
      if (maxQty && maxQty.value < min) {
        add('product-qty', [w, maxQty], `${product.title} can’t be ordered: ${name(w.limit)} needs at least ${min}, but ${name(maxQty.limit)} allows at most ${units(maxQty.value)} per order.`, product.sku);
      }
      if (!maxValue) return;
      // Counted per variant, at this buyer's price; named when only some can't be ordered.
      const variants = product.variants?.length ? product.variants : [undefined];
      const over = variants.filter((v) => min * priceOf(product, v) > maxValue.value);
      if (!over.length) return;
      const title = over.length < variants.length ? `${product.title} (${over.map((v) => v.title).join(', ')})` : product.title;
      add('product-value', [w, maxValue], `${title} can’t be ordered: ${name(w.limit)} needs at least ${min}, which costs more than the ${money(maxValue.value)} per order ${name(maxValue.limit)} allows.`, title);
    });
  });
  return list;
}

// The contradictions the limits would have after a change (`nextLimits`) that
// they don't have now — plus, with `involving`, every one that limit is part of.
// Grouped per contradiction, with where it happens.
export function newConflicts(db, nextLimits, involving = null) {
  const before = new Set(allConflicts(db).map((c) => c.key));
  const found = new Map();
  allConflicts({ ...db, limits: nextLimits })
    .filter((c) => !before.has(c.key) || (involving && c.ids.includes(involving)))
    .forEach((c) => {
      const k = `${c.audience}|${c.text}`;
      if (!found.has(k)) found.set(k, { text: c.text, audience: c.audience, where: [] });
      found.get(k).where.push(c.where);
    });
  return [...found.values()];
}

// Saving a limit: the contradictions it's part of, and any it leaves between other
// limits (a narrower or turned-off limit can stop covering a clash).
export function limitConflicts(db, draft) {
  const limit = { ...normalizeLimit(draft), id: draft.id || 'new' };
  return newConflicts(db, [...(db.limits || []).filter((l) => l.id !== limit.id), limit], limit.status === 'Active' ? limit.id : null);
}

// Problems that keep a draft from being saved, keyed by field.
export function limitErrors(d) {
  const e = {};
  const n = (k) => toNumber(d[k]);
  const bad = (k) => d[k] !== '' && d[k] != null && !(Number(d[k]) > 0);
  if (!(d.name || '').trim()) e.name = 'Name is required';
  if (d.kind === 'order') {
    ORDER_FIELDS.forEach((k) => { if (bad(k)) e[k] = 'Enter a number above 0'; });
    ['minQty', 'maxQty'].forEach((k) => { if (n(k) != null && !(Number.isInteger(n(k)) && n(k) > 0)) e[k] = 'Enter a whole number above 0'; });
    if (!ORDER_FIELDS.some((k) => n(k) != null)) e.order = 'Set at least one limit';
    if (n('minValue') != null && n('maxValue') != null && n('minValue') > n('maxValue')) e.maxValue = 'Must be more than the minimum';
    if (n('minQty') != null && n('maxQty') != null && n('minQty') > n('maxQty')) e.maxQty = 'Must be more than the minimum';
  }
  if (d.kind === 'product') {
    PRODUCT_FIELDS.forEach((k) => { if (bad(k) || (d[k] !== '' && d[k] != null && !Number.isInteger(Number(d[k])))) e[k] = 'Enter a whole number above 0'; });
    // Multiples of 1 alone sets nothing.
    if (n('min') == null && n('max') == null && !(n('increment') > 1)) e.product = 'Set at least one quantity';
    const inc = n('increment');
    if (inc > 1) {
      if (n('min') != null && n('min') % inc) e.min = `Must be a multiple of ${inc}`;
      if (n('max') != null && n('max') % inc) e.max = `Must be a multiple of ${inc}`;
    }
    if (n('min') != null && n('max') != null && n('min') > n('max')) e.max = 'Must be more than the minimum';
    if (d.scopeType === 'products' && !(d.selectedProducts || []).length) e.products = 'Pick at least one product';
  }
  if (d.kind === 'review' && !(n('threshold') > 0)) e.threshold = 'Enter an amount above 0';
  if (isD2CLimit(d)) {
    if (PICKED_TARGETS.includes(d.customerTarget) && !(d.customerTargetIds || []).length) {
      e.targets = d.customerTarget === 'tags' ? 'Pick at least one customer tag' : 'Pick at least one customer';
    }
  } else if (!d.storeWide && !(d.companyIds || []).length && !(d.locationKeys || []).length) {
    e.targets = 'Pick at least one company or location';
  }
  return e;
}
