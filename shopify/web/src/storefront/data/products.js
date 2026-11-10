// Storefront product model, built from the REAL catalog of the dev store
// (221jumpstreet.myshopify.com). shopifyProducts.json is pulled from the Admin API
// with `node scripts/pull-products.mjs` — re-run it to refresh. `sku` stays the
// product key the cart, product page and quote requests use: the first variant's
// SKU, or the handle when the store has none. `list` is the D2C price.
import storeCatalog from './shopifyProducts.json';
import { productRuleFor, productRuleForCustomer, cartProblems, cartProblemsForCustomer, effectiveRules, effectiveRulesForCustomer, upgradeLimits, spentSoFar, turnLimitOn } from '../../b2b/limits.js';
import { TODAY } from '../../b2b/pricing.js';
import { dbSeed } from '../../b2b/data/db.js';
import { versionFlags } from '../../shared/versions.js';
import { publishOrderLimits, publishedOrderLimits, publishedContracts, publishedHeldOrders, readOrderRequests, readInvoiceCheckouts, readBuyerEvents, addBuyerEvent } from '../../shared/persistence.js';
import { fmtDay, syncContractDates, seedSnapshots, stampContractLimits, ownContractTerms, responseKey, declineOf } from '../../b2b/agreements.js';
import { portalContracts, activitiesOf } from '../../b2b/portalContracts.js';
import { latestBuyerResponse } from '../../b2b/buyerEvents.js';
import { normalizeDb, storefrontHeldOrders } from '../../b2b/dbHelpers.js';

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
    productType: p.productType, // for order limit rules by product type or tag
    tags: p.tags || [],
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
export const B2B_PRICE_LISTS = { abc: TIER2, c1: TIER2 };

// ── Order limits ────────────────────────────────────────────────────────────
// The B2B app's order limits, as it last published them (its sample limits until
// it has), checked against this store's catalog — the same checks the validation
// function runs (b2b/limits.js). The B2B buyer is ABC Construction · Hanoi.
const limitsDb = () => ({ products: PRODUCTS, limits: upgradeLimits(publishedOrderLimits() || dbSeed.limits) });

// A buyer signed in to a company location gets its B2B limits; anyone else the D2C
// ones (a guest as a non-logged-in customer) — only in the version that has order
// limits (Upcoming).
const atLocation = (session) => !!(session?.companyKey && session.locationId);
const asCustomer = (session) => (session ? { id: session.id, tags: session.tags || [] } : null);

// The quantity rule on a product for the buyer, or null.
export function productRuleForSession(sku, session) {
  if (!versionFlags().orderLimits) return null;
  return atLocation(session)
    ? productRuleFor(limitsDb(), session.companyKey, session.locationId, sku)
    : productRuleForCustomer(limitsDb(), asCustomer(session), sku);
}

// ── Order requests ──────────────────────────────────────────────────────────
// The buyer's order requests at their location — orders over a maximum sent for the
// merchant's review — and what became of each: 'waiting', 'invoiced' (approved: the
// buyer checks out from the invoice), 'approved' (checked out: a real order) or
// 'declined' (REQUEST_STATUS). From the orders held for review the B2B app last published (its
// sample ones until it has, e.g. ABC Hanoi's #1045), the requests this storefront
// sent that it hasn't picked up yet, and the account's earlier ones. A held order
// that came from one of this storefront's requests keeps the request's lines.
// Only for a B2B buyer at a location (sending an order for review is B2B only).
// Shown with the account's orders on the B2B Portal.
export const REQUEST_STATUS = {
  waiting: { label: 'Waiting for review', tone: 'amber' },
  invoiced: { label: 'Awaiting checkout', tone: 'amber' },
  approved: { label: 'Unfulfilled', tone: 'blue' },
  declined: { label: 'Declined', tone: null },
};
let seedHeld = null;
export function orderRequestsForSession(session) {
  if (!versionFlags().orderLimits || !atLocation(session)) return [];
  const here = (x) => x.companyId === session.companyKey && x.locationId === session.locationId;
  const requests = readOrderRequests().filter(here);
  const held = (publishedHeldOrders() ?? (seedHeld ||= storefrontHeldOrders(normalizeDb(dbSeed)))).filter(here);
  // Checked out from the invoice here, before the B2B app has marked the order placed.
  const checkedOut = readInvoiceCheckouts();
  const status = (h) => (h.status === 'invoiced' && checkedOut.includes(h.id) ? 'approved' : h.status || 'waiting');
  return [
    ...held.map((h) => ({ ...(requests.find((r) => r.id === h.requestId) || h), number: h.id, status: status(h) })),
    ...requests.filter((r) => !held.some((h) => h.requestId === r.id)).map((r) => ({ ...r, status: 'waiting' })),
    ...(session.orderRequests || []).filter((r) => !held.some((h) => h.id === r.number)),
  ];
}

