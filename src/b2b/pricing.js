// Pricing engine — ported to full parity with the B2B god file (b2b/index.html
// §1809-2503, §4455). Resolution walks a company's Active, in-date base pricings
// in priority order (a scoped base that does not cover a product falls through to
// the next), then its quantity pricings the same way; the first price wins. Status, usage and a
// company's "needs a price" are all DERIVED from the data, never stored.
import { COLLECTIONS, CATALOG_PRICES } from './data/constants.js';

// Demo "today" anchor for dated validity (legacy TODAY = new Date('2026-07-28')).
// Dates are plain YYYY-MM-DD, so lexical string comparison matches Date order.
export const TODAY = '2026-07-28';

export const KIND_ORDER = ['base', 'quantity'];
export const kindOf = (p) => (p?.priceKind === 'quantity' ? 'quantity' : 'base');
// Generic "usable" gate — a policy that is not turned off (any kind).
const activePolicy = (p) => (p && p.status !== 'Inactive' ? p : null);

export function policyById(policies, id) {
  return (policies || []).find((p) => p.id === id) || null;
}

// ── Contract pricing first (Upcoming) ───────────────────────────────────────
// A pricing an Active contract gives a company or location applies there before
// every other one, whatever its priority (it beats priority 0); among themselves,
// contract pricings go by priority. Which ones those are is derived from the
// contracts (agreements.js liveContractPricing) and handed over by the store:
// holder id (company or location) → pricing ids. Empty without Contracts. There it
// applies on the contract's dates, whatever its own.
let contractPricing = {};
export function setContractPricing(map) {
  contractPricing = map || {};
}
// Resolve with other contracts in force — e.g. a contract's price preview, as if
// it applied. Restores the live ones after.
export function withContractPricing(map, fn) {
  const live = contractPricing;
  contractPricing = map || {};
  try {
    return fn();
  } finally {
    contractPricing = live;
  }
}
const fromContract = (holder, id) => !!holder?.id && (contractPricing[holder.id] || []).includes(id);

// ── Company base / quantity lists (resolution order) ─────────────────────────
// A company (or location) holds a LIST per kind: pricing.base and pricing.quantity
// are both [{id, priority}]. Priority is a property of the PROFILE (its "Priority
// 0-99" field), not a per-company number: lower applies first. A live contract's
// pricing comes before all of them (see above). On a tie a SCOPED profile (covers
// only some SKUs — e.g. a quote pricing) beats an all-products one, then insertion
// order. Dangling ids dropped; a legacy scalar id normalized to a one-item list.
function slotEntries(holder, policies, kind) {
  let list = holder?.pricing?.[kind];
  if (!list) return [];
  if (typeof list === 'string') list = [{ id: list, priority: 1 }];
  const spec = (id) => {
    const st = policyById(policies, id)?.scopeType;
    return st && st !== 'all' ? 0 : 1;
  };
  return list
    .map((e, idx) => {
      const id = (e && e.id) || e;
      const policy = policyById(policies, id);
      return { id, idx, priority: Number(policy?.priority) || 0, policy, byContract: fromContract(holder, id) };
    })
    .filter((e) => e.policy)
    .sort((a, b) => b.byContract - a.byContract || a.priority - b.priority || spec(a.id) - spec(b.id) || a.idx - b.idx);
}

// Usable for resolution right now: not Inactive, and inside its dated window if
// it has one. Scheduled/expired bases step aside so the next priority applies. At
// a `holder` a contract gives it to, its own dates don't count (the contract's do).
export function basePriceableNow(policy, holder = null) {
  if (!policy || policy.status === 'Inactive') return false;
  if (fromContract(holder, policy.id)) return true;
  // Dated window (god-file model): active from startDate, optionally until endDate.
  // Backward compatible with seed policies that carry startDate/endDate directly.
  if (policy.startDate && policy.startDate > TODAY) return false;
  if (policy.endDate && policy.endDate < TODAY) return false;
  return true;
}
export function companyBaseEntries(company, policies) {
  return slotEntries(company, policies, 'base');
}
export function companyQuantityEntries(company, policies) {
  return slotEntries(company, policies, 'quantity');
}
// Which of a company's locations get a pricing: a location on its own list
// checks that list, the rest follow the company's. 'All locations' when every
// one does (or the company has none and holds it), else their names.
export function pricingLocationsLabel(company, kind, policyId) {
  const locs = company.locations || [];
  if (!locs.length) return slotIds(company, kind).includes(policyId) ? 'All locations' : 'No locations';
  const got = locs.filter((l) => (hasOwnSlot(l, kind) ? slotIds(l, kind) : slotIds(company, kind)).includes(policyId));
  if (got.length === locs.length) return 'All locations';
  if (!got.length) return 'No locations';
  const names = got.map((l) => l.name);
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
}

