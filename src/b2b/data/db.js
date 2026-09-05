// Raw demo seed extracted verbatim from rfq-x-b2b/b2b/index.html.
// Do NOT apply normalize/migrate transforms here — the store applies those.

const defaults = { b2bPolicyId: null, wholesalePolicyId: null };

// Each product carries its variants. The FIRST variant is the default and its
// id equals the product SKU, so per-SKU pricing (seed overrides, RFQ→B2B sync)
// keeps resolving to the default variant unchanged; extra variants get new ids.
const products = [
  { sku: 'FIL-XL', title: 'Industrial filter, XL', list: 96, stock: 840, vendor: 'FilterCo', productType: 'Filters', tags: ['industrial'],
    variants: [{ id: 'FIL-XL', title: 'Standard', list: 96 }, { id: 'FIL-XL-HD', title: 'Heavy-duty', list: 118 }] },
  { sku: 'FIL-STD', title: 'Industrial filter, standard', list: 62, stock: 1200, vendor: 'FilterCo', productType: 'Filters', tags: ['industrial', 'clearance'],
    variants: [{ id: 'FIL-STD', title: 'Standard', list: 62 }] },
  { sku: 'SEA-30', title: 'Sealant cartridge 300ml', list: 8, stock: 2600, vendor: 'SealPro', productType: 'Sealants', tags: ['consumable'],
    variants: [{ id: 'SEA-30', title: '300 ml', list: 8 }] },
  { sku: 'HOS-12', title: 'Reinforced hose, 12m', list: 145, stock: 210, vendor: 'HydroMax', productType: 'Hoses', tags: ['industrial', 'premium'],
    variants: [{ id: 'HOS-12', title: '12 m', list: 145 }, { id: 'HOS-12-18M', title: '18 m', list: 205 }, { id: 'HOS-12-24M', title: '24 m', list: 265 }] },
  { sku: 'VLV-40', title: 'Ball valve 40mm', list: 52, stock: 670, vendor: 'HydroMax', productType: 'Valves', tags: ['premium', 'clearance'],
    variants: [{ id: 'VLV-40', title: '40 mm', list: 52 }] },
  { sku: 'MCFC-TRAINING-JACKET', title: 'Manchester City Team Training Jacket', list: 1240, stock: 120, vendor: 'MCFC', productType: 'Apparel', tags: ['licensed'],
    variants: [{ id: 'MCFC-TRAINING-JACKET', title: 'M', list: 1240 }, { id: 'MCFC-JACKET-L', title: 'L', list: 1240 }, { id: 'MCFC-JACKET-XL', title: 'XL', list: 1290 }] }
];