// ── Contracts ───────────────────────────────────────────────────────────────
// The B2B Portal's contract cards for the buyer's location — { contract, upcoming,
// proposal }, each null when there's none — as the B2B app last published them, or
// its seed's until it has (b2b/portalContracts.js, the real portal's backend's
// cards). What the buyer sent from here (buyer events) counts before the B2B app has
// picked it up: each card's answers, and a proposal they approved is activated as the
// B2B app does it (agreements.js activateApproved) — on the Upcoming contract card
// when it starts later, the Contract card when it has started.
let seedContractsDb = null;
const contractsSeedDb = () =>
  (seedContractsDb ||= stampContractLimits(syncContractDates(seedSnapshots(ownContractTerms(normalizeDb(dbSeed))))));
export function contractsForSession(session) {
  const none = { contract: null, upcoming: null, proposal: null };
  if (!versionFlags().agreements || !atLocation(session)) return none;
  const published = publishedContracts();
  const cards =
    published?.v === 2
      ? published.at?.[`${session.companyKey}:${session.locationId}`] || none
      : portalContracts(contractsSeedDb(), session.companyKey, session.locationId);
  let contract = withAnswers(cards.contract, session);
  let upcoming = withAnswers(cards.upcoming, session);
  let proposal = withAnswers(cards.proposal, session);
  if (proposal?.approvedOn && (!proposal.startDate || proposal.approvedOn <= proposal.startDate)) {
    if (proposal.startDate && proposal.startDate > TODAY) {
      if (!upcoming || String(proposal.startDate) < String(upcoming.startDate)) upcoming = proposal;
    } else contract = proposal;
    proposal = null;
  }
  return { contract, upcoming, proposal };
}
// A card as it shows, with what the buyer sent from here added to the answers the B2B
// app published: `response`, the latest answer to its version — { kind, message, by,
// at ("Jul 28, 2026"), mine } or null; `declined`, the seller's decline of that very
// request for changes — { message, at } or null (one they sent since isn't declined);
// `activities`, its Activities log (portalContracts.js activitiesOf) as `response`
// reads, with `status` and `reply`; `approvedOn`, the day its latest answer approved it.
function withAnswers(card, session) {
  if (!card) return null;
  const known = new Set((card.buyerResponses || []).map(responseKey));
  const sent = readBuyerEvents()
    .filter((e) => e.type === 'contract-response' && e.data?.number === card.number)
    .map((e) => ({ ...e.data, at: String(e.at).slice(0, 10) }))
    .filter((r) => !known.has(responseKey(r)));
  const ag = { version: card.version, buyerResponses: [...(card.buyerResponses || []), ...sent], declines: card.declines || [] };
  const r = latestBuyerResponse(ag);
  const d = declineOf(ag);
  const view = (x) => ({ kind: x.kind, message: x.message || '', by: x.buyer || x.email || '', at: x.at ? fmtDay(x.at) : null, mine: !!x.email && x.email === session.email });
  return {
    ...card,
    response: r ? view(r) : null,
    declined: d ? { message: d.message, at: fmtDay(d.at) } : null,
    activities: activitiesOf(ag).map((a) => ({ ...view(a), version: a.version, status: a.status, reply: a.reply ? { message: a.reply.message, at: fmtDay(a.reply.at) } : null })),
    approvedOn: r?.kind === 'approve' ? r.at : null,
  };
}
// Approve, Request changes with what should change, or Request cancellation with why:
// a buyer event for the contract's version, as the real portal sends it
// (api/customer/contract-response).
export function answerContract(session, card, kind, message = '') {
  const at = `${TODAY}T${new Date().toISOString().slice(11)}`;
  addBuyerEvent('contract-response', { number: card.number, version: card.version, kind, message: kind === 'approve' ? '' : message, buyer: session.contact || '', email: session.email || '' }, at);
}

