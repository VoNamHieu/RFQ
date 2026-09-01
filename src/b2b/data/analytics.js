// Analytics demo data streams ported verbatim from rfq-x-b2b/b2b/index.html
// (the legacy "god file" seed at lines ~1636-1680). These records do not exist
// in the Shopify orders themselves; they let the analytics screen show the full
// intended information model: order line-items, blocked demand, internal
// approvals, company activation and pricing changes.

// Order line-items keyed by order id. renderAnalytics attaches these to each
// completed order via `items: analyticsOrderItems[o.id] || []`.
export const analyticsOrderItems = {
  '#1044': [{ sku: 'FIL-XL', qty: 40, revenue: 3100 }, { sku: 'VLV-40', qty: 60, revenue: 2760 }],
  '#1039': [{ sku: 'FIL-XL', qty: 40, revenue: 2900 }, { sku: 'FIL-STD', qty: 40, revenue: 1900 }, { sku: 'SEA-30', qty: 200, revenue: 1320 }],
  '#1028': [{ sku: 'HOS-12', qty: 20, revenue: 2380 }, { sku: 'VLV-40', qty: 30, revenue: 1200 }, { sku: 'SEA-30', qty: 100, revenue: 800 }],
  '#1017': [{ sku: 'FIL-XL', qty: 40, revenue: 3000 }, { sku: 'FIL-STD', qty: 40, revenue: 1800 }, { sku: 'HOS-12', qty: 11, revenue: 1475 }, { sku: 'SEA-30', qty: 150, revenue: 1000 }],
  '#1041': [{ sku: 'VLV-40', qty: 40, revenue: 1560 }],
  '#1033': [{ sku: 'HOS-12', qty: 30, revenue: 3600 }, { sku: 'FIL-STD', qty: 60, revenue: 2820 }, { sku: 'SEA-30', qty: 400, revenue: 2500 }],
  '#1021': [{ sku: 'FIL-STD', qty: 25, revenue: 1200 }, { sku: 'SEA-30', qty: 150, revenue: 940 }, { sku: 'VLV-40', qty: 20, revenue: 800 }],
};

// Open order value held by the internal approval workflow.
export const analyticsApprovalQueue = [
  { id: '#1045', companyId: 'c1', company: 'ABC Construction', location: 'Hanoi', value: 12400, requestedAt: '2026-08-23T10:15:00', approver: 'Vo Nam Hieu' },
  { id: '#1052', companyId: 'c2', company: 'Vinh Phat Trading', location: 'Da Nang', value: 21800, requestedAt: '2026-08-21T13:30:00', approver: 'Vo Nam Hieu' },
  { id: '#1054', companyId: 'c4', company: 'Song Hong Interiors', location: 'Hanoi', value: 7600, requestedAt: '2026-08-22T07:40:00', approver: 'Vo Nam Hieu' },
];

// Company application progression from registration to approval and first order.
export const analyticsCompanyActivation = [
  { id: 'a1', companyId: 'c1', name: 'ABC Construction', registered: '2026-05-02', approved: '2026-05-03', firstOrder: '2026-05-19' },
  { id: 'a2', companyId: 'c2', name: 'Vinh Phat Trading', registered: '2026-05-24', approved: '2026-05-25', firstOrder: '2026-06-03' },
  { id: 'a3', companyId: 'c4', name: 'Song Hong Interiors', registered: '2026-06-11', approved: '2026-06-12', firstOrder: '2026-06-22' },
  { id: 'a4', companyId: 'c3', name: 'Delta Mechanical', registered: '2026-07-16', approved: '2026-07-18', firstOrder: null },
  { id: 'a5', companyId: null, name: 'North Hub Retail', registered: '2026-08-22', approved: null, firstOrder: null },
  { id: 'a6', companyId: null, name: 'Thanh Tools', registered: '2026-08-18', approved: '2026-08-19', firstOrder: null },
];

// MOQ-blocked demand and quantity-tier observations around the pricing rules.
export const analyticsQuantityEvents = [
  { type: 'moq_blocked', date: '2026-08-10', companyId: 'c1', location: 'Hanoi', buyer: 'John Nguyen', sku: 'VLV-40', qty: 8, threshold: 10, attemptedValue: 416, laterCompleted: true },
  { type: 'moq_blocked', date: '2026-08-12', companyId: 'c1', location: 'Bac Ninh site', buyer: 'Pham Duc', sku: 'FIL-XL', qty: 7, threshold: 10, attemptedValue: 672, laterCompleted: false },
  { type: 'moq_blocked', date: '2026-08-15', companyId: 'c2', location: 'Da Nang', buyer: 'Bui Quang', sku: 'HOS-12', qty: 4, threshold: 5, attemptedValue: 580, laterCompleted: true },
  { type: 'moq_blocked', date: '2026-08-17', companyId: 'c4', location: 'Hanoi', buyer: 'Do Lan', sku: 'FIL-STD', qty: 8, threshold: 10, attemptedValue: 496, laterCompleted: false },
  { type: 'tier_observed', date: '2026-07-14', companyId: 'c1', location: 'Hanoi', policy: 'Pallet Breaks', qty: 8, threshold: 10, orderValue: 620, reached: false, near: true, realizedDiscount: 0 },
  { type: 'tier_observed', date: '2026-07-21', companyId: 'c1', location: 'Hanoi', policy: 'Pallet Breaks', qty: 10, threshold: 10, orderValue: 910, reached: true, near: false, realizedDiscount: 10 },
  { type: 'tier_observed', date: '2026-07-28', companyId: 'c2', location: 'Da Nang', policy: 'Pallet Breaks', qty: 9, threshold: 10, orderValue: 780, reached: false, near: true, realizedDiscount: 0 },
  { type: 'tier_observed', date: '2026-08-03', companyId: 'c2', location: 'Da Nang', policy: 'Pallet Breaks', qty: 14, threshold: 10, orderValue: 1260, reached: true, near: false, realizedDiscount: 10 },
  { type: 'tier_observed', date: '2026-08-09', companyId: 'c4', location: 'Hanoi', policy: 'Filter Case Pricing', qty: 10, threshold: 12, orderValue: 860, reached: false, near: true, realizedDiscount: 0 },
  { type: 'tier_observed', date: '2026-08-13', companyId: 'c1', location: 'Bac Ninh site', policy: 'Filter Case Pricing', qty: 12, threshold: 12, orderValue: 1120, reached: true, near: false, realizedDiscount: 15 },
];

// Observed commercial metrics before and after a pricing-rule edit.
export const analyticsPricingChanges = [
  { date: '2026-07-02', companyId: 'c1', scope: 'ABC Construction · Hanoi', rule: 'FIL-XL negotiated price', change: '$72 → $75', before: { sales: 16800, aov: 5600, priceDelta: -25.0 }, after: { sales: 18420, aov: 6140, priceDelta: -21.9 } },
  { date: '2026-07-17', companyId: 'c2', scope: 'Vinh Phat Trading', rule: 'Distributor Tier 2', change: '20% → 25% off', before: { sales: 8920, aov: 4460, priceDelta: -20.0 }, after: { sales: 10480, aov: 5240, priceDelta: -25.0 } },
];
