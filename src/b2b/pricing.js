// Pricing engine — ported to full parity with the B2B god file (b2b/index.html
// §1809-2503, §4455). Resolution walks a company's Active, in-date base pricings
// in priority order (a scoped base that does not cover a product falls through to
// the next), then the quantity slot; the first price wins. Status, usage and a
// company's "needs a price" are all DERIVED from the data, never stored.
import { COLLECTIONS } from './data/constants.js';

// Demo "today" anchor for dated validity (legacy TODAY = new Date('2026-07-28')).
// Dates are plain YYYY-MM-DD, so lexical string comparison matches Date order.
const TODAY = '2026-07-28';

export const KIND_ORDER = ['base', 'quantity'];
export const kindOf = (p) => (p?.priceKind === 'quantity' ? 'quantity' : 'base');
// Generic "usable" gate — a policy that is not turned off (any kind).
const activePolicy = (p) => (p && p.status !== 'Inactive' ? p : null);

export function policyById(policies, id) {
  return (policies || []).find((p) => p.id === id) || null;
}

// ── Company base list (resolution order) ─────────────────────────────────────
// Priority is a property of the PROFILE (its "Priority 0-99" field), not a
// per-company number: lower applies first. On a tie a SCOPED base (covers only
// some SKUs — e.g. a quote pricing) beats an all-products base, then insertion
// order. Dangling ids dropped; legacy scalar base normalized to a one-item list.
export function companyBaseEntries(company, policies) {
  let base = company?.pricing?.base;
  if (!base) return [];
  if (typeof base === 'string') base = [{ id: base, priority: 1 }];
  const spec = (id) => {
    const st = policyById(policies, id)?.scopeType;
    return st && st !== 'all' ? 0 : 1;
  };
  return base
    .map((e, idx) => {
      const id = (e && e.id) || e;
      const policy = policyById(policies, id);
      return { id, idx, priority: Number(policy?.priority) || 0, policy };
    })
    .filter((e) => e.policy)
    .sort((a, b) => a.priority - b.priority || spec(a.id) - spec(b.id) || a.idx - b.idx);
}

// Usable for resolution right now: not Inactive, and inside its dated window if
// it has one. Scheduled/expired bases step aside so the next priority applies.
export function basePriceableNow(policy) {
  if (!policy || policy.status === 'Inactive') return false;
  if (policy.validityType === 'dated') {
    if (policy.startDate && policy.startDate > TODAY) return false;
    if (policy.endDate && policy.endDate < TODAY) return false;
  }
  return true;
}
export function companyActiveBasePolicies(company, policies) {
  return companyBaseEntries(company, policies)
    .map((e) => e.policy)
    .filter(basePriceableNow);
}

export function companyQuantityPolicy(company, policies) {
  const q = company?.pricing?.quantity;
  return q ? policyById(policies, q) : null;
}

// ── Scope + rule matching ────────────────────────────────────────────────────
const explicitOn = (p) => !!(p && Object.keys(p.productAdjustments || {}).length);