// A location's catalog: the products its buyers can buy, and the fixed prices its
// price list sets (by variant id). `catalog` names a collection; a location
// without one gets every product at its Shopify price.
export function locationCatalog(location, products) {
  const name = location?.catalog || null;
  return {
    name: name || 'All products',
    skus: name ? COLLECTIONS[name] || [] : (products || []).map((p) => p.sku),
    prices: (name && CATALOG_PRICES[name]) || {},
  };
}

// Pricing only some of a company's locations get — on their own lists, not the
// company's — each with those locations, so the company page lists it too.
export function locationOnlyEntries(company, policies, kind) {
  const onCompany = new Set(slotIds(company, kind));
  const byId = new Map();
  (company.locations || []).forEach((l) => {
    slotEntries(l, policies, kind).forEach((e) => {
      if (onCompany.has(e.id)) return;
      if (!byId.has(e.id)) byId.set(e.id, { ...e, locations: [] });
      byId.get(e.id).locations.push(l);
    });
  });
  return [...byId.values()];
}
// Does a location hold its OWN list of a kind? Any list — even an empty one (the
// location has none of that kind) — replaces the company's; null/missing inherits.
export function hasOwnSlot(holder, kind) {
  return holder?.pricing?.[kind] != null;
}
// Raw ids held in a holder's slot (legacy scalar or list), without looking the
// policies up — for "does it hold this pricing" checks.
export function slotIds(holder, kind) {
  const v = holder?.pricing?.[kind];
  if (!v) return [];
  if (typeof v === 'string') return [v];
  return v.map((e) => (e && e.id) || e);
}

export function companyActiveBasePolicies(company, policies) {
  return companyBaseEntries(company, policies)
    .map((e) => e.policy)
    .filter((p) => basePriceableNow(p, company));
}
export function companyActiveQuantityPolicies(company, policies) {
  return companyQuantityEntries(company, policies)
    .map((e) => e.policy)
    .filter(activePolicy);
}

// ── Variants ─────────────────────────────────────────────────────────────────
// A product's variants; the FIRST is the default and its id === the product sku.
// Overrides (variantAdjustments) and quotes key by variant id; product-only
// callers resolve against the default variant, so per-SKU behavior is unchanged.
export const productVariants = (product) =>
  product && Array.isArray(product.variants) && product.variants.length
    ? product.variants
    : product
      ? [{ id: product.sku, title: 'Default', list: product.list }]
      : [];
export const defaultVariant = (product) => productVariants(product)[0] || null;
const variantBase = (product, variant) => {
  const v = variant || defaultVariant(product);
  return v && v.list != null ? v.list : product?.list;
};

// ── Scope + rule matching ────────────────────────────────────────────────────
const explicitOn = (p) => !!(p && Object.keys(p.variantAdjustments || {}).length);

// A base only prices products in its scope (all | collection | products); a
// product outside that scope falls through to the NEXT base by priority.
export function baseInScope(base, sku) {
  if (!base) return false;
  const st = base.scopeType;
  if (!st || st === 'all') return true;
  if (st === 'collection') return scopeCollections(base).some((c) => (COLLECTIONS[c] || []).includes(sku));
  if (st === 'products') return (base.selectedProducts || []).includes(sku);
  return true;
}
// The collections a pricing is scoped to: its picks (selectedCollections), else
// its single legacy `collection` when that is a real collection.
export const scopeCollections = (p) =>
  Array.isArray(p?.selectedCollections) ? p.selectedCollections : p?.collection && COLLECTIONS[p.collection] ? [p.collection] : [];

