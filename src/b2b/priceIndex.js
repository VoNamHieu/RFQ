// Prices as data the order-limit checks read, so a check never prices the whole
// catalog for every buyer.
//
// A buyer's unit price comes from a stack of pricings: the first one that covers
// the product decides its price, else the Shopify price (pricing.js:
// resolveDetail). The index keeps two layers, each built once and then read:
//   per pricing  every variant it covers with its price (listFor)
//   per stack    what a buyer on that stack pays for every variant, cheapest
//                first, and each product's dearest unit, dearest first (viewFor) —
//                shared by every buyer on the same pricings
// A question at save time ("the cheapest 100 units", "products dearer than $33")
// then reads the front of an array or finds a cut-off by binary search.
//
// Everything is kept per version of the catalog and the pricings (a new list on
// every change, as the store does) and worked out ahead in the background
// (warmPriceIndex in limits.js); in production the app keeps it and rebuilds a
// pricing's list, and the views on it, when that pricing or the catalog changes.
import { baseInScope, companyActiveBasePolicies, companyActiveQuantityPolicies, hasOwnSlot, policyPriceBreakdown, resolveCustomer } from './pricing.js';

const variantsOf = (product) => (product.variants?.length ? product.variants : [undefined]);
const shopifyPrice = (product, v) => (v && v.list != null ? v.list : product.list);
const unitKey = (product, v) => `${product.sku}|${v?.id ?? ''}`;
const byPrice = (a, b) => a.price - b.price;

const indexes = new WeakMap(); // catalog → (pricings → index)
export function priceIndex(db) {
  const products = db.products || [];
  const policies = db.policies || [];
  if (!indexes.has(products)) indexes.set(products, new WeakMap());
  const kept = indexes.get(products);
  if (!kept.has(policies)) kept.set(policies, buildIndex(products));
  return kept.get(policies);
}

// `mode`: how a pricing covers products in the stack it sits in — 'base' (a
// company base list: its product scope), 'quantity' (its own scope) or 'any' (a
// wholesale customer's pricing: its own scope).
function buildIndex(products) {
  const units = products.flatMap((product) => variantsOf(product).map((variant) => ({ product, variant, key: unitKey(product, variant) })));
  const lists = new Map();
  const listFor = (policy, mode) => {
    const k = `${policy.id}|${mode}`;
    if (!lists.has(k)) {
      const prices = new Map();
      const covers = new Set();
      units.forEach((u) => {
        if (mode === 'base' && !baseInScope(policy, u.product.sku)) return;
        const b = policyPriceBreakdown(policy, u.product, u.variant);
        if (b && b.inScope && b.final != null) {
          prices.set(u.key, b.final);
          covers.add(u.product.sku);
        }
      });
      lists.set(k, { prices, covers });
    }
    return lists.get(k);
  };
  const index = { units, listFor };
  const views = new Map();
  index.viewFor = (stack) => {
    const k = stackKey(stack);
    if (!views.has(k)) {
      const priced = [];
      units.forEach((u) => {
        const price = unitPrice(index, stack, u.product, u.variant);
        if (price != null) priced.push({ ...u, price });
      });
      priced.sort(byPrice);
      const dearest = new Map();
      priced.forEach((u) => dearest.set(u.product, u.price)); // ascending: the last one is the dearest
      views.set(k, { units: priced, products: [...dearest].map(([product, price]) => ({ product, price })).sort((a, b) => b.price - a.price) });
    }
    return views.get(k);
  };
  // Answers kept for this version of the prices, keyed by the question and the
  // stack asked about (buyers on the same pricings share them).
  const answers = new Map();
  index.remember = (key, work) => {
    if (!answers.has(key)) answers.set(key, work());
    return answers.get(key);
  };
  return index;
}

// A stack's identity: the same pricings in the same order price everything the same.
export const stackKey = (stack) => stack.map(({ policy, mode }) => `${policy.id}:${mode}`).join(',');

