// Pricing helpers ported from the B2B god file (spec §5.1, §5.3, §8).
import { COLLECTIONS } from './data/constants.js';

export function policyById(policies, id) {
  return policies.find((p) => p.id === id) || null;
}

// A company's base pricing entries, sorted by priority (lower applies first),
// tie-broken by insertion order; dangling policy ids dropped. Legacy scalar
// `pricing.base:'p1'` is normalized to a single entry.
export function companyBaseEntries(company, policies) {
  let base = company?.pricing?.base;
  if (!base) return [];
  if (typeof base === 'string') base = [{ id: base, priority: 1 }];
  return base
    .map((e, idx) => ({ ...e, idx, policy: policyById(policies, e.id) }))
    .filter((e) => e.policy)
    .sort((a, b) => a.priority - b.priority || a.idx - b.idx);
}

export function companyQuantityPolicy(company, policies) {
  const q = company?.pricing?.quantity;
  return q ? policyById(policies, q) : null;
}

// Effective status → Polaris Badge {label, tone}. Considers dated validity.
export function policyStatus(policy) {
  if (!policy) return { label: '—', tone: undefined };
  if (policy.status === 'Inactive') return { label: 'Inactive', tone: undefined };
  if (policy.validityType === 'dated' && policy.startDate) {
    // Compare on plain YYYY-MM-DD strings (no Date needed for lexical order).
    const today = '2026-08-28';
    if (policy.startDate > today) return { label: 'Scheduled', tone: 'attention' };
    if (policy.endDate && policy.endDate < today) return { label: 'Expired', tone: undefined };
  }
  if (policy.status === 'Scheduled') return { label: 'Scheduled', tone: 'attention' };
  return { label: 'Active', tone: 'success' };
}

// Company pricing-readiness for the Companies list badge.
export function companyPricingStatus(company, policies) {
  const hasBase = companyBaseEntries(company, policies).length > 0;
  return hasBase
    ? { label: 'Price ready', tone: 'success' }
    : { label: 'Needs a price', tone: 'attention' };
}

// ----- Conditional-rule helpers (pricing editor, spec §5.3) -----

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

export function productMatchesRule(rule, product) {
  const c = rule?.conditions?.[0] || {};
  if (c.field === 'all') return true;
  const vals = c.values || [];
  if (!vals.length) return false;
  switch (c.field) {
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

export function ruleMatchCount(rule, products) {
  return products.filter((p) => productMatchesRule(rule, p)).length;
}

// Apply a rule/adjustment ({rule,valueType,value}) to a Shopify list price.
function applyAdjustment(a, list) {
  if (!a || a.rule === 'keep') return list;
  if (a.rule === 'set') return a.value;
  const amount = a.valueType === 'percentage' ? (list * a.value) / 100 : a.value;
  return a.rule === 'increase' ? list + amount : Math.max(0, list - amount);
}

// Resolve the B2B price a buyer at this company would pay for a product:
// walk the company's base policies (priority order); an explicit product
// override wins, else the first matching conditional rule, else Shopify price.
export function resolvedPriceFor(company, product, policies) {
  const entries = companyBaseEntries(company, policies);
  for (const e of entries) {
    const p = e.policy;
    const adj = p.productAdjustments?.[product.sku];
    if (adj) return applyAdjustment(adj, product.list);
    for (const rule of p.conditionalRules || []) {
      if (productMatchesRule(rule, product)) return applyAdjustment(rule, product.list);
    }
  }
  return product.list;
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

// Who a policy is assigned to, for the Pricing library "Assigned to" column.
export function policyUsage(policy, db) {
  let companies = 0;
  let customers = 0;
  (db.companies || []).forEach((c) => {
    const base = c.pricing?.base;
    const baseIds = Array.isArray(base) ? base.map((e) => e.id) : base ? [base] : [];
    if (baseIds.includes(policy.id) || c.pricing?.quantity === policy.id) companies += 1;
  });
  (db.customers || []).forEach((cu) => {
    if (cu.policyId === policy.id) customers += 1;
  });
  (db.tagPricing || []).forEach((t) => {
    if (t.defaultPolicyId === policy.id) customers += 1;
  });
  const parts = [];
  if (companies) parts.push(`${companies} compan${companies === 1 ? 'y' : 'ies'}`);
  if (customers) parts.push(`${customers} customer${customers === 1 ? '' : 's'}`);
  return parts.join(', ') || 'Not assigned';
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