// Whether a profile prices a product at all (a base always does; quantity honors
// its own product scope — all, specific products, collections or product tags).
// Base pricing narrowing is handled by baseInScope above.
function inScope(profile, product) {
  if (!profile || !product) return false;
  if (kindOf(profile) === 'base') return true;
  switch (profile.scopeType) {
    case 'all':
      return true;
    case 'collection':
      return scopeCollections(profile).some((c) => (COLLECTIONS[c] || []).includes(product.sku));
    case 'tags':
      return (product.tags || []).some((t) => (profile.selectedTags || []).includes(t));
    default:
      return (profile.selectedProducts || []).includes(product.sku);
  }
}

const condValues = (c) =>
  !c ? [] : Array.isArray(c.values) ? c.values.filter(Boolean) : c.value != null && c.value !== '' ? [c.value] : [];

function conditionMatches(cond, product) {
  const vals = condValues(cond);
  if (!vals.length) return false;
  switch (cond.field) {
    case 'all':
      return true;
    case 'collection':
      return vals.some((v) => (COLLECTIONS[v] || []).includes(product.sku));
    case 'vendor':
      return vals.includes(product.vendor);
    case 'productType':
      return vals.includes(product.productType);
    case 'tag':
      return (product.tags || []).some((t) => vals.includes(t));
    default:
      return false;
  }
}
// A rule can hold several conditions across dimensions, joined by match ANY/ALL.
export function ruleMatches(rule, product) {
  const conds = (rule?.conditions || []).filter((c) => condValues(c).length);
  if (!conds.length) return false;
  return rule.match === 'ANY'
    ? conds.some((c) => conditionMatches(c, product))
    : conds.every((c) => conditionMatches(c, product));
}
// Back-compat name used by the rule-builder card.
export const productMatchesRule = ruleMatches;
export function ruleMatchCount(rule, products) {
  return products.filter((p) => ruleMatches(rule, p)).length;
}
function matchConditionalRuleIndex(profile, product) {
  const rules = profile.conditionalRules || [];
  for (let i = 0; i < rules.length; i += 1) if (ruleMatches(rules[i], product)) return i;
  return -1;
}

// Apply an adjustment to a base price. Rounds to 2dp. A decrease bigger than the
// base clamps to 0 — a price can't be negative (buyers pay 0, not a refund).
export function applyAdjustment(rule, valueType, value, base) {
  const round = (x) => Math.round(x * 100) / 100;
  const val = Number(value ?? 0);
  if (rule === 'keep') return base;
  if (rule === 'set') return round(val);
  if (rule === 'decrease') return round(Math.max(0, valueType === 'percentage' ? base * (1 - val / 100) : base - val));
  if (rule === 'increase') return round(valueType === 'percentage' ? base * (1 + val / 100) : base + val);
  return base;
}

// The price + which layer decided it, for one profile (null if out of scope):
// Product override → Conditional rule → profile-level default.
function priceForDetail(profile, product, variant) {
  if (!inScope(profile, product)) return null;
  const v = variant || defaultVariant(product);
  const base = variantBase(product, v);
  const adj = explicitOn(profile) && v ? (profile.variantAdjustments || {})[v.id] : null;
  if (adj && adj.rule) {
    return { price: applyAdjustment(adj.rule, adj.valueType || 'percentage', adj.value, base), layer: 'override', decidedBy: profile.name, policy: profile };
  }
  const ri = matchConditionalRuleIndex(profile, product);
  if (ri >= 0) {
    const r = profile.conditionalRules[ri];
    return { price: applyAdjustment(r.rule, r.valueType || 'percentage', r.value, base), layer: 'rule', decidedBy: `${profile.name} · Rule ${ri + 1}`, policy: profile };
  }
  return { price: applyAdjustment(profile.pricingRule, profile.valueType, profile.value, base), layer: 'base', decidedBy: `${profile.name} · Default price`, policy: profile };
}

// Single-profile price breakdown for the editor's "How the price resolves"
// preview: the Shopify price, the profile's default adjustment, a matching
// conditional rule, an explicit override, and what the buyer pays — same
// precedence as priceForDetail (override → rule → default).
export function policyPriceBreakdown(profile, product, variant) {
  if (!profile || !product) return null;
  const v = variant || defaultVariant(product);
  const base = variantBase(product, v);
  const defaultPrice = applyAdjustment(profile.pricingRule, profile.valueType, profile.value, base);
  const ri = matchConditionalRuleIndex(profile, product);
  const rule =
    ri >= 0
      ? {
          index: ri,
          price: applyAdjustment(
            profile.conditionalRules[ri].rule,
            profile.conditionalRules[ri].valueType || 'percentage',
            profile.conditionalRules[ri].value,
            base,
          ),
        }
      : null;
  const adj = explicitOn(profile) && v ? (profile.variantAdjustments || {})[v.id] : null;
  const override = adj && adj.rule ? applyAdjustment(adj.rule, adj.valueType || 'percentage', adj.value, base) : null;
  const final = override != null ? override : rule ? rule.price : defaultPrice;
  return { shopify: base, defaultPrice, rule, override, final, inScope: inScope(profile, product), variant: v };
}