const companies = [
  {
    id: 'c1', name: 'ABC Construction', mainContact: 'John Nguyen', source: 'QuoteSnap RFQ',
    pricing: { base: [{ id: 'p1', priority: 1 }, { id: 'p30', priority: 5 }, { id: 'p8', priority: 2 }, { id: 'p20', priority: 3 }, { id: 'p21', priority: 4 }, { id: 'p22', priority: 5 }, { id: 'p23', priority: 6 }, { id: 'p24', priority: 7 }, { id: 'p25', priority: 8 }, { id: 'p26', priority: 9 }, { id: 'p27', priority: 10 }, { id: 'p28', priority: 11 }, { id: 'p29', priority: 12 }], quantity: 'p6' }, revenue: 124000,
    locations: [
      { id: 'l1', name: 'Hanoi', ordering: 'Buys directly', terms: 'Net 30', lastOrder: '2026-07-15', buyers: 2 },
      { id: 'l2', name: 'Bac Ninh site', ordering: 'You approve first', terms: 'Due on receipt', lastOrder: '2026-06-28', buyers: 1 }
    ],
    contacts: [
      { name: 'John Nguyen', email: 'john@abcconstruction.com', role: 'Location admin', access: 'Buys directly', locations: 'Hanoi' },
      { name: 'Le Thu Ha', email: 'ha@abcconstruction.com', role: 'Ordering only', access: 'Buys directly', locations: 'Hanoi' },
      { name: 'Pham Duc', email: 'duc@abcconstruction.com', role: 'Ordering only', access: 'You approve first', locations: 'Bac Ninh site' }
    ],
    quotes: [
      { id: 'Q-1051', status: 'Negotiating', context: 'Special project pricing', updated: 'Jul 16' },
      { id: 'Q-0982', status: 'Accepted', context: '2026 annual terms', updated: 'Jan 3' }
    ],
    exceptions: [{ id: '#1045', reason: 'Above the $10,000 review threshold', location: 'Hanoi', amount: 12400, status: 'Needs review' }],
    activity: [
      { when: 'Jul 15', what: 'Order #1045 held for your review' },
      { when: 'Jul 12', what: 'ABC Hanoi Negotiated reapplied to Hanoi' },
      { when: 'Jul 02', what: 'FIL-XL price changed from $72 to $75' },
      { when: 'Jun 30', what: 'John Nguyen signed in from Hanoi' }
    ]
  },
  {
    id: 'c2', name: 'Vinh Phat Trading', mainContact: 'Bui Quang', source: 'Merchant created',
    pricing: { base: 'p1', quantity: null }, revenue: 86400,
    locations: [{ id: 'l3', name: 'Da Nang', ordering: 'Buys directly', terms: 'Net 15', lastOrder: '2026-07-11', buyers: 1 }],
    contacts: [{ name: 'Bui Quang', email: 'quang@vinhphat.vn', role: 'Location admin', access: 'Buys directly', locations: 'Da Nang' }],
    quotes: [], exceptions: [],
    activity: [
      { when: 'Jul 16', what: 'Distributor Tier 2 is scheduled to activate Jul 17' },
      { when: 'Jul 01', what: 'Location sync completed' }
    ]
  },
  {
    id: 'c3', name: 'Delta Mechanical', mainContact: 'Nguyen Hoa', source: 'ERP import',
    pricing: { base: null, quantity: null }, revenue: 0,
    locations: [{ id: 'l4', name: 'Ho Chi Minh City', ordering: 'Quote only', terms: 'Not set', lastOrder: null, buyers: 1 }],
    contacts: [{ name: 'Nguyen Hoa', email: 'hoa@deltamechanical.vn', role: 'Ordering only', access: 'Quote only', locations: 'Ho Chi Minh City' }],
    quotes: [], exceptions: [],
    activity: [
      { when: 'Jul 16', what: 'Imported from ERP and matched to a Shopify company' },
      { when: 'Jul 16', what: 'No price assigned, ordering is off' }
    ]
  },
  {
    id: 'c4', name: 'Song Hong Interiors', mainContact: 'Do Lan', source: 'Company application',
    pricing: { base: 'p1', quantity: null }, revenue: 41200,
    locations: [{ id: 'l5', name: 'Hanoi', ordering: 'Quote only', terms: 'Due on receipt', lastOrder: '2026-06-22', buyers: 1 }],
    contacts: [{ name: 'Do Lan', email: 'lan@songhong.vn', role: 'Location admin', access: 'Quote only', locations: 'Hanoi' }],
    quotes: [],
    exceptions: [{ id: '#1046', reason: 'The negotiated price expired and no other price applies', location: 'Hanoi', amount: 3184, status: 'Blocked' }],
    activity: [
      { when: 'Jul 14', what: 'Order #1046 blocked at checkout' },
      { when: 'Jul 01', what: 'AG-274 expired, negotiated price stopped applying' },
      { when: 'Jul 01', what: 'Ordering switched to quote only; the account stays active' }
    ]
  }
];

const tagPricing = [
  { id: 'retailer', name: 'retailer', defaultPolicyId: 'p3' },
  { id: 'trade', name: 'trade', defaultPolicyId: 'p2' }
];

