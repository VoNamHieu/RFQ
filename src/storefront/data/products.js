// Storefront product model, built from the REAL catalog of the dev store
// (221jumpstreet.myshopify.com). shopifyProducts.json is pulled from the Admin API
// with `node scripts/pull-products.mjs` — re-run it to refresh. `sku` stays the
// product key the cart, product page and quote requests use: the first variant's
// SKU, or the handle when the store has none. `list` is the D2C price.
import storeCatalog from './shopifyProducts.json';
import { newLimit, productRuleFor, productRuleForCustomer, cartProblems, cartProblemsForCustomer, limitLevel, limitSummary } from '../../b2b/limits.js';
import { versionFlags } from '../../shared/versions.js';
import { money } from '../utils.js';

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

// Shopify's CDN resizes on request; cards and the product page never need more.
const sized = (url) => `${url}${url.includes('?') ? '&' : '?'}width=900`;
const textOf = (html) => html.replace(/<br\s*\/?>|<\/p>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const PRODUCTS = storeCatalog.products.map((p) => {
  const sku = p.variants[0]?.sku || p.handle;
  const description = textOf(p.descriptionHtml);
  return {
    sku,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    list: p.variants[0]?.price ?? p.priceMin,
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title === 'Default Title' ? '' : v.title,
      sku: v.sku,
      list: v.price,
      available: v.available,
    })),
    image: p.image ? sized(p.image.url) : placeholder(p.title, sku),
    tagline: p.productType,
    description, // plain text, for compact previews (e.g. the B2B app's form preview)
    descriptionHtml: description ? p.descriptionHtml : '',
  };
});

export const productBySku = (sku) => PRODUCTS.find((p) => p.sku === sku) || null;

// ── B2B pricing ─────────────────────────────────────────────────────────────
// A logged-in B2B buyer sees their company's contract prices. The store has no
// per-SKU contract prices for its real catalog, so "Distributor Tier 2" is a
// Shopify-style price list with one percentage adjustment off the list price.
const TIER2 = { name: 'Distributor Tier 2', percentOff: 15 };
export const B2B_PRICE_LISTS = { abc: TIER2, watson: TIER2 };

// ── Order limits ────────────────────────────────────────────────────────────
// The B2B app's order limits as they reach this storefront's demo company (shape
// and rules: b2b/limits.js — the same checks the validation function runs).
// Watson Co · Phố Thái Hà gets the store-wide minimum, jersey case packs for the
// company, and its own review threshold. Signed-in customers outside a company
// (D2C) get the D2C jersey maximum; guests get no limits.
const JERSEYS = PRODUCTS.filter((p) => /jersey/i.test(p.title)).map((p) => p.sku);
const STORE_LIMITS = {
  products: PRODUCTS,
  limits: [
    { ...newLimit('order'), id: 'sl1', name: 'Wholesale minimum', minValue: 500 },
    { ...newLimit('product'), id: 'sl2', name: 'Jersey case packs', min: 10, increment: 5, selectedProducts: JERSEYS, storeWide: false, companyIds: ['watson'] },
    { ...newLimit('review'), id: 'sl3', name: 'Watson review', threshold: 5000, storeWide: false, locationKeys: ['watson::thai-ha'] },
    { ...newLimit('product'), id: 'sl4', name: 'Customer jersey maximum', max: 10, selectedProducts: JERSEYS, audienceType: 'd2c', storeWide: false, customerTarget: 'logged_in' },
  ],
};

// A buyer signed in to a company location gets its B2B limits; anyone else the D2C
// ones (a guest as a non-logged-in customer) — only in the version that has order
// limits (Upcoming).
const atLocation = (session) => !!(session?.companyKey && session.locationId);
const asCustomer = (session) => (session ? { id: session.id, tags: session.tags || [] } : null);

// The quantity rule on a product for the buyer, or null.
export function productRuleForSession(sku, session) {
  if (!versionFlags().orderLimits) return null;
  return atLocation(session)
    ? productRuleFor(STORE_LIMITS, session.companyKey, session.locationId, sku)
    : productRuleForCustomer(STORE_LIMITS, asCustomer(session), sku);
}

// ── Agreement ───────────────────────────────────────────────────────────────
// The buyer's agreement as their account shows it (b2b/agreements.js): its
// pricing (the price list above) and the order limits it sets for their company
// or location. Store-wide limits apply to every buyer, so they aren't part of it.
const STORE_AGREEMENT = { number: 'CT-412', name: '2026 trade terms', version: 2, since: 'Jan 5, 2026' };

export function agreementForSession(session) {
  if (!versionFlags().agreements || !atLocation(session)) return null;
  const list = B2B_PRICE_LISTS[session.companyKey];
  const limits = STORE_LIMITS.limits.filter((l) => l.status === 'Active' && ['company', 'location'].includes(limitLevel(l, session.companyKey, session.locationId)));
  return {
    ...STORE_AGREEMENT,
    pricing: list ? `${list.name} · ${list.percentOff}% off list prices` : null,
    // Buyer wording for a review threshold; the rest read the same for both sides.
    limits: limits.map((l) => (l.kind === 'review' ? `Orders over ${money(l.threshold).replace(/\.00$/, '')} are sent for approval` : limitSummary(l, STORE_LIMITS))),
  };
}

// What's wrong with the cart for the buyer (see cartProblems).
export function cartProblemsForSession(lines, subtotal, session) {
  if (!versionFlags().orderLimits) return [];
  return atLocation(session)
    ? cartProblems(STORE_LIMITS, session.companyKey, session.locationId, lines, subtotal)
    : cartProblemsForCustomer(STORE_LIMITS, asCustomer(session), lines, subtotal);
}

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
    locationId: 'thai-ha',
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
  const product = productBySku(sku);
  if (!list || !product) return null;
  return Math.round(product.list * (100 - list.percentOff)) / 100;
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
