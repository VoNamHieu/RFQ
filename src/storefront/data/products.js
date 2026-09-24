// Storefront product model. Adapted from the SHARED admin catalog (rfq/data/catalog.js)
// so the storefront, the RFQ app and the B2B app all speak about the same SKUs and
// prices. We add the customer-facing bits Dawn needs (vendor, description, image)
// that the admin catalog doesn't carry.
import { RFQ_CATALOG } from '../../rfq/data/catalog.js';

const VENDOR = '221 Baker';

// Extra storefront copy per SKU (admin catalog has none).
const COPY = {
  'FIL-STD': { tagline: 'Standard-flow industrial filter', description: 'A dependable standard-flow filter for general industrial lines. Rated for continuous operation with an easy drop-in cartridge for fast maintenance.' },
  'FIL-XL':  { tagline: 'High-capacity industrial filter', description: 'Our XL filter doubles the media area for high-throughput systems. Choose the heavy-duty variant for abrasive or high-pressure environments.' },
  'SEA-30':  { tagline: 'Fast-cure sealant, 300 ml', description: 'A 300 ml cartridge of fast-curing industrial sealant. Bonds to metal, concrete and most plastics with a flexible, weatherproof finish.' },
  'HOS-12':  { tagline: 'Reinforced hose', description: 'Braided, reinforced hose built for pressure and abrasion. Available in 12, 18 and 24 metre lengths for fixed and mobile installations.' },
  'VLV-40':  { tagline: '40 mm ball valve', description: 'A full-bore 40 mm ball valve with a corrosion-resistant body and quarter-turn lever. Rated for water, oil and compressed air.' },
  'MCFC-TRAINING-JACKET': { tagline: 'Official team training jacket', description: 'The official Manchester City team training jacket. Moisture-wicking technical fabric with an embroidered crest. Team and bulk orders available on request.' },
};