// Resolve the B2B price a company pays for a product (legacy resolvedPriceFor):
// the first in-scope Active base wins (a scope-all base is authoritative and
// returns the Shopify price when nothing matches); else the first in-scope Active
// quantity pricing; else null → the caller shows "No pricing". With a location,
// its own list of a kind replaces the company's (see hasOwnSlot); without one,
// it's what a location still on the company's pricing pays.
function resolveProductDetail(company, product, policies, variant, location) {
  const holder = (kind) => (hasOwnSlot(location, kind) ? location : company);
  for (const p of companyActiveBasePolicies(holder('base'), policies)) {
    if (!baseInScope(p, product.sku)) continue;
    const r = priceForDetail(p, product, variant);
    if (r) return r;
  }
  for (const q of companyActiveQuantityPolicies(holder('quantity'), policies)) {
    const r = priceForDetail(q, product, variant);
    if (r) return r;
  }
  return null;
}
export function resolvedPriceFor(company, product, policies, variant, location) {
  const r = resolveProductDetail(company, product, policies, variant, location);
  return r ? r.price : null;
}
// Like resolvedPriceFor, but reports which layer decided the price; the Price
// Board falls back to the Shopify price row when nothing is assigned.
export function resolveDetail(company, product, policies, variant, location) {
  return resolveProductDetail(company, product, policies, variant, location) || { price: variantBase(product, variant), decidedBy: 'Shopify price', layer: 'shopify' };
}

// ── Company-level resolution (source / status / needs-a-price) ───────────────
// A Location's own list of a kind (same shape as the company's: [{id, priority}],
// or a legacy single id — see hasOwnSlot) replaces the company's list of that
// kind; else the company's Active bases + quantities; else the store-wide
// All-Companies default.
export function resolvePricing(company, location, policies, defaults) {
  const holder = (kind) => (hasOwnSlot(location, kind) ? location : company);
  const basePolicies = companyActiveBasePolicies(holder('base'), policies);
  const qtyPolicies = companyActiveQuantityPolicies(holder('quantity'), policies);
  const profiles = [...basePolicies, ...qtyPolicies];
  if (profiles.length) return { profiles, profile: profiles[0] };
  const def = activePolicy(policyById(policies, defaults && defaults.b2bPolicyId));
  if (def) return { profiles: [def], profile: def };
  return { profiles: [], profile: null };
}

// Per-kind resolved pricing for a Location: the Location's own list of a kind
// replaces the whole inherited list of that kind; otherwise the company's (priority
// order). Active ones only, unless includeInactive (the location page lists
// Scheduled/Inactive ones too, with their status). Each carries its source.
export function locationPricingEntries(company, location, policies, { includeInactive = false } = {}) {
  const pick = (kind, entries, active) => {
    const own = hasOwnSlot(location, kind);
    const holder = own ? location : company;
    const list = includeInactive ? entries(holder, policies).map((e) => e.policy) : active(holder, policies);
    return list.map((p) => ({ policy: p, source: own ? 'LOCATION' : 'COMPANY' }));
  };
  return {
    bases: pick('base', companyBaseEntries, companyActiveBasePolicies),
    quantities: pick('quantity', companyQuantityEntries, companyActiveQuantityPolicies),
  };
}

// Products-column label for a policy (base defaults to all; quantity to products).
export const scopeLabel = (p) => {
  if (!p) return 'None';
  const st = p.scopeType || (kindOf(p) === 'base' ? 'all' : 'products');
  if (st === 'all') return 'All products';
  if (st === 'collection') {
    const cs = scopeCollections(p);
    return cs.length === 1 ? cs[0] : cs.length ? `${cs.length} collections` : 'Collection';
  }
  if (st === 'tags') {
    const ts = p.selectedTags || [];
    return ts.length === 1 ? `Tag: ${ts[0]}` : `${ts.length} product tags`;
  }
  const n = (p.selectedProducts || []).length;
  return `${n} selected product${n === 1 ? '' : 's'}`;
};