// An account order's date ("Aug 28, 2026") as YYYY-MM-DD.
const isoDay = (s) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// What the buyer ordered so far this week and month, for weekly and monthly
// maximums: their account's orders, plus order requests waiting for review.
function spentForSession(session) {
  if (!session) return {};
  const orders = (session.orders || []).map((o) => ({ date: isoDay(o.date), amount: o.total, status: o.status }));
  const requests = atLocation(session)
    ? readOrderRequests().filter((r) => r.companyId === session.companyKey && r.locationId === session.locationId).map((r) => ({ date: TODAY, amount: r.amount, status: 'Needs review' }))
    : [];
  return spentSoFar([...orders, ...requests]);
}

// The buyer's order limits, for the product page to show and count the order
// against: each setting in force as a number, by its key — minValue, maxValue,
// threshold and thresholdQty (the maximums sent for review), minQty, maxQty, and the weekly and
// monthly maximums ('maxValue@week', 'threshold@month', …) — with what the buyer
// ordered so far this week and month (`spent`, see spentSoFar). Null when none applies.
export function orderLimitsForSession(session) {
  if (!versionFlags().orderLimits) return null;
  const rec = atLocation(session)
    ? effectiveRules(limitsDb(), session.companyKey, session.locationId)
    : effectiveRulesForCustomer(limitsDb(), asCustomer(session));
  const out = {};
  Object.entries(rec.settings).forEach(([key, s]) => {
    if (s.mode === 'set' && Number(s.value) > 0) out[key] = Number(s.value);
  });
  return Object.keys(out).length ? { ...out, spent: spentForSession(session) } : null;
}

// What's wrong with the cart for the buyer (see cartProblems).
export function cartProblemsForSession(lines, subtotal, session) {
  if (!versionFlags().orderLimits) return [];
  const spent = spentForSession(session);
  return atLocation(session)
    ? cartProblems(limitsDb(), session.companyKey, session.locationId, lines, subtotal, spent)
    : cartProblemsForCustomer(limitsDb(), asCustomer(session), lines, subtotal, spent);
}

// A cart line for a product's first variant.
const cartLine = (sku, qty) => ({ sku, variantId: productBySku(sku)?.variants[0]?.id, qty });

// Prototype-only: the B2B demo account's cart cases (the cart drawer's Demo case).
// Each sets the cart and turns ABC Hanoi's order maximum ($800, Block checkout —
// ol7) on or off, saved like an edit in the B2B app so the app shows it too.
export const CART_CASES = [
  { id: 'product', label: 'Product blocks + product review', lines: [['701242784-HAALAND', 6], ['701242784-FODEN', 6]], orderMaximum: false },
  { id: 'order', label: 'Order blocks + product review', lines: [['701242784-HAALAND', 5], ['701242784-FODEN', 6]], orderMaximum: true },
  // Over ABC Hanoi review's $10,000 order maximum, with a jersey no product limit covers.
  { id: 'order-review', label: 'Order review (over $10,000)', lines: [['701242808-HAALAND', 120]], orderMaximum: false },
];
export function applyCartCase(c) {
  const limits = publishedOrderLimits() || dbSeed.limits;
  const max = limits.find((l) => l.id === 'ol7');
  if (c.orderMaximum) publishOrderLimits(turnLimitOn(limits, max || dbSeed.limits.find((l) => l.id === 'ol7')));
  else if (max) publishOrderLimits(limits.map((l) => (l.id === 'ol7' ? { ...l, status: 'Inactive' } : l)));
  return c.lines.map(([sku, qty]) => cartLine(sku, qty));
}