// A company location's pricings in the order they decide prices: its base list,
// then its quantity list (its own lists, else its company's). Kept per version of
// the pricings and of the company.
const stacks = new WeakMap(); // pricings → (company → location id → stack)
export function locationStack(company, location, policies) {
  if (!stacks.has(policies)) stacks.set(policies, new WeakMap());
  const byCompany = stacks.get(policies);
  if (!byCompany.has(company)) byCompany.set(company, new Map());
  const byLocation = byCompany.get(company);
  const k = location?.id ?? '';
  if (!byLocation.has(k)) {
    const holder = (kind) => (hasOwnSlot(location, kind) ? location : company);
    byLocation.set(k, [
      ...companyActiveBasePolicies(holder('base'), policies).map((policy) => ({ policy, mode: 'base' })),
      ...companyActiveQuantityPolicies(holder('quantity'), policies).map((policy) => ({ policy, mode: 'quantity' })),
    ]);
  }
  return byLocation.get(k);
}
// A wholesale customer's pricing (none when not logged in: Shopify prices).
export function customerStack(db, customer) {
  const profile = customer && resolveCustomer(db, customer).profile;
  return profile ? [{ policy: profile, mode: 'any' }] : [];
}

// What a buyer pays for one unit of a variant.
export function unitPrice(index, stack, product, variant) {
  for (const { policy, mode } of stack) {
    const list = index.listFor(policy, mode);
    if (list.covers.has(product.sku)) return list.prices.get(unitKey(product, variant)) ?? null;
  }
  return shopifyPrice(product, variant);
}

// Every unit (variant) a buyer can buy with its price, cheapest first ('asc') or
// dearest first ('desc').
export function unitsInOrder(index, stack, dir = 'asc') {
  const { units } = index.viewFor(stack);
  return dir === 'asc' ? units : [...units].reverse();
}

// Take units in order, each product up to its maximum (`capOf(product)`, null for
// none), until `count` are taken.
function take(units, count, capOf, from, step) {
  let left = count;
  let total = 0;
  let first = null;
  for (let i = from; i >= 0 && i < units.length && left > 0; i += step) {
    const u = units[i];
    const cap = capOf(u.product);
    const n = cap == null ? left : Math.min(left, cap);
    if (n <= 0) continue;
    first = first || u;
    total += n * u.price;
    left -= n;
  }
  return { total, first, left };
}

// The least a buyer can pay for `count` units: cheapest units first, each
// product up to its maximum. Packs and product minimums are left out, so it never
// claims an order costs more than it can. { cost, first } — `first` the cheapest
// unit; cost Infinity (with `reach`, the most units they can buy) when the
// maximums don't add up to `count`.
export function cheapestUnits(index, stack, count, capOf) {
  const { units } = index.viewFor(stack);
  const r = take(units, count, capOf, 0, 1);
  return r.left > 0 ? { cost: Infinity, first: r.first, reach: count - r.left } : { cost: r.total, first: r.first };
}

// The most a buyer can spend with at most `count` units: dearest units first,
// each product up to its maximum. Packs and product minimums are left out, so it
// never claims an order is worth less than it can be. { value, first }.
export function dearestUnits(index, stack, count, capOf) {
  const { units } = index.viewFor(stack);
  const r = take(units, count, capOf, units.length - 1, -1);
  return { value: r.total, first: r.first };
}

// The products a buyer pays more than `price` for (some unit of), dearest first:
// [{ product, price }] where `price` is its dearest unit.
export function productsAbove(index, stack, price) {
  const { products } = index.viewFor(stack);
  let lo = 0;
  let hi = products.length; // first position not above `price`
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (products[mid].price > price) lo = mid + 1;
    else hi = mid;
  }
  return products.slice(0, lo);
}

// Work out a stack's views ahead of a check.
export const warmStack = (index, stack) => index.viewFor(stack);