// A company "needs a price" if any of its locations fails to resolve a profile —
// considering location overrides, active/dated validity, and the global default.
export function companyNeedsPrice(company, policies, defaults) {
  const locs = company.locations || [];
  if (!locs.length) return !resolvePricing(company, null, policies, defaults).profile;
  return locs.some((l) => !resolvePricing(company, l, policies, defaults).profile);
}
export function companyPricingStatus(company, policies, defaults) {
  return companyNeedsPrice(company, policies, defaults)
    ? { label: 'Needs a price', tone: undefined } // neutral: an ordinary step left to do
    : { label: 'Price ready', tone: 'success' };
}

// ── Customer (d2c) resolution ────────────────────────────────────────────────
// A contact attached to a company always gets the B2B experience, so no
// customer-level pricing can reach them (legacy companyForCustomerEmail).
export function companyForCustomerEmail(db, email) {
  if (!email) return null;
  const key = String(email).toLowerCase();
  return (db.companies || []).find((c) => (c.contacts || []).some((x) => String(x.email).toLowerCase() === key)) || null;
}
export function tagPolicyFor(db, customer) {
  const tags = customer?.tags || [];
  for (const t of db.tagPricing || []) if (tags.includes(t.id) && t.defaultPolicyId) return t;
  return null;
}
// The policy a wholesale (non-company) customer is priced by: explicit override →
// tag default → store-wide wholesale default.
export function resolveCustomer(db, customer) {
  if (companyForCustomerEmail(db, customer?.email)) return { profile: null, source: 'Priced by their Company' };
  if (customer?.policyId) return { profile: policyById(db.policies, customer.policyId), source: 'Customer override' };
  const t = tagPolicyFor(db, customer);
  if (t) return { profile: policyById(db.policies, t.defaultPolicyId), source: `Tag default · ${t.name}` };
  if (db.defaults?.wholesalePolicyId) return { profile: policyById(db.policies, db.defaults.wholesalePolicyId), source: 'All customers default' };
  return { profile: null, source: 'No pricing' };
}

// ── Status (derived) ─────────────────────────────────────────────────────────
// Read order = decisiveness: turned off, then nobody assigned, then dated window.
// (Pass `db` to apply the "nobody assigned ⇒ Inactive" rule.)
export function policyStatus(policy, db) {
  if (!policy) return { label: 'Not set', tone: undefined };
  if (policy.status === 'Inactive') return { label: 'Inactive', tone: undefined };
  if (db && policyUsageCount(policy, db) === 0) return { label: 'Inactive', tone: undefined };
  if (policy.startDate && policy.startDate > TODAY) {
    return { label: 'Scheduled', tone: 'info' };
  }
  return { label: 'Active', tone: 'success' };
}
export const canToggleStatus = (policy, db) => !!(policy && policyUsageCount(policy, db) > 0);

// ── Usage (derived from assignments, never stored) ───────────────────────────
export function policyUsageDetail(policy, db) {
  const id = policy && policy.id;
  if (!id) return { companies: 0, locations: 0, tags: 0, customers: 0, globals: [], count: 0 };
  let companies = 0;
  let locations = 0;
  const holds = (holder) => KIND_ORDER.some((k) => slotIds(holder, k).includes(id));
  (db.companies || []).forEach((c) => {
    if (holds(c)) companies += 1;
    (c.locations || []).forEach((l) => {
      if (holds(l)) locations += 1;
    });
  });
  const tags = (db.tagPricing || []).filter((t) => t.defaultPolicyId === id).length;
  const customers = (db.customers || []).filter((cu) => cu.policyId === id).length;
  const globals = [];
  if (db.defaults && db.defaults.b2bPolicyId === id) globals.push('All Companies');
  if (db.defaults && db.defaults.wholesalePolicyId === id) globals.push('All customers');
  return { companies, locations, tags, customers, globals, count: companies + locations + tags + customers + globals.length };
}
export function policyUsageCount(policy, db) {
  return policyUsageDetail(policy, db).count;
}
// "Assigned to" summary string for the Pricing library / cards.
export function policyUsage(policy, db) {
  const u = policyUsageDetail(policy, db);
  if (!u.count) return 'Not assigned';
  const parts = [];
  if (u.companies) parts.push(`${u.companies} Compan${u.companies === 1 ? 'y' : 'ies'}`);
  if (u.locations) parts.push(`${u.locations} Location${u.locations === 1 ? '' : 's'}`);
  if (u.tags) parts.push(`${u.tags} tag${u.tags === 1 ? '' : 's'}`);
  if (u.customers) parts.push(`${u.customers} customer${u.customers === 1 ? '' : 's'}`);
  u.globals.forEach((g) => parts.push(g));
  return parts.join(' · ');
}