const customers = [
  { id: 'w1', name: 'Lan Anh Home', email: 'purchasing@lananhhome.vn', status: 'Active', source: 'Wholesale application', tags: ['retailer'], policyId: null, lastOrder: '2026-07-13', orders: 8 },
  { id: 'w2', name: 'Minh Decor Studio', email: 'buy@minhdecor.vn', status: 'Active', source: 'Merchant created', tags: ['trade'], policyId: 'p4', lastOrder: '2026-07-09', orders: 13 },
  { id: 'w3', name: 'Thanh Tools', email: 'hello@thanhtools.vn', status: 'Qualified', source: 'Wholesale application', tags: ['applicant'], policyId: null, lastOrder: null, orders: 0 },
  { id: 'w4', name: 'An Nam Retail', email: 'orders@annamretail.vn', status: 'Active', source: 'CSV import', tags: ['retailer', 'trade'], policyId: null, lastOrder: '2026-07-15', orders: 21 },
  { id: 'w5', name: 'Bui Quang', email: 'quang@vinhphat.vn', status: 'Active', source: 'Shopify sync', tags: [], policyId: null, lastOrder: '2026-07-11', orders: 4 },
  { id: 'w6', name: 'Hoa Sen Interiors', email: 'mua@hoasen.vn', status: 'Active', source: 'Shopify sync', tags: [], policyId: null, lastOrder: '2026-07-02', orders: 6 },
  { id: 'w7', name: 'Bao Long Trading', email: 'sales@baolong.vn', status: 'Active', source: 'Shopify sync', tags: [], policyId: null, lastOrder: '2026-06-30', orders: 2 },
  { id: 'w8', name: 'Nam Phuong Design', email: 'hello@namphuong.vn', status: 'Active', source: 'Shopify sync', tags: [], policyId: null, lastOrder: null, orders: 0 }
];

