// Static demo data for the Quote analytics screen. Quote numbers themselves are NOT
// stored here: they're derived from the prototype's RFQ quotes (src/rfq/data/quotes.js,
// via the store) in model.js, so KPIs match the Submission list. This file only holds
// what the quotes don't carry: the demo "now", storefront button clicks, product cost
// per item (for the profit leak report), draft-order dates and saved reports.

// Demo "now": the day after the newest seeded quote (#1051093, Aug 09 2026), so the
// default "Last 7 days" range (Aug 3 – Aug 9) covers the recent submissions.
export const DEMO_NOW = new Date(2026, 7, 10, 9, 40, 0);

// Profit leak target margin (Cost management default in production).
export const TARGET_MARGIN_PERCENT = 20;

// When the draft order was created for a converted quote (fallback: quote created_at).
export const DRAFT_ORDER_CREATED_AT = {
  1051076: new Date(2026, 7, 7, 10, 20, 0),
};

// Cost per item set in Shopify, by SKU. HOS-12 (Reinforced hose) has no cost yet, so
// quote #1051091 can't be analyzed — that's the "Cost data coverage" gap.
export const UNIT_COSTS = {
  '701242812-CHERKI': 52,
  'MCFC-OFFICE-SET': 690,
  'MCFC-HERITAGE-SCARF': 104,
  'MCFC-TRAINING-JACKET': 1050,
  'MCFC-JACKET-L': 1050,
  'MCFC-JACKET-XL': 1090,
  'FIL-STD': 41,
  'FIL-XL': 81,
  'FIL-XL-HD': 96,
  'SEA-30': 7.4,
  'VLV-40': 36,
};

const CDN = 'https://cdn.shopify.com/s/files/1/1085/4855/5038/files/';

// Storefront product images / handles (same store as the prototype's storefront).
// Products without an image fall back to the image placeholder, as in production.
export const PRODUCT_INFO = {
  "Kids' Manchester City Home Jersey 2026/27 Long Sleeve With CHERKI 10 Printing": {
    handle: 'kids-manchester-city-home-jersey-2026-27-long-sleeve-with-cherki-10-printing',
    image: `${CDN}701242812BX001_pp_02_mcfc.png?v=1785899217`,
  },
  'Manchester City Home Jersey 2026/27 With HAALAND 9 Printing': {
    handle: 'manchester-city-home-jersey-2026-27-with-haaland-9-printing',
    image: `${CDN}701242784BS001_pp_02_mcfc.png?v=1785899238`,
  },
  'Manchester City Home Authentic Jersey 2026/27 With HAALAND 9 Printing in Gift Box': {
    handle: 'manchester-city-home-authentic-jersey-2026-27-with-haaland-9-printing-in-gift-box',
    image: `${CDN}701242690BS001_pp_02_mcfc.png?v=1785899232`,
  },
  'Manchester City 4 Piece Gift Set': {
    handle: 'manchester-city-4-piece-gift-set',
    image: `${CDN}701227555001_pp_01_mcfc.png?v=1785899227`,
  },
  "Women's Manchester City Home Jersey 2026/27 With FODEN 47 Printing": {
    handle: 'women-s-manchester-city-home-jersey-2026-27-with-foden-47-printing',
    image: `${CDN}701242808FJ001_pp_02_mcfc.png?v=1785899242`,
  },
  'Manchester City Team Training Jacket': { handle: 'manchester-city-team-training-jacket' },
  'Manchester City Heritage Scarf': { handle: 'manchester-city-heritage-scarf' },
  'Manchester City Premium Office Set': { handle: 'manchester-city-premium-office-set' },
  'Industrial filter, XL': { handle: 'industrial-filter-xl' },
  'Reinforced hose, 12m': { handle: 'reinforced-hose-12m' },
  'Sealant cartridge 300ml': { handle: 'sealant-cartridge-300ml' },
};

// Share of quote-button clicks per storefront product (sums to 100).
export const CLICK_SHARE = [
  { id: 8810001, title: 'Manchester City Team Training Jacket', share: 19 },
  { id: 8810002, title: "Kids' Manchester City Home Jersey 2026/27 Long Sleeve With CHERKI 10 Printing", share: 16 },
  { id: 8810003, title: 'Manchester City Home Jersey 2026/27 With HAALAND 9 Printing', share: 13 },
  { id: 8810004, title: 'Manchester City Heritage Scarf', share: 11 },
  { id: 8810005, title: 'Industrial filter, XL', share: 9 },
  { id: 8810006, title: 'Manchester City Home Authentic Jersey 2026/27 With HAALAND 9 Printing in Gift Box', share: 8 },
  { id: 8810007, title: 'Manchester City Premium Office Set', share: 7 },
  { id: 8810008, title: 'Manchester City 4 Piece Gift Set', share: 6 },
  { id: 8810009, title: 'Reinforced hose, 12m', share: 5 },
  { id: 8810010, title: "Women's Manchester City Home Jersey 2026/27 With FODEN 47 Printing", share: 4 },
  { id: 8810011, title: 'Sealant cartridge 300ml', share: 2 },
];

// Quote-button clicks on the storefront per day (deterministic). Weekdays are busier.
const WEEKDAY_BASE = [17, 39, 44, 42, 47, 36, 21]; // Sun … Sat
const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};
export function buttonClicksOn(day) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const today = new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth(), DEMO_NOW.getDate());
  if (start > today) return 0;
  const key = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
  const noise = (hash(key) % 13) - 6;
  const full = Math.max(4, WEEKDAY_BASE[start.getDay()] + noise);
  if (start.getTime() === today.getTime()) {
    // Today is still in progress.
    const elapsed = (DEMO_NOW.getHours() * 60 + DEMO_NOW.getMinutes()) / (24 * 60);
    return Math.round(full * elapsed);
  }
  return full;
}

// Saved analytics reports (Manage report). Created from the "Create report" chat flow.
export const INITIAL_REPORTS = [
  { id: 412, name: 'Which customers quoted 3+ times but never bought?', created_at: '2026-08-09' },
  { id: 411, name: 'Which products are clicked but rarely converted?', created_at: '2026-08-08' },
  { id: 409, name: 'Weekly quote performance', created_at: '2026-08-07' },
  { id: 406, name: 'Top customers by quote value — July 2026', created_at: '2026-08-01' },
  { id: 403, name: 'Conversion rate by product', created_at: '2026-07-28' },
  { id: 401, name: 'Quote button clicks vs submitted quotes by product and by customer, last 30 days', created_at: '2026-07-24' },
  { id: 398, name: 'Manchester City range — quote demand by product', created_at: '2026-07-20' },
  { id: 395, name: 'Industrial supplies quotes (filters, hoses, valves)', created_at: '2026-07-15' },
  { id: 391, name: 'Quotes still waiting for a reply after 3 days', created_at: '2026-07-10' },
  { id: 388, name: 'Quote volume by B2B company', created_at: '2026-07-06' },
  { id: 384, name: 'Monthly quote value summary — June 2026', created_at: '2026-07-01' },
  { id: 380, name: 'Q2 2026 quote funnel', created_at: '2026-06-30' },
];

export const REPORTS_PAGE_SIZE = 10;

export const EMPTY_STATE_IMAGE = 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png';