// ── Conditional-rule label helpers (pricing editor UI) ───────────────────────

export const RULE_FIELDS = [
  { field: 'all', label: 'All products' },
  { field: 'collection', label: 'Collection' },
  { field: 'vendor', label: 'Vendor' },
  { field: 'tag', label: 'Product tag' },
  { field: 'productType', label: 'Product type' },
];

const RULE_FIELD_LABEL = {
  all: 'All products',
  collection: 'Collection',
  vendor: 'Vendor',
  tag: 'Product tag',
  productType: 'Product type',
};

export function ruleField(rule) {
  return rule?.conditions?.[0]?.field || 'all';
}
export function ruleValues(rule) {
  return rule?.conditions?.[0]?.values || [];
}
export function ruleTypeLabel(rule) {
  return RULE_FIELD_LABEL[ruleField(rule)] || 'Rule';
}
export function ruleValuesSummary(rule) {
  if (ruleField(rule) === 'all') return 'Every product';
  const v = ruleValues(rule);
  return v.length ? v.join(', ') : 'Nothing selected yet';
}

// Distinct value options for a condition field, sourced from the product catalog.
export function conditionValueOptions(field, products) {
  switch (field) {
    case 'collection':
      return Object.keys(COLLECTIONS);
    case 'vendor':
      return [...new Set(products.map((p) => p.vendor).filter(Boolean))];
    case 'productType':
      return [...new Set(products.map((p) => p.productType).filter(Boolean))];
    case 'tag':
      return [...new Set(products.flatMap((p) => p.tags || []))];
    default:
      return [];
  }
}

// Short "25% off" / "$5 off" / "Set $75" badge label for a collapsed rule row.
export function ruleAdjustmentLabel(rule) {
  if (!rule || rule.rule === 'keep' || !rule.value) return 'No change';
  if (rule.rule === 'set') {
    return rule.valueType === 'amount' ? `Set $${rule.value}` : `Set ${rule.value}%`;
  }
  const unit = rule.valueType === 'percentage' ? `${rule.value}%` : `$${rule.value}`;
  return rule.rule === 'increase' ? `+${unit}` : `${unit} off`;
}

// ── Settings summary: a base pricing's Products and Calculation lines ─────────
// Products: what it prices. With a default adjustment (pricingRule / value, set
// before rules existed) every product in its scope gets it: its scope ("All
// products", a collection…). Else from its rules and overrides: a rule on All
// products → "All products"; else the rules' collections / vendors / tags / types ("Collection:
// Summer" for one, "2 collections · 1 vendor" for more), plus the products with an
// override outside them ("+ 3 products"; an override is per variant, counted by
// product). Overrides only: "3 products". Nothing yet: "None".
const RULE_FIELD_NOUN = {
  collection: ['collection', 'collections'],
  vendor: ['vendor', 'vendors'],
  tag: ['product tag', 'product tags'],
  productType: ['product type', 'product types'],
};
// The default adjustment every product in a base pricing's scope gets (rules and
// overrides win over it), or null.
const defaultAdjustment = (p) =>
  p?.pricingRule && p.pricingRule !== 'keep' && Number(p.value) ? { rule: p.pricingRule, valueType: p.valueType, value: p.value } : null;