// ── Demo accounts ────────────────────────────────────────────────────────────
// Two sign-ins, one per B2B state, so both sides of the account page can be
// checked without editing code. The login screen lists them for developers.
//
//   quotesnap.of@gmail.com — NOT applied. A plain customer: D2C list prices, no
//     company, no quotes. Profile and B2B Portal show the "Buying for a
//     business?" apply entry; applying moves this account to "Pending review".
//   quatnap.of@gmail.com   — APPLIED and approved: John Nguyen at ABC Construction
//     · Hanoi, as in the B2B app, so its order limits apply. Contract
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
    devNote: 'Applied and approved — ABC Construction · Hanoi, contract prices, quote history',
    email: 'quatnap.of@gmail.com',
    contact: 'John Nguyen',
    companyKey: 'c1',
    companyName: 'ABC Construction',
    role: 'Location admin',
    locationLabel: 'Hanoi',
    locationId: 'l1',
    location: 'Hanoi, Vietnam',
    priceListName: 'Distributor Tier 2',
    marketing: { email: false },
    shippingAddress: { name: 'ABC Construction', line: 'Hanoi, Vietnam' },
    billingAddress: { name: 'ABC Construction', line: 'Hanoi, Vietnam' },
    paymentMethods: [{ brand: 'Visa', last4: '4242', expires: '08/28' }],
    get orders() { return ACCOUNT_ORDERS; },
    get quotes() { return ACCOUNT_QUOTES; },
    get orderRequests() { return ACCOUNT_ORDER_REQUESTS; },
    // The cart signing in starts with: 6 of each jersey, over ABC's maximum of 5 —
    // Haaland's blocks checkout, Foden's goes for review (limits ol5, ol6).
    get cart() { return CART_CASES[0].lines.map(([sku, qty]) => cartLine(sku, qty)); },
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
// A past order's line: a catalog product (its title and image), at the price paid.
const orderLine = (sku, quantity, price) => ({ sku, title: productBySku(sku)?.title || sku, quantity, price });
const withTotal = (o) => ({ ...o, total: Math.round(o.lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100 });
export const ACCOUNT_ORDERS = [
  {
    id: '#1042', date: 'Aug 28, 2026', status: 'Fulfilled', statusTone: 'green',
    lines: [
      orderLine('701242784-CHERKI', 10, 85.85), orderLine('701242784-GVARDIOL', 8, 85.85), orderLine('701242808-FODEN', 6, 85.85),
      orderLine('701242808-GVARDIOL', 6, 92.65), orderLine('701242809-HAALAND', 12, 64.6), orderLine('701242813', 5, 67.15),
    ],
  },
  {
    id: '#1017', date: 'Jul 09, 2026', status: 'Fulfilled', statusTone: 'green',
    lines: [orderLine('701242785-FODEN', 6, 92.65), orderLine('701237145-FODEN', 12, 25.84)],
  },
  {
    // Paid, not shipped yet.
    id: '#1039', date: 'Jun 28, 2026', status: 'Paid', statusTone: 'blue',
    lines: [orderLine('701242690-FODEN', 20, 124), orderLine('701242785-FODEN', 20, 92), orderLine('701242808-HAALAND', 20, 90)],
  },
  {
    // An order request the seller approved (ACCOUNT_ORDER_REQUESTS): it became this order.
    id: '#1036', date: 'Jun 22, 2026', status: 'Fulfilled', statusTone: 'green',
    lines: [orderLine('701242690-HAALAND', 60, 130.9), orderLine('701242808', 40, 92.65)],
  },
  {
    id: '#0994', date: 'Jun 15, 2026', status: 'Fulfilled', statusTone: 'green',
    lines: [orderLine('701242812-CHERKI', 10, 68.85), orderLine('701242690', 4, 124.1)],
  },
].map(withTotal);

// The account's earlier order requests the seller already decided on (the B2B
// app's own held orders join them, see orderRequestsForSession): one approved —
// it became order #1036 — and one declined, with the seller's message.
const requestLines = (lines) => lines.map(({ sku, title, quantity, price }) => ({ sku, title, qty: quantity, price }));
const declinedLines = [orderLine('701242690-FODEN', 80, 124.1), orderLine('701242813-FODEN', 60, 67.15)];
const order1036 = ACCOUNT_ORDERS.find((o) => o.id === '#1036');
export const ACCOUNT_ORDER_REQUESTS = [
  {
    number: '#1036', status: 'approved', companyId: 'c1', locationId: 'l1', buyer: 'John Nguyen', date: '2026-06-22', amount: order1036.total, threshold: 10000, period: 'order',
    lines: requestLines(order1036.lines),
  },
  {
    number: '#1030', status: 'declined', companyId: 'c1', locationId: 'l1', buyer: 'John Nguyen', date: '2026-06-05', amount: withTotal({ lines: declinedLines }).total, threshold: 10000, period: 'order',
    message: 'We can’t take an order this size before your credit review in July. Please split it into orders under $10,000.',
    lines: requestLines(declinedLines),
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