const policies = [
  { id: 'p20', name: 'Volume Tier A', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 3, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 12, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p21', name: 'Volume Tier B', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 4, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 15, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p22', name: 'Volume Tier C', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 5, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 18, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p23', name: 'Contractor Bulk', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 6, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 20, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p24', name: 'Government Rate', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 7, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 10, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p25', name: 'Loyalty Base', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 8, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 8, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p26', name: 'Seasonal 2026', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 9, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 22, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p27', name: 'Fleet Discount', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 10, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 14, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p28', name: 'Clearance Base', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 11, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 30, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  { id: 'p29', name: 'New Year Promo', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 12, priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: [], pricingRule: 'decrease', valueType: 'percentage', value: 25, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  // Demo: an account-specific price pointed only at Ball valve 40mm (VLV-40). It
  // loses to the higher-priority Distributor Tier 2, so it surfaces under "Also
  // covers this product" in Preview price — the "why isn't my pricing applied?" case.
  { id: 'p30', name: 'VLV-40 Contract Price', type: 'Account-specific', status: 'Active', audienceType: 'b2b', priority: 5, priceKind: 'base', scopeType: 'products', collection: '', selectedProducts: ['VLV-40'], pricingRule: 'decrease', valueType: 'percentage', value: 20, variantAdjustments: {}, explicitEnabled: false, conditionalRules: [], validityType: 'evergreen', startDate: '', endDate: '' },
  {
    id: 'p1', name: 'Distributor Tier 2', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 1,
    priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: ['FIL-XL', 'FIL-STD', 'SEA-30', 'HOS-12', 'VLV-40'],
    pricingRule: 'decrease', valueType: 'percentage', value: 25, variantAdjustments: {}, explicitEnabled: false,
    conditionalRules: [
      { id: 'cr1', conditions: [{ field: 'collection', operator: 'is', values: ['Contractor assortment'] }], match: 'ALL', rule: 'decrease', valueType: 'percentage', value: 35 },
      { id: 'cr2', conditions: [{ field: 'tag', operator: 'contains', values: ['clearance'] }], match: 'ALL', rule: 'decrease', valueType: 'percentage', value: 30 },
      { id: 'cr3', conditions: [{ field: 'vendor', operator: 'is', values: ['HydroMax'] }], match: 'ALL', rule: 'decrease', valueType: 'percentage', value: 15 }
    ],
    validityType: 'evergreen', startDate: '', endDate: ''
  },
  {
    id: 'p2', name: 'Contractor Standard', type: 'Reusable', status: 'Active', audienceType: 'd2c',
    priceKind: 'base', scopeType: 'collection', collection: 'Contractor assortment', selectedProducts: ['FIL-XL', 'FIL-STD', 'SEA-30', 'HOS-12', 'VLV-40'],
    pricingRule: 'decrease', valueType: 'percentage', value: 20,
    variantAdjustments: { 'FIL-XL': { rule: 'set', valueType: 'amount', value: 75 }, 'SEA-30': { rule: 'set', valueType: 'amount', value: 6.5 } },
    explicitEnabled: true,
    validityType: 'evergreen', startDate: '', endDate: ''
  },
  {
    id: 'p3', name: 'Standard Wholesale', type: 'Reusable', status: 'Active', audienceType: 'd2c',
    priceKind: 'base', priority: 0, scopeType: 'collection', collection: 'Wholesale assortment', selectedProducts: ['FIL-XL', 'FIL-STD', 'SEA-30', 'HOS-12', 'VLV-40'],
    pricingRule: 'decrease', valueType: 'percentage', value: 20, variantAdjustments: {}, explicitEnabled: false,
    validityType: 'evergreen', startDate: '', endDate: ''
  },
  {
    id: 'p4', name: 'ABC Hanoi Negotiated', type: 'Account-specific', status: 'Active', audienceType: 'd2c',
    priceKind: 'base', scopeType: 'products', collection: '', selectedProducts: ['FIL-XL', 'FIL-STD', 'SEA-30', 'HOS-12', 'VLV-40'],
    pricingRule: 'keep', valueType: 'amount', value: 0,
    variantAdjustments: {
      'FIL-XL': { rule: 'set', valueType: 'amount', value: 75 }, 'FIL-STD': { rule: 'set', valueType: 'amount', value: 49 },
      'SEA-30': { rule: 'set', valueType: 'amount', value: 6.5 }, 'HOS-12': { rule: 'set', valueType: 'amount', value: 118 },
      'VLV-40': { rule: 'set', valueType: 'amount', value: 41 }
    },
    explicitEnabled: true,
    validityType: 'dated', startDate: '2026-01-01', endDate: '2026-12-31'
  },
  {
    id: 'p5', name: 'Riverside Project Pricing', type: 'Temporary', status: 'Scheduled', audienceType: 'b2b',
    priceKind: 'base', scopeType: 'products', collection: '', selectedProducts: ['HOS-12', 'VLV-40'],
    pricingRule: 'keep', valueType: 'amount', value: 0,
    variantAdjustments: { 'HOS-12': { rule: 'set', valueType: 'amount', value: 104 }, 'VLV-40': { rule: 'set', valueType: 'amount', value: 36 } },
    explicitEnabled: true,
    validityType: 'dated', startDate: '2026-08-01', endDate: '2026-10-31'
  },
  {
    id: 'p6', name: 'Pallet Breaks', type: 'Reusable', status: 'Active', audienceType: 'b2b',
    priceKind: 'quantity', priority: 0, scopeType: 'all', collection: 'All B2B products',
    selectedProducts: ['FIL-XL', 'FIL-STD', 'SEA-30', 'HOS-12', 'VLV-40'],
    pricingRule: 'decrease', valueType: 'percentage', value: 10, variantAdjustments: {},
    volumeRanges: [{ id: 'r1', from: 1, to: 9, valueType: 'percentage', value: 0 }, { id: 'r2', from: 10, to: 49, valueType: 'percentage', value: 10 }, { id: 'r3', from: 50, to: null, valueType: 'percentage', value: 20 }],
    quantityBasis: 'all_selected', volumeBasis: 'base',
    validityType: 'evergreen', startDate: '', endDate: ''
  },
  {
    id: 'p7', name: 'Filter Case Pricing', type: 'Reusable', status: 'Active', audienceType: 'b2b',
    priceKind: 'quantity', priority: 0, scopeType: 'products', collection: '',
    selectedProducts: ['FIL-XL', 'FIL-STD'],
    pricingRule: 'decrease', valueType: 'percentage', value: 15, variantAdjustments: {},
    volumeRanges: [{ id: 'r1', from: 1, to: 11, valueType: 'percentage', value: 0 }, { id: 'r2', from: 12, to: null, valueType: 'percentage', value: 15 }],
    quantityBasis: 'per_product', volumeBasis: 'shopify',
    validityType: 'evergreen', startDate: '', endDate: ''
  },
  {
    id: 'p8', name: 'Contract Base', type: 'Reusable', status: 'Active', audienceType: 'b2b', priority: 2,
    priceKind: 'base', scopeType: 'all', collection: 'All B2B products', selectedProducts: ['FIL-XL', 'FIL-STD', 'SEA-30', 'HOS-12', 'VLV-40'],
    pricingRule: 'decrease', valueType: 'percentage', value: 10, variantAdjustments: {}, explicitEnabled: false,
    conditionalRules: [],
    validityType: 'evergreen', startDate: '', endDate: ''
  }
];

const attention = [
  { sev: 'blocking', title: 'Order #1046 is blocked', meta: 'Song Hong Interiors · Hanoi · the negotiated price expired and nothing replaced it', cta: 'Fix pricing', company: 'c4' },
  { sev: 'blocking', title: 'Delta Mechanical has no price', meta: 'Imported from ERP · this company cannot order until you assign a price', cta: 'Assign price', company: 'c3' },
  { sev: 'blocking', title: 'Thanh Tools has no price', meta: 'Approved 6 days ago · tagged “applicant”, and that tag has no default price', cta: 'Assign price', customer: 'w3' },
  { sev: 'blocking', title: 'Quote Q-1042 needs a decision', meta: 'Highland Fitout · one-time order, or an ongoing price?', cta: 'Decide', modal: 'quote' },
  { sev: 'soon', title: 'ABC Hanoi terms expire in 168 days', meta: 'Renewal window opens before that', cta: 'Review', company: 'c1' },
  { sev: 'soon', title: 'Distributor Tier 2 activates tomorrow', meta: '18 locations · 5 active carts will be repriced', cta: 'Preview', policy: 'p1' },
  { sev: 'idea', title: 'Four quotes used the same product group', meta: 'A reusable price could replace repeated negotiation', cta: 'Look' },
  { sev: 'idea', title: 'Truong Son Depot is 12 days past its usual reorder', meta: 'Nothing is broken, just a signal', cta: 'Look' }
];

const requests = [
  { type: 'Company application', who: 'North Hub Retail', detail: 'Wants wholesale access · 3 locations', age: '2 days' },
  { type: 'Accepted quote', who: 'Highland Fitout', detail: 'Q-1042 · 38 products', age: '2 days' },
  { type: 'ERP import', who: '12 new companies', detail: 'Matched to Shopify · no price yet', age: '1 day' }
];

const health = [
  { name: 'Product mapping', detail: '2 archived products are still used by active prices', state: 'Action required', tone: 'critical' },
  { name: 'Shopify sync', detail: '43 companies · 51 locations · 6 minutes ago', state: 'Healthy', tone: 'success' },
  { name: 'Checkout validation', detail: 'Prices are re-checked server-side on every B2B cart', state: 'Healthy', tone: 'success' },
  { name: 'QuoteSnap connection', detail: 'Accepted quotes are arriving normally', state: 'Healthy', tone: 'success' }
];

const quotes = [
  {
    id: '1051074', company: 'c1', buyer: 'John Nguyen', email: 'john@abcconstruction.com', location: 'Hanoi',
    created: '2026-08-05 11:10:08', updated: '2026-08-05', leadScore: null,
    progress: 'Email Sent', status: 'Read', assignee: null, expires: null, source: 'RFQ form',
    note: 'Cần gấp cho công trường Bac Ninh, giao trước 15/8.',
    lines: [{ sku: 'FIL-XL', qty: 40, quoted: null }, { sku: 'HOS-12', qty: 12, quoted: null }],
    timeline: [{ when: 'Aug 5', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Aug 5', what: 'Email sent to the buyer' }]
  },
  {
    id: '1028991', company: 'c1', buyer: 'Le Thu Ha', email: 'ha@abcconstruction.com', location: 'Hanoi',
    created: '2026-07-14 15:53:51', updated: '2026-07-22', leadScore: null,
    progress: 'Draft Order Created', status: 'Deal Closed', assignee: 'Vo Nam Hieu', expires: '2026-08-22', source: 'RFQ form', note: '',
    lines: [{ sku: 'FIL-STD', qty: 120, quoted: 44 }, { sku: 'SEA-30', qty: 300, quoted: 5.9 }],
    timeline: [{ when: 'Jul 14', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Jul 18', what: 'Quote sent, valid 30 days' },
      { when: 'Jul 22', what: 'Draft order created in Shopify' }]
  },
  {
    id: '1030120', company: 'c1', buyer: 'John Nguyen', email: 'john@abcconstruction.com', location: 'Hanoi',
    created: '2026-08-10 10:20:00', updated: '2026-08-12', leadScore: null,
    progress: 'Draft Order Created', status: 'Deal Closed', assignee: 'Vo Nam Hieu', expires: '2026-09-10', source: 'RFQ form', note: '',
    lines: [{ sku: 'FIL-XL', qty: 60, quoted: 70 }, { sku: 'HOS-12', qty: 20, quoted: 118 }, { sku: 'VLV-40', qty: 50, quoted: 39 }, { sku: 'MCFC-TRAINING-JACKET', qty: 30, quoted: 980 }, { sku: 'FIL-STD', qty: 100, quoted: 45 }],
    timeline: [{ when: 'Aug 10', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Aug 12', what: 'Draft order created in Shopify' }]
  },
  {
    id: '1028785', company: 'c1', buyer: 'Pham Duc', email: 'duc@abcconstruction.com', location: 'Bac Ninh site',
    created: '2026-07-14 11:43:55', updated: '2026-07-14', leadScore: null,
    progress: 'PDF Exported', status: 'New Received', assignee: null, expires: null, source: 'RFQ form', note: '',
    lines: [{ sku: 'VLV-40', qty: 24, quoted: null }],
    timeline: [{ when: 'Jul 14', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Jul 14', what: 'Quote exported as PDF' }]
  },
  {
    id: '1027835', company: 'c2', buyer: 'Bui Quang', email: 'quang@vinhphat.vn', location: 'Da Nang',
    created: '2026-07-13 16:26:47', updated: '2026-07-13', leadScore: null,
    progress: 'Created', status: 'Updated', assignee: 'Vo Nam Hieu', expires: null, source: 'RFQ form',
    note: 'Đang chờ quyết định có biến thành giá dài hạn hay không.',
    lines: [{ sku: 'FIL-XL', qty: 80, quoted: 70 }, { sku: 'FIL-STD', qty: 80, quoted: 45 }, { sku: 'VLV-40', qty: 40, quoted: 39 }],
    timeline: [{ when: 'Jul 13', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Jul 13', what: 'Buyer updated the requested quantities' }]
  },
  {
    id: '1027687', company: 'c2', buyer: 'Bui Quang', email: 'quang@vinhphat.vn', location: 'Da Nang',
    created: '2026-07-13 13:19:15', updated: '2026-07-16', leadScore: null,
    progress: 'Auto Confirmed', status: 'Deal Closed', assignee: 'Vo Nam Hieu', expires: '2026-08-16', source: 'RFQ form', note: '',
    lines: [{ sku: 'HOS-12', qty: 30, quoted: 118 }],
    timeline: [{ when: 'Jul 13', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Jul 16', what: 'Auto confirmed at the quoted prices' }]
  },
  {
    id: '1027628', company: 'c4', buyer: 'Do Lan', email: 'lan@songhong.vn', location: 'Hanoi',
    created: '2026-07-13 11:44:41', updated: '2026-07-14', leadScore: null,
    progress: 'Draft Order Created', status: 'Read', assignee: 'Vo Nam Hieu', expires: '2026-08-14', source: 'RFQ form', note: '',
    lines: [{ sku: 'VLV-40', qty: 60, quoted: 38 }, { sku: 'SEA-30', qty: 200, quoted: 6.2 }],
    timeline: [{ when: 'Jul 13', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Jul 14', what: 'Draft order created in Shopify' }]
  },
  {
    id: '1026402', company: 'c4', buyer: 'Do Lan', email: 'lan@songhong.vn', location: 'Hanoi',
    created: '2026-06-18 09:12:20', updated: '2026-06-25', leadScore: null,
    progress: 'Email Sent', status: 'Deal Rejected', assignee: null, expires: '2026-07-18', source: 'RFQ form', note: '',
    lines: [{ sku: 'FIL-XL', qty: 25, quoted: 74 }],
    timeline: [{ when: 'Jun 18', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Jun 20', what: 'Quote sent, valid 30 days' },
      { when: 'Jun 25', what: 'Buyer rejected the quote' }]
  },
  {
    id: '1025110', company: 'c3', buyer: 'Tran Minh', email: 'minh@deltamechanical.vn', location: 'Ho Chi Minh City',
    created: '2026-06-02 14:35:09', updated: '2026-06-02', leadScore: null,
    progress: 'Created', status: 'Trashed', assignee: null, expires: null, source: 'RFQ form', note: '',
    lines: [{ sku: 'HOS-12', qty: 20, quoted: null }],
    timeline: [{ when: 'Jun 2', what: 'Buyer submitted an RFQ through the form' },
      { when: 'Jun 2', what: 'Moved to trash' }]
  }
];

export const dbSeed = { defaults, products, companies, tagPricing, customers, policies, attention, requests, health, quotes };

export const orderSeed = {
  c1: [
    {
      id: '#1045', location: 'Hanoi', buyer: 'John Nguyen', date: '2026-07-15', amount: 12400, lines: 3, po: 'PO-9821',
      pricing: 'ABC Hanoi Negotiated', pricingSource: 'Location price', source: 'Direct checkout',
      status: 'Needs review', shopifyStatus: 'Draft order', reason: 'Above the $10,000 review threshold'
    },
    {
      id: '#1044', location: 'Hanoi', buyer: 'Le Thu Ha', date: '2026-07-14', amount: 5860, lines: 2, po: 'PO-9814',
      pricing: 'ABC Hanoi Negotiated', pricingSource: 'Location price', source: 'Sales-assisted',
      status: 'Fulfilled', shopifyStatus: 'Fulfilled', reason: null
    },
    {
      id: '#1039', location: 'Hanoi', buyer: 'John Nguyen', date: '2026-06-28', amount: 6120, lines: 3, po: 'PO-9770',
      pricing: 'ABC Hanoi Negotiated', pricingSource: 'Location price', source: 'Reorder',
      status: 'Paid', shopifyStatus: 'Paid', reason: null
    },
    {
      id: '#1028', location: 'Bac Ninh site', buyer: 'Pham Duc', date: '2026-06-12', amount: 4380, lines: 4, po: 'PO-9651',
      pricing: 'Contractor Standard', pricingSource: 'Company price', source: 'Direct checkout',
      status: 'Fulfilled', shopifyStatus: 'Fulfilled', reason: null
    },
    {
      id: '#1017', location: 'Hanoi', buyer: 'John Nguyen', date: '2026-05-19', amount: 7275, lines: 5, po: 'PO-9518',
      pricing: 'ABC Hanoi Negotiated', pricingSource: 'Location price', source: 'Direct checkout',
      status: 'Fulfilled', shopifyStatus: 'Fulfilled', reason: null
    }
  ],
  c2: [
    {
      id: '#1041', location: 'Da Nang', buyer: 'Bui Quang', date: '2026-07-11', amount: 1560, lines: 1, po: 'None',
      pricing: 'Distributor Tier 2', pricingSource: 'Company price', source: 'Direct checkout',
      status: 'Fulfilled', shopifyStatus: 'Fulfilled', reason: null
    },
    {
      id: '#1033', location: 'Da Nang', buyer: 'Bui Quang', date: '2026-06-18', amount: 8920, lines: 6, po: 'PO-4432',
      pricing: 'Distributor Tier 2', pricingSource: 'Company price', source: 'Reorder',
      status: 'Paid', shopifyStatus: 'Paid', reason: null
    }
  ],
  c3: [],
  c4: [
    {
      id: '#1046', location: 'Hanoi', buyer: 'Do Lan', date: '2026-07-14', amount: 3184, lines: 2, po: 'None',
      pricing: 'None', pricingSource: 'None', source: 'Direct checkout',
      status: 'Blocked', shopifyStatus: 'Draft order', reason: 'The negotiated price expired and no other price applies'
    },
    {
      id: '#1021', location: 'Hanoi', buyer: 'Do Lan', date: '2026-06-22', amount: 2940, lines: 3, po: 'None',
      pricing: 'Standard Wholesale', pricingSource: 'Previous agreement', source: 'Direct checkout',
      status: 'Fulfilled', shopifyStatus: 'Fulfilled', reason: null
    }
  ]
};