// A base only prices products in its scope (all | collection | products); a
// product outside that scope falls through to the NEXT base by priority.
export function baseInScope(base, sku) {
  if (!base) return false;
  const st = base.scopeType;
  if (!st || st === 'all') return true;
  if (st === 'collection') return (COLLECTIONS[base.collection] || []).includes(sku);
  if (st === 'products') return (base.selectedProducts || []).includes(sku);
  return true;
}
// Whether a profile prices a SKU at all (a base always does; quantity honors its
// own product scope). Base pricing narrowing is handled by baseInScope above.
function inScope(profile, sku) {
  if (!profile) return false;
  if (kindOf(profile) === 'base') return true;
  if (profile.scopeType === 'all') return true;
  return (profile.selectedProducts || []).includes(sku);
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

// Apply an adjustment to a base price. Rounds to 2dp; a decrease may go negative
// (legacy allows it so save-time validation can flag "below cost / above list").
export function applyAdjustment(rule, valueType, value, base) {
  const round = (x) => Math.round(x * 100) / 100;
  const val = Number(value ?? 0);
  if (rule === 'keep') return base;
  if (rule === 'set') return round(val);
  if (rule === 'decrease') return round(valueType === 'percentage' ? base * (1 - val / 100) : base - val);
  if (rule === 'increase') return round(valueType === 'percentage' ? base * (1 + val / 100) : base + val);
  return base;
}

// The price + which layer decided it, for one profile (null if out of scope):
// Product override → Conditional rule → profile-level default.
function priceForDetail(profile, product) {
  if (!inScope(profile, product.sku)) return null;
  const base = product.list;
  const adj = explicitOn(profile) ? (profile.productAdjustments || {})[product.sku] : null;
  if (adj && adj.rule) {
    return { price: applyAdjustment(adj.rule, adj.valueType || 'percentage', adj.value, base), layer: 'override', decidedBy: `${profile.name} · override` };
  }
  const ri = matchConditionalRuleIndex(profile, product);
  if (ri >= 0) {
    const r = profile.conditionalRules[ri];
    return { price: applyAdjustment(r.rule, r.valueType || 'percentage', r.value, base), layer: 'rule', decidedBy: `${profile.name} · Rule ${ri + 1}` };
  }
  return { price: applyAdjustment(profile.pricingRule, profile.valueType, profile.value, base), layer: 'base', decidedBy: `${profile.name} · Default price` };
}

// Single-profile price breakdown for the editor's "How the price resolves"
// preview: the Shopify price, the profile's default adjustment, a matching
// conditional rule, an explicit override, and what the buyer pays — same
// precedence as priceForDetail (override → rule → default).
export function policyPriceBreakdown(profile, product) {
  if (!profile || !product) return null;
  const base = product.list;
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
  const adj = explicitOn(profile) ? (profile.productAdjustments || {})[product.sku] : null;
  const override = adj && adj.rule ? applyAdjustment(adj.rule, adj.valueType || 'percentage', adj.value, base) : null;
  const final = override != null ? override : rule ? rule.price : defaultPrice;
  return { shopify: base, defaultPrice, rule, override, final, inScope: inScope(profile, product.sku) };
}

// Resolve the B2B price a company pays for a product (legacy resolvedPriceFor):
// the first in-scope Active base wins (a scope-all base is authoritative and
// returns the Shopify price when nothing matches); else the quantity slot; else
// null → the caller shows "No pricing".
function resolveProductDetail(company, product, policies) {
  for (const p of companyActiveBasePolicies(company, policies)) {
    if (!baseInScope(p, product.sku)) continue;
    const r = priceForDetail(p, product);
    if (r) return r;
  }
  const q = companyQuantityPolicy(company, policies);
  if (q && q.status !== 'Inactive') {
    const r = priceForDetail(q, product);
    if (r) return r;
  }
  return null;
}
export function resolvedPriceFor(company, product, policies) {
  const r = resolveProductDetail(company, product, policies);
  return r ? r.price : null;
}
// Like resolvedPriceFor, but reports which layer decided the price; the Price
// Board falls back to the Shopify price row when nothing is assigned.
export function resolveDetail(company, product, policies) {
  return resolveProductDetail(company, product, policies) || { price: product.list, decidedBy: 'Shopify price', layer: 'shopify' };
}

// ── Company-level resolution (source / status / needs-a-price) ───────────────
// Location override (single) replaces the whole company base list; else the
// company's Active bases + quantity; else the store-wide All-Companies default.
export function resolvePricing(company, location, policies, defaults) {
  const locPricing = (location && location.pricing) || {};
  const locBase = activePolicy(policyById(policies, locPricing.base));
  const basePolicies = locBase ? [locBase] : companyActiveBasePolicies(company, policies);
  const qty = activePolicy(policyById(policies, locPricing.quantity)) || activePolicy(companyQuantityPolicy(company, policies));
  const profiles = [...basePolicies, ...(qty ? [qty] : [])];
  if (profiles.length) return { profiles, profile: profiles[0] };
  const def = activePolicy(policyById(policies, defaults && defaults.b2bPolicyId));
  if (def) return { profiles: [def], profile: def };
  return { profiles: [], profile: null };
}

// Per-kind resolved pricing for a Location: a single Location override replaces
// the whole inherited base list; otherwise the company's Active bases (priority
// order). Quantity keeps its single Location→Company slot. Used by the location
// pricing card to show name + source (override vs inherited).
export function locationPricingEntries(company, location, policies) {
  const locPricing = (location && location.pricing) || {};
  const locBase = activePolicy(policyById(policies, locPricing.base));
  const bases = locBase
    ? [{ policy: locBase, source: 'LOCATION' }]
    : companyActiveBasePolicies(company, policies).map((p) => ({ policy: p, source: 'COMPANY' }));
  const locQty = activePolicy(policyById(policies, locPricing.quantity));
  const compQty = activePolicy(companyQuantityPolicy(company, policies));
  const quantity = locQty ? { policy: locQty, source: 'LOCATION' } : compQty ? { policy: compQty, source: 'COMPANY' } : null;
  return { bases, quantity };
}

// Products-column label for a policy (base defaults to all; quantity to products).
export const scopeLabel = (p) => {
  if (!p) return 'None';
  const st = p.scopeType || (kindOf(p) === 'base' ? 'all' : 'products');
  if (st === 'all') return 'All products';
  if (st === 'collection') return p.collection || 'Collection';
  return `${(p.selectedProducts || []).length} selected products`;
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
  if (policy.validityType === 'dated' && policy.startDate && policy.startDate > TODAY) {
    return { label: 'Scheduled', tone: 'info' };
  }
  return { label: 'Active', tone: 'success' };
}
export const canToggleStatus = (policy, db) => !!(policy && policyUsageCount(policy, db) > 0);

// ── Usage (derived from assignments, never stored) ───────────────────────────
function policyUsageDetail(policy, db) {
  const id = policy && policy.id;
  if (!id) return { companies: 0, locations: 0, tags: 0, customers: 0, globals: [], count: 0 };
  let companies = 0;
  let locations = 0;
  (db.companies || []).forEach((c) => {
    const base = c.pricing && c.pricing.base;
    const ids = Array.isArray(base) ? base.map((e) => e.id) : base ? [base] : [];
    if (ids.includes(id) || (c.pricing && c.pricing.quantity === id)) companies += 1;
    (c.locations || []).forEach((l) => {
      if (KIND_ORDER.some((k) => (l.pricing || {})[k] === id)) locations += 1;
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

export const scopeTypeLabel = (policy) => {
  if (!policy) return '';
  switch (policy.scopeType) {
    case 'all':
      return 'All products';
    case 'collection':
      return policy.collection || 'Collection';
    case 'products':
      return `${(policy.selectedProducts || []).length} products`;
    case 'tags':
      return 'Tagged products';
    default:
      return '';
  }
};
