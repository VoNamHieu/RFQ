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
