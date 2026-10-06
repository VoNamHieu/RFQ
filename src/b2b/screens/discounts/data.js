// Demo data + constants for the Discount list (production: pages/Discount/DiscountTable.tsx,
// features/Discount/constants/discount.constant.ts). Discount codes the B2B app applies at
// checkout, named after the prototype's companies (src/b2b/data/db.js), products and pricing.

export const DISCOUNT_LIST_PER_PAGE = 10;

export const DISCOUNT_TAB = [
  { id: 'all', label: 'All' },
  { id: 'on', label: 'Active' },
  { id: 'off', label: 'Inactive' },
  { id: 'scheduled', label: 'Scheduled' },
];

export const DISCOUNT_TYPE_OPTIONS = [
  { value: 'amount_off_line_items', label: 'Amount off line items' },
  { value: 'amount_off_order', label: 'Amount off order' },
  { value: 'free_shipping', label: 'Free shipping' },
];

export const STATUS_LABEL = { on: 'Active', off: 'Inactive', scheduled: 'Scheduled' };
// Polaris React tones from the production row (on → success, scheduled → attention, off → none).
export const STATUS_TONE = { on: 'success', scheduled: 'caution' };

export const DISCOUNT_HELP_URL = 'https://help.omegatheme.com/en/article/discount/';

export const EMPTY_STATE_IMAGE = 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png';

// List rows as the API returns them: `status` is the merchant's on/off switch; the badge
// shown is derived from it plus the schedule (start in the future → Scheduled, end in the
// past → Inactive and the toggle is locked). Dates are UTC.
export const DISCOUNTS = [
  {
    id: 13, name: 'Distributor Tier 2 – Q1 top-up', code: 'DT2-Q1TOPUP', status: 'on', discount_type: 'amount_off_order',
    used_count: 0, created_at: '2026-10-02T08:40:00Z', start_date: '2027-01-01T00:00:00Z', end_date: '2027-03-31T16:59:00Z',
  },
  {
    id: 12, name: 'Black Friday trade week', code: 'BFTRADE20', status: 'on', discount_type: 'amount_off_order',
    used_count: 0, created_at: '2026-10-01T03:15:00Z', start_date: '2026-11-23T00:00:00Z', end_date: '2026-11-30T16:59:00Z',
  },
  {
    id: 11, name: 'Q4 sealant cartridge restock', code: 'SEAL-Q4', status: 'on', discount_type: 'amount_off_line_items',
    used_count: 0, created_at: '2026-09-28T09:05:00Z', start_date: '2026-11-01T00:00:00Z', end_date: null,
  },
  {
    id: 10, name: 'Delta Mechanical ball valve rebate', code: 'DELTAVLV5', status: 'on', discount_type: 'amount_off_line_items',
    used_count: 3, created_at: '2026-08-14T02:30:00Z', start_date: '2026-08-14T02:30:00Z', end_date: null,
  },
  {
    id: 9, name: 'Free shipping for retailer-tagged buyers', code: 'RETAILSHIP', status: 'on', discount_type: 'free_shipping',
    used_count: 12, created_at: '2026-08-03T07:20:00Z', start_date: '2026-08-03T07:20:00Z', end_date: null,
  },
  {
    id: 8, name: 'Song Hong Interiors renewal', code: 'SONGHONG7', status: 'off', discount_type: 'amount_off_order',
    used_count: 2, created_at: '2026-07-21T04:10:00Z', start_date: '2026-07-21T04:10:00Z', end_date: null,
  },
  {
    id: 7, name: 'ABC Construction – Hanoi reorder', code: 'ABCHANOI10', status: 'on', discount_type: 'amount_off_order',
    used_count: 14, created_at: '2026-07-02T01:45:00Z', start_date: '2026-07-02T01:45:00Z', end_date: '2026-12-31T16:59:00Z',
  },
  {
    id: 6, name: 'Vinh Phat reinforced hose bundle', code: 'VPHOSE8', status: 'off', discount_type: 'amount_off_line_items',
    used_count: 6, created_at: '2026-06-30T06:00:00Z', start_date: '2026-06-30T06:00:00Z', end_date: null,
  },
  {
    id: 5, name: 'Industrial filter XL case pack', code: 'FILTERCASE15', status: 'on', discount_type: 'amount_off_line_items',
    used_count: 27, created_at: '2026-06-18T03:25:00Z', start_date: '2026-06-18T03:25:00Z', end_date: null,
  },
  {
    id: 4, name: 'Clearance – standard filters & valves', code: 'CLEAR-FIL', status: 'on', discount_type: 'amount_off_line_items',
    used_count: 22, created_at: '2026-06-01T02:00:00Z', start_date: '2026-06-01T02:00:00Z', end_date: '2026-12-31T16:59:00Z',
  },
  {
    id: 3, name: 'Summer site kickoff', code: 'SUMMERSITE', status: 'on', discount_type: 'amount_off_order',
    used_count: 33, created_at: '2026-05-20T05:30:00Z', start_date: '2026-06-01T00:00:00Z', end_date: '2026-08-31T16:59:00Z',
  },
  {
    id: 2, name: 'Free freight over $2,500', code: 'FREIGHT2500', status: 'on', discount_type: 'free_shipping',
    used_count: 41, created_at: '2026-05-06T08:00:00Z', start_date: '2026-05-06T08:00:00Z', end_date: null,
  },
  {
    id: 1, name: 'Welcome offer – first wholesale order', code: 'WELCOME-B2B', status: 'on', discount_type: 'amount_off_order',
    used_count: 9, created_at: '2026-04-12T03:00:00Z', start_date: '2026-04-12T03:00:00Z', end_date: null,
  },
];
