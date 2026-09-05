// Static config constants extracted verbatim from rfq-x-b2b/b2b/index.html.

// SKU-set map for named collections.
export const COLLECTIONS = {
  'Wholesale assortment': ['FIL-XL', 'FIL-STD', 'SEA-30', 'HOS-12', 'VLV-40'],
  'Contractor assortment': ['FIL-XL', 'FIL-STD', 'SEA-30'],
  'Distributor assortment': ['HOS-12', 'VLV-40'],
  'Project assortment': ['SEA-30', 'HOS-12']
};

export const PAYMENT_TERM_OPTIONS = ['No payment terms', 'Due immediately', 'Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];

// App sub-nav config. In the source, `icon` values are literal glyph characters
// (not ICON.* references), so they are copied verbatim.
export const APP_SECTIONS = [
  { id: 'form', label: 'Form', icon: '▤', external: true },
  { id: 'customers', label: 'B2B Company', icon: '▢', external: false },
  { id: 'pricing', label: 'Pricing', icon: '◫', external: false },
  { id: 'analytics', label: 'Analytics', icon: '▥', external: false },
  { id: 'manual-order', label: 'Manual Order', icon: '▦', external: true },
  { id: 'discount', label: 'Discount', icon: '◈', external: true },
  { id: 'others', label: 'Others', icon: '⋯', external: true }
];

// [key, label, statuses|null] — used to filter quotes by tab.
export const QUOTE_TABS = [
  ['all', 'All', null],
  ['New Received', 'New received', ['New Received']],
  ['Read', 'Read', ['Read', 'Updated']],
  ['Deal Closed', 'Deal closed', ['Deal Closed']],
  ['Deal Rejected', 'Deal rejected', ['Deal Rejected']],
  ['Trashed', 'Trashed', ['Trashed']]
];

// [value, label] — pricing status segmented filter.
export const PRICING_STATUS_FILTERS = [['all', 'All'], ['active', 'Price ready'], ['need', 'Needs a price']];
