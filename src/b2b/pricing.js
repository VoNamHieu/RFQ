// Pricing helpers ported from the B2B god file (spec §5.1, §8).

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