// A soft, always-rendering placeholder image per product (Dawn ships gray
// placeholders too). Self-contained SVG data URI — no external asset to load.
function placeholder(title, sku) {
  const hue = (Array.from(sku).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
  const bg = `hsl(${hue} 22% 92%)`;
  const fg = `hsl(${hue} 30% 40%)`;
  const label = title.length > 22 ? title.slice(0, 21) + '…' : title;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
    <rect width='600' height='600' fill='${bg}'/>
    <circle cx='300' cy='250' r='96' fill='none' stroke='${fg}' stroke-width='6' opacity='0.55'/>
    <path d='M300 190 v120 M240 250 h120' stroke='${fg}' stroke-width='6' opacity='0.55' stroke-linecap='round'/>
    <text x='300' y='430' font-family='Assistant, sans-serif' font-size='30' font-weight='600'
      fill='${fg}' text-anchor='middle'>${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const PRODUCTS = RFQ_CATALOG.map((p) => ({
  sku: p.sku,
  handle: p.sku.toLowerCase(),
  title: p.title,
  vendor: VENDOR,
  list: p.list,
  stock: p.stock,
  variants: p.variants,
  image: placeholder(p.title, p.sku),
  ...(COPY[p.sku] || { tagline: '', description: '' }),
}));

export const productBySku = (sku) => PRODUCTS.find((p) => p.sku === sku) || null;

// ── B2B pricing ─────────────────────────────────────────────────────────────
// A logged-in B2B buyer sees their company's contract prices. This mirrors the
// RFQ app's "Distributor Tier 2" base pricing (rfq/data/catalog.js → p1/p8).
const TIER2 = { 'FIL-STD': 45, 'SEA-30': 5.9, 'FIL-XL': 70, 'VLV-40': 39, 'HOS-12': 118 };
export const B2B_PRICE_LISTS = {
  abc: { name: 'Distributor Tier 2', prices: TIER2 },
  watson: { name: 'Distributor Tier 2', prices: TIER2 },
};

// ── Demo accounts ────────────────────────────────────────────────────────────
// Two sign-ins, one per B2B state, so both sides of the account page can be
// checked without editing code. The login screen lists them for developers.
//
//   quotesnap.of@gmail.com — NOT applied. A plain customer: D2C list prices, no
//     company, no quotes. Profile and B2B Portal show the "Buying for a
//     business?" apply entry; applying moves this account to "Pending review".
//   quatnap.of@gmail.com   — APPLIED and approved into Watson Co. Contract
//     prices, company purchasing terms, quote history, order → quote request.
//
// Any other email signs in as the not-applied buyer.
export const DEMO_ACCOUNTS = [
  {
    id: 'not-applied',
    devNote: 'Not applied — plain customer, D2C prices, no company',
    email: 'quotesnap.of@gmail.com',
    contact: 'Mai Nguyen',
    companyKey: null,
    companyName: null,
    locationLabel: null,
    marketing: { email: false },
    shippingAddress: { name: 'Mai Nguyen', line: '18 Lang Ha, Ba Dinh, Vietnam' },
    billingAddress: { name: 'Mai Nguyen', line: '18 Lang Ha, Ba Dinh, Vietnam' },
    paymentMethods: [],
    addresses: [{ name: 'Mai Nguyen', line: '18 Lang Ha, Ba Dinh, Vietnam', default: true }],
    orders: [],
    quotes: [],
  },
  {
    id: 'b2b',
    devNote: 'Applied and approved — Watson Co, contract prices, quote history',
    email: 'quatnap.of@gmail.com',
    contact: 'Watson James',
    companyKey: 'watson',
    companyName: 'Watson Co',
    role: 'Ordering only',
    locationLabel: 'Phố Thái Hà',
    location: 'Phố Thái Hà, Đống Đa, Vietnam',
    priceListName: 'Distributor Tier 2',
    marketing: { email: false },
    shippingAddress: { name: 'Watson Co', line: 'Phố Thái Hà, Đống Đa, Vietnam' },
    billingAddress: { name: 'Watson Co', line: 'Phố Thái Hà, Đống Đa, Vietnam' },
    paymentMethods: [{ brand: 'Visa', last4: '4242', expires: '08/28' }],
    get orders() { return ACCOUNT_ORDERS; },
    get quotes() { return ACCOUNT_QUOTES; },
  },
];

// The B2B buyer stays the default demo account (storefront pricing, prefills).
export const DEMO_ACCOUNT = DEMO_ACCOUNTS[1];

// Sign-in by email: an unknown address gets the not-applied buyer.
export function accountForEmail(email) {
  const key = String(email || '').trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === key) || DEMO_ACCOUNTS[0];
}

// The contract (B2B) price for a SKU under a session, or null if none applies.
export function b2bPriceFor(sku, session) {
  if (!session) return null;
  const list = B2B_PRICE_LISTS[session.companyKey];
  const price = list && list.prices[sku];
  return typeof price === 'number' ? price : null;
}

// ── Account mock data ────────────────────────────────────────────────────────
// Shapes mirror the qs-b2b-portal customer-account extensions: orders come from
// the Customer Account API (name, date, financial status, lines, total), quotes
// from the app's own API (status, lines with the seller's unit price, and
// whether the agreed price was saved back as reusable company pricing).
export const ACCOUNT_ORDERS = [
  {
    id: '#1042', date: 'Aug 28, 2026', status: 'Fulfilled', statusTone: 'green', total: 2610,
    lines: [{ sku: 'HOS-12', title: 'Reinforced hose, 12m', quantity: 15 }, { sku: 'FIL-XL', title: 'Industrial filter, XL', quantity: 10 }],
  },
  {
    id: '#1017', date: 'Jul 09, 2026', status: 'Fulfilled', statusTone: 'green', total: 890,
    lines: [{ sku: 'SEA-30', title: 'Sealant cartridge, 30 pack', quantity: 8 }],
  },
  {
    id: '#0994', date: 'Jun 15, 2026', status: 'Fulfilled', statusTone: 'green', total: 1465,
    lines: [{ sku: 'FIL-XL', title: 'Industrial filter, XL', quantity: 12 }, { sku: 'HOS-12', title: 'Reinforced hose, 12m', quantity: 4 }],
  },
];

// What the buyer's company gets — the portal's "business summary" (price list,
// terms and how many products carry reusable negotiated pricing).
export const BUSINESS_SUMMARY = {
  pricingActive: true,
  priceListName: 'Distributor Tier 2',
  paymentTerms: 'Net 30',
  purchasingMode: 'Buy directly',
  negotiatedProductCount: 12,
};

// Quote requests raised from the storefront / RFQ app (the B2B×RFQ touchpoint).
// status: Pending (sent) → Quoted (seller priced it) → Counter sent → Accepted.
export const ACCOUNT_QUOTES = [
  {
    id: 'Q-2051', date: 'Sep 12, 2026', status: 'Quoted', total: 4720, savedToPricing: false,
    message: 'We can hold this price until Sep 30.',
    lines: [{ sku: 'HOS-12', title: 'Reinforced hose, 12m', quantity: 40, unitPrice: 118, listPrice: 132 }],
  },
  {
    id: 'Q-2033', date: 'Aug 30, 2026', status: 'Pending', total: null, savedToPricing: false,
    message: 'Your request has been sent to the seller.',
    lines: [{ sku: 'MCFC-TRAINING-JACKET', title: 'Team Training Jacket', quantity: 120, unitPrice: null, listPrice: 95 }],
  },
  {
    id: 'Q-1998', date: 'Aug 04, 2026', status: 'Accepted', total: 14000, savedToPricing: true,
    message: 'Accepted. The agreed price can be reused on future purchases.',
    lines: [{ sku: 'FIL-XL', title: 'Industrial filter, XL', quantity: 200, unitPrice: 70, listPrice: 82 }],
  },
];

// Quote status → what the buyer can do with it, and the badge tone.
export const QUOTE_STATUS = {
  Quoted: { tone: 'blue', group: 'action' },
  'Counter sent': { tone: 'amber', group: 'progress' },
  Pending: { tone: 'amber', group: 'progress' },
  Accepted: { tone: 'green', group: 'closed' },
  Closed: { tone: '', group: 'closed' },
};