export function basePricingProductsLabel(policy, products = []) {
  const rules = policy?.conditionalRules || [];
  if (defaultAdjustment(policy)) return scopeLabel(policy);
  if (rules.some((r) => ruleField(r) === 'all')) return 'All products';
  const values = {};
  rules.forEach((r) =>
    (r.conditions || []).forEach((c) => {
      if (c.field === 'all') return;
      condValues(c).forEach((v) => {
        values[c.field] = values[c.field] || new Set();
        values[c.field].add(v);
      });
    }),
  );
  const fields = RULE_FIELDS.map((f) => f.field).filter((f) => values[f]);
  const total = fields.reduce((n, f) => n + values[f].size, 0);
  let ruleText = '';
  if (total === 1) ruleText = `${RULE_FIELD_LABEL[fields[0]]}: ${[...values[fields[0]]][0]}`;
  else if (total > 1) {
    ruleText = fields
      .map((f) => {
        const n = values[f].size;
        const [one, many] = RULE_FIELD_NOUN[f] || ['value', 'values'];
        return `${n} ${n === 1 ? one : many}`;
      })
      .join(' · ');
  }
  const overridden = overriddenProducts(policy, products);
  const extra = overridden.filter((p) => !rules.some((r) => ruleMatches(r, p))).length;
  const nProducts = (n) => `${n} product${n === 1 ? '' : 's'}`;
  if (ruleText && extra) return `${ruleText} + ${nProducts(extra)}`;
  if (ruleText) return ruleText;
  if (extra) return nProducts(extra);
  return 'None';
}

// Calculation: how the price changes, in the order things win last: the default
// adjustment ("12% off Shopify price"), the rules — one: "10% off Shopify price"
// (or "1 rule · 10% off" after a default); more: "3 rules · 10–20% off" (the range
// when every rule takes the same kind of amount off) — then overrides, which win
// over both: "… · 3 overrides", counted by product as Products counts them (a
// product's variants count once). Nothing yet: "Shopify price (no change)".
const adjustmentText = (r) => {
  if (!r || r.rule === 'keep' || !r.value) return 'Shopify price (no change)';
  const amount = r.valueType === 'amount';
  const unit = amount ? `$${r.value}` : `${r.value}%`;
  if (r.rule === 'set') return `Set to ${unit}`;
  return r.rule === 'increase' ? `${unit} over Shopify price` : `${unit} off Shopify price`;
};
// The products with an override (a product with several overridden variants once).
const overriddenProducts = (policy, products) => {
  const adj = policy?.variantAdjustments || {};
  return Object.keys(adj).length ? products.filter((p) => productVariants(p).some((v) => adj[v.id])) : [];
};
export function basePricingCalculationLabel(policy, products = []) {
  const rules = policy?.conditionalRules || [];
  const n = overriddenProducts(policy, products).length;
  const d = defaultAdjustment(policy);
  let ruleText = '';
  if (rules.length === 1) ruleText = d ? `1 rule · ${ruleAdjustmentLabel(rules[0])}` : adjustmentText(rules[0]);
  else if (rules.length > 1) {
    const off = (r) => r.value && !['set', 'increase', 'keep'].includes(r.rule);
    const amount = rules[0]?.valueType === 'amount';
    let range = '';
    if (rules.every((r) => off(r) && (r.valueType === 'amount') === amount)) {
      const vals = rules.map((r) => Number(r.value));
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const fmt = (v) => (amount ? `$${v}` : `${v}%`);
      range = lo === hi ? `${fmt(lo)} off` : amount ? `$${lo}–$${hi} off` : `${lo}–${hi}% off`;
    }
    ruleText = [`${rules.length} rules`, range].filter(Boolean).join(' · ');
  }
  const parts = [d ? adjustmentText(d) : '', ruleText, n ? `${n} override${n === 1 ? '' : 's'}` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Shopify price (no change)';
}

// What a base pricing is made of, as the editor's Settings summary says it:
// "2 rules · 3 overrides", or "No rules".
export function calculationLabel(policy) {
  const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const rules = (policy.conditionalRules || []).length;
  const overrides = Object.keys(policy.variantAdjustments || {}).length;
  return [rules ? count(rules, 'rule') : null, overrides ? count(overrides, 'override') : null].filter(Boolean).join(' · ') || 'No rules';
}

// The segment of products a quantity pricing covers, as its editor names the
// choice — not the collections, products or tags themselves.
export const scopeTypeLabel = (policy) => {
  if (!policy) return '';
  switch (policy.scopeType) {
    case 'all':
      return 'All products';
    case 'collection':
      return 'Specific collections';
    case 'products':
      return 'Specific products';
    case 'tags':
      return 'Product tags';
    default:
      return '';
  }
};
