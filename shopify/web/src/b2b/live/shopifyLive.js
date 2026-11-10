// Live store data. The app inside Shopify admin (b2b/shopify.html sets QS_EMBED =
// 'shopify') uses the real store: its products, collections, companies (locations
// and buyers), customers and orders, read with the Admin API (direct API access
// through App Bridge). The app's own records (pricing, order limits, contracts) are
// kept in an app-data metafield on the app's installation (APP_DATA_KEY), and what
// each company location gets on the storefront (its prices, quantity prices and
// order limits) in another one (STOREFRONT_KEY), which the theme app extension
// reads. The prototype (no QS_EMBED) keeps its demo data.
import { COLLECTIONS, CATALOG_PRICES } from '../data/constants.js';
import { shopifyCompanyDirectory } from '../data/directory.js';
import {
  resolvedPriceFor,
  resolveDetail,
  companyActiveQuantityPolicies,
  hasOwnSlot,
  quantityInScope,
  applyAdjustment,
  productVariants,
  setContractPricing,
} from '../pricing.js';
import { effectiveRules, productRuleFor, ORDER_FIELDS, settingOf, cartProblems, spentSoFar, limitLevel, limitRules } from '../limits.js';
import { normalizeDb, recomputeBuyers } from '../dbHelpers.js';
import { joinLaterLocations, liveContractPricing, syncContractDates, seedSnapshots, stampContractLimits, ownContractTerms, storefrontContracts, fmtDay } from '../agreements.js';
import { money } from '../format.js';
import { applyBuyerEvents, BUYER_EVENTS_KEY } from '../buyerEvents.js';

export const LIVE = typeof window !== 'undefined' && window.QS_EMBED === 'shopify';
export const API_VERSION = '2026-10';
export const NAMESPACE = 'qs_b2b';
export const APP_DATA_KEY = 'app_data';
export const STOREFRONT_KEY = 'storefront';
// JSON metafield values are limited to 128KB (API 2026-04 and later).
const MAX_JSON = 128 * 1024;

// ── Admin API ───────────────────────────────────────────────────────────────
// In Shopify admin, App Bridge answers `shopify:admin/…` with the app's access
// (direct API access, shopify.app.toml). A script can hand in its own runner.
let runner = async (query, variables) => {
  const res = await fetch(`shopify:admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
};
export const setGraphqlRunner = (fn) => {
  runner = fn;
};
export async function graphql(query, variables = {}) {
  const out = await runner(query, variables);
  if (out?.errors?.length) throw new Error(out.errors.map((e) => e.message).join(' · '));
  return out.data;
}

const PRODUCTS_QUERY = `#graphql
  query QsProducts($after: String) {
    products(first: 50, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id title handle vendor productType tags status totalInventory
        collections(first: 5) { nodes { title } }
        variants(first: 10) { nodes { id title sku price } }
      }
    }
  }`;

// Customers, buyers and orders are protected customer data. Shopify approves an app
// for it at two levels: the records ('data'), and on top their names and emails
// ('full'). Each query below asks for what a level allows ('none': no customer data).
const companiesQuery = (level) => `#graphql
  query QsCompanies($after: String) {
    companies(first: 5, after: $after, sortKey: NAME) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name${level === 'full' ? `
        mainContact { customer { displayName } }` : ''}
        locations(first: 10) {
          nodes {
            id name
            buyerExperienceConfiguration { checkoutToDraft editableShippingAddress paymentTermsTemplate { name } }
            shippingAddress { address1 address2 city zip countryCode phone }
          }
        }${level === 'none' ? '' : `
        contacts(first: 10) {
          nodes {
            id
            customer { id${level === 'full' ? ' displayName defaultEmailAddress { emailAddress }' : ''} }
            roleAssignments(first: 5) { nodes { ${level === 'full' ? 'role { name } ' : ''}companyLocation { id } } }
          }
        }`}
      }
    }
  }`;

const customersQuery = (level) => `#graphql
  query QsCustomers {
    customers(first: 100, sortKey: NAME) {
      nodes {
        id tags numberOfOrders${level === 'full' ? `
        displayName
        defaultEmailAddress { emailAddress }` : ''}
        lastOrder { processedAt }
        companyContactProfiles { id }
      }
    }
  }`;

const ordersQuery = (level) => `#graphql
  query QsOrders($after: String) {
    orders(first: 20, after: $after, sortKey: PROCESSED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name processedAt poNumber note cancelledAt
        displayFinancialStatus displayFulfillmentStatus
        totalPriceSet { shopMoney { amount } }${level === 'full' ? `
        customer { displayName }` : ''}
        purchasingEntity {
          ... on PurchasingCompany { company { id } location { id }${level === 'full' ? ' contact { customer { displayName } }' : ''} }
        }
        lineItems(first: 10) {
          nodes { title sku quantity variant { id } originalUnitPriceSet { shopMoney { amount } } }
        }
      }
    }
  }`;

// Order requests: carts over a maximum the seller reviews, sent from the storefront
// as draft orders tagged "Order request" (the qs-b2b-portal backend). They wait as
// held orders ('Needs review') until the merchant approves one — its invoice goes to
// the buyer ('Invoice sent'), a real order once they pay it — or declines it (tagged
// "Declined", with the merchant's message in a metafield). See reviewRequest.
const requestsQuery = (level) => `#graphql
  query QsOrderRequests($after: String) {
    draftOrders(first: 50, after: $after, query: "tag:'Order request'", sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name status createdAt tags note2
        declineMessage: metafield(namespace: "${NAMESPACE}", key: "decline_message") { value }
        totalPriceSet { shopMoney { amount } }
        purchasingEntity {
          ... on PurchasingCompany { company { id } location { id }${level === 'full' ? ' contact { customer { displayName } }' : ''} }
        }
        lineItems(first: 50) {
          nodes { title sku quantity variant { id } originalUnitPriceSet { shopMoney { amount } } }
        }
      }
    }
  }`;

// Orders' shipping addresses, apart: an address needs its own approval (protected
// customer fields), and without it the rest still loads — an order then shows its
// location's address.
const ORDER_ADDRESSES_QUERY = `#graphql
  query QsOrderAddresses($after: String) {
    orders(first: 50, after: $after, sortKey: PROCESSED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes { id shippingAddress { firstName lastName company address1 address2 city zip countryCodeV2 } }
    }
  }`;

const APP_DATA_QUERY = `#graphql
  query QsAppData {
    shop { currencyCode }
    currentAppInstallation {
      id
      appData: metafield(namespace: "${NAMESPACE}", key: "${APP_DATA_KEY}") { value }
      storefront: metafield(namespace: "${NAMESPACE}", key: "${STOREFRONT_KEY}") { value }
      buyerEvents: metafield(namespace: "${NAMESPACE}", key: "${BUYER_EVENTS_KEY}") { value }
    }
  }`;

const SAVE_MUTATION = `#graphql
  mutation QsSave($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key }
      userErrors { field message code }
    }
  }`;

async function allPages(query, pick, max = 10) {
  const out = [];
  let after = null;
  for (let i = 0; i < max; i += 1) {
    const conn = pick(await graphql(query, { after }));
    out.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

// Everything the app reads from the store, as the Admin API returns it — customer
// data at the level Shopify approved the app for (`access`): without names and
// emails, or without customers, buyers and orders at all.
const isDenied = (e) => /not approved to (access|use)/i.test(e.message);
const LEVELS = ['full', 'data', 'none'];
async function atAccess(run, empty) {
  for (const level of LEVELS) {
    if (level === 'none' && empty !== undefined) return { value: empty, level };
    try {
      return { value: await run(level), level };
    } catch (e) {
      if (!isDenied(e) || level === 'none') throw e;
    }
  }
  return null;
}
export async function fetchStore() {
  const [products, companies, customers, orders, app, requests] = await Promise.all([
    allPages(PRODUCTS_QUERY, (d) => d.products),
    atAccess((lv) => allPages(companiesQuery(lv), (d) => d.companies)),
    atAccess((lv) => graphql(customersQuery(lv)).then((d) => d.customers.nodes), []),
    atAccess((lv) => allPages(ordersQuery(lv), (d) => d.orders, 5), []),
    graphql(APP_DATA_QUERY),
    // Without access to draft orders, the app still opens, with no order requests.
    atAccess((lv) => allPages(requestsQuery(lv), (d) => d.draftOrders, 2), []).catch(() => ({ value: [] })),
  ]);
  const addresses = await allPages(ORDER_ADDRESSES_QUERY, (d) => d.orders, 2).catch((e) => {
    if (!isDenied(e)) throw e;
    return [];
  });
  const addressOf = new Map(addresses.map((o) => [o.id, o.shippingAddress]));
  orders.value.forEach((o) => {
    if (addressOf.has(o.id)) o.shippingAddress = addressOf.get(o.id);
  });
  const access = LEVELS[Math.max(...[companies, customers, orders].map((x) => LEVELS.indexOf(x.level)))];
  const raw = { app: app.currentAppInstallation.appData?.value || null, storefront: app.currentAppInstallation.storefront?.value || null };
  let appData = null;
  try {
    appData = raw.app ? JSON.parse(raw.app) : null;
  } catch {
    appData = null;
  }
  // What buyers sent from their customer account (buyerEvents.js), applied in buildLiveDb.
  let buyerEvents = [];
  try {
    buyerEvents = JSON.parse(app.currentAppInstallation.buyerEvents?.value || '{}').events || [];
  } catch {
    buyerEvents = [];
  }
  // As saved: the first save only writes what differs (e.g. a price changed in Shopify).
  saved = raw;
  return { products, companies: companies.value, customers: customers.value, orders: orders.value, requests: requests.value, access, installationId: app.currentAppInstallation.id, currency: app.shop.currencyCode, appData, buyerEvents };
}

// What the store holds now (its raw values), so a save only writes what changed.
let saved = { app: null, storefront: null };

// ── Store records → the app's ───────────────────────────────────────────────
const numId = (gid) => String(gid || '').split('/').pop();
// Ids the app keeps: a Shopify company in the directory is `shp_<id>`, a location
// `l<id>`, a customer outside a company `w<id>` — so the Shopify id is always at hand.
export const shopifyCompanyKey = (gid) => `shp_${numId(gid)}`;
export const locationKey = (gid) => `l${numId(gid)}`;
const locationGid = (id) => String(id).replace(/^l/, '');
const day = (iso) => (iso ? String(iso).slice(0, 10) : null);
// A customer whose name the app can't read (no access to names): by their id.
const nameless = (gid) => (gid ? `Customer ${numId(gid)}` : '');
const ordering = (cfg) => (cfg?.checkoutToDraft ? 'You approve first' : 'Buys directly');

// A product as the app keys it: by the first variant's SKU (the handle when it has
// none), its first variant's id the same; other variants by their SKU.
function toProducts(nodes) {
  const used = new Set();
  const unique = (id, gid) => {
    const out = used.has(id) ? `${id}-${gid}` : id;
    used.add(out);
    return out;
  };
  return nodes.map((p) => {
    const vs = p.variants.nodes;
    const sku = unique(vs[0]?.sku || p.handle, numId(p.id));
    return {
      sku,
      title: p.title,
      list: Number(vs[0]?.price ?? 0),
      cost: null,
      stock: p.totalInventory,
      vendor: p.vendor,
      productType: p.productType,
      tags: p.tags || [],
      collections: p.collections.nodes.map((c) => c.title),
      gid: numId(p.id),
      variants: vs.map((v, i) => ({
        id: i === 0 ? sku : unique(v.sku || `${sku}-${numId(v.id)}`, numId(v.id)),
        title: v.title === 'Default Title' ? 'Default' : v.title,
        list: Number(v.price),
        gid: numId(v.id),
      })),
    };
  });
}

// The store's companies as the Add companies picker lists them. A buyer is listed
// at each location they have a role at.
function toDirectory(nodes) {
  return nodes.map((c) => {
    const locations = c.locations.nodes.map((l) => {
      const cfg = l.buyerExperienceConfiguration;
      const a = l.shippingAddress || {};
      return {
        id: locationKey(l.id),
        name: l.name,
        terms: cfg?.paymentTermsTemplate?.name || 'Not set',
        ordering: ordering(cfg),
        editableShipping: !!cfg?.editableShippingAddress,
        shipping: { country: a.countryCode || '', address1: a.address1 || '', address2: a.address2 || '', city: a.city || '', postal: a.zip || '', phone: a.phone || '' },
      };
    });
    const contacts = (c.contacts?.nodes || []).flatMap((ct) => {
      const base = { name: ct.customer?.displayName || nameless(ct.customer?.id), email: ct.customer?.defaultEmailAddress?.emailAddress || '' };
      const roles = ct.roleAssignments.nodes;
      if (!roles.length) return [{ ...base, role: '', access: '', location: '' }];
      return roles.map((r) => {
        const loc = locations.find((l) => l.id === locationKey(r.companyLocation.id));
        return { ...base, role: r.role?.name || '', access: loc?.ordering || '', location: loc?.name || '' };
      });
    });
    return { id: shopifyCompanyKey(c.id), name: c.name, status: 'Active', mainContact: c.mainContact?.customer?.displayName || '', locations, contacts };
  });
}

function orderStatus(o) {
  if (o.cancelledAt) return 'Cancelled';
  if (o.displayFulfillmentStatus === 'FULFILLED') return 'Fulfilled';
  if (o.displayFinancialStatus === 'PAID') return 'Paid';
  return 'Unfulfilled';
}
const label = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '');

// A company's orders (newest first), as its Orders lists them.
function companyOrders(orders, shopifyKey, locations) {
  return orders
    .filter((o) => o.purchasingEntity?.company && shopifyCompanyKey(o.purchasingEntity.company.id) === shopifyKey)
    .map((o) => {
      const loc = locations.find((l) => l.id === locationKey(o.purchasingEntity.location?.id));
      return {
        id: o.name,
        gid: numId(o.id),
        location: loc?.name || '',
        locationId: loc?.id || null,
        buyer: o.purchasingEntity.contact?.customer?.displayName || o.customer?.displayName || '',
        // The order's date as Shopify shows it (an imported order's own date, not when it was added).
        date: day(o.processedAt),
        amount: Number(o.totalPriceSet.shopMoney.amount),
        lines: o.lineItems.nodes.length,
        po: o.poNumber || 'None',
        items: o.lineItems.nodes.map((li) => ({ sku: li.sku || '', title: li.title, qty: li.quantity, price: Number(li.originalUnitPriceSet.shopMoney.amount) })),
        buyerMessage: o.note || undefined,
        shipping: o.shippingAddress
          ? {
              firstName: o.shippingAddress.firstName || '',
              lastName: o.shippingAddress.lastName || '',
              company: o.shippingAddress.company || '',
              address1: o.shippingAddress.address1 || '',
              address2: o.shippingAddress.address2 || '',
              city: o.shippingAddress.city || '',
              postal: o.shippingAddress.zip || '',
              country: o.shippingAddress.countryCodeV2 || '',
            }
          : null,
        pricing: '—',
        pricingSource: '—',
        source: 'Online store',
        status: orderStatus(o),
        shopifyStatus: label(o.displayFinancialStatus) || orderStatus(o),
        reason: null,
      };
    });
}

// A company's order requests still open or declined (a paid one is a real order,
// read with the others), as held orders.
function companyRequests(drafts, shopifyKey, locations, products) {
  const productOf = (variant) => products.find((p) => p.variants.some((v) => v.gid === numId(variant?.id)));
  return drafts
    .filter((d) => d.status !== 'COMPLETED' && d.purchasingEntity?.company && shopifyCompanyKey(d.purchasingEntity.company.id) === shopifyKey)
    .map((d) => {
      const loc = locations.find((l) => l.id === locationKey(d.purchasingEntity.location?.id));
      const declined = d.tags.includes('Declined');
      return {
        id: d.name,
        draftId: d.id,
        gid: numId(d.id),
        location: loc?.name || '',
        locationId: loc?.id || null,
        buyer: d.purchasingEntity.contact?.customer?.displayName || '',
        date: day(d.createdAt),
        amount: Number(d.totalPriceSet.shopMoney.amount),
        lines: d.lineItems.nodes.length,
        po: 'None',
        // `product`: the app's product (its sku), for the limit check.
        items: d.lineItems.nodes.map((li) => ({ sku: li.sku || productOf(li.variant)?.sku || '', product: productOf(li.variant)?.sku || li.sku || '', title: li.title, qty: li.quantity, price: Number(li.originalUnitPriceSet.shopMoney.amount) })),
        buyerMessage: d.note2 || undefined,
        shipping: null,
        pricing: '—',
        pricingSource: '—',
        source: 'Storefront order request',
        status: declined ? 'Declined' : d.status === 'INVOICE_SENT' ? 'Invoice sent' : 'Needs review',
        shopifyStatus: declined ? 'Cancelled' : 'Draft order',
        ...(declined && d.declineMessage?.value ? { declineMessage: d.declineMessage.value } : {}),
        reason: null,
      };
    });
}

// What held each order request (`heldAt`), from the app's own cart check at its
// location — the one the storefront runs: the order value's maximum, else the first
// product's. Mutates `db`.
function stampRequestHolds(db) {
  (db.companies || []).forEach((c) =>
    (c.orders || [])
      .filter((o) => o.draftId && o.locationId)
      .forEach((o) => {
        const spent = spentSoFar((c.orders || []).filter((x) => x !== o && x.locationId === o.locationId && x.date <= o.date), o.date);
        const lines = o.items.map((i) => ({ sku: i.product, title: i.title, qty: i.qty }));
        const reviews = cartProblems(db, c.id, o.locationId, lines, o.amount, spent).filter((p) => p.type === 'review');
        const r = reviews.find((p) => !p.sku) || reviews[0];
        if (r) o.heldAt = { value: r.value, limitId: r.limit.id, limitName: r.limit.name || '', period: r.period || 'order', ...(r.sku ? { sku: r.sku, item: r.item } : {}), ...(r.basis === 'qty' ? { basis: 'qty' } : {}) };
      }),
  );
  return db;
}

const INVOICE_MUTATION = `#graphql
  mutation QsApproveRequest($id: ID!) {
    draftOrderInvoiceSend(id: $id) {
      draftOrder { id status }
      userErrors { field message }
    }
  }`;
const DECLINE_MUTATION = `#graphql
  mutation QsDeclineRequest($id: ID!) {
    tagsAdd(id: $id, tags: ["Declined"]) {
      userErrors { field message }
    }
  }`;

// Approve or decline an order request in Shopify (HeldOrderActions): approving sends
// the draft order's invoice to the buyer; declining tags it "Declined" (the buyer's
// B2B Portal shows it so), keeping the merchant's message for the buyer, if any.
// Throws when Shopify refuses.
export async function reviewRequest(order, approve, message = '') {
  const fail = (errors) => {
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(' · '));
  };
  if (approve) {
    fail((await graphql(INVOICE_MUTATION, { id: order.draftId })).draftOrderInvoiceSend.userErrors);
    return;
  }
  fail((await graphql(DECLINE_MUTATION, { id: order.draftId })).tagsAdd.userErrors);
  if (message) {
    const metafields = [{ ownerId: order.draftId, namespace: NAMESPACE, key: 'decline_message', type: 'multi_line_text_field', value: message }];
    fail((await graphql(SAVE_MUTATION, { metafields })).metafieldsSet.userErrors);
  }
}

// ── The app's records, saved and loaded ────────────────────────────────────
// What the store already holds isn't saved again: products, customers, a company's
// buyers and orders, a location's address — they're read fresh on every load.
const LIVE_ONLY = ['products', 'attention', 'requests', 'health'];
export function appDataOf(db) {
  const out = { v: 1, db: {}, customers: {} };
  Object.entries(db).forEach(([k, v]) => {
    if (!LIVE_ONLY.includes(k) && k !== 'companies' && k !== 'customers') out.db[k] = v;
  });
  out.db.companies = (db.companies || []).map(({ contacts, orders, revenue, exceptions, ...c }) => ({
    ...c,
    locations: (c.locations || []).map(({ buyers, lastOrder, shipping, ...l }) => l),
  }));
  (db.customers || []).forEach((c) => {
    if (c.policyId) out.customers[c.id] = { policyId: c.policyId };
  });
  return out;
}

// A new install: no companies in the app yet, no pricing, limits or contracts.
const emptyDb = () => ({
  defaults: { b2bPolicyId: null, wholesalePolicyId: null },
  companies: [],
  tagPricing: [],
  policies: [],
  limits: [],
  agreements: [],
  quotes: [],
  registrations: [],
  hasRegistrationForm: false,
  registrationFormPublished: false,
  rfqAppInstalled: false,
});

// The app's records with the store's: each company in the app gets its name,
// locations, buyers and orders from Shopify. A location deleted in Shopify stays,
// marked Deleted; one created there joins a company set to add new locations.
export function buildLiveDb(store) {
  const products = toProducts(store.products);
  const directory = toDirectory(store.companies);
  // Collections and the Add companies picker are the store's.
  Object.keys(COLLECTIONS).forEach((k) => delete COLLECTIONS[k]);
  products.forEach((p) => p.collections.forEach((c) => (COLLECTIONS[c] = [...(COLLECTIONS[c] || []), p.sku])));
  Object.keys(CATALOG_PRICES).forEach((k) => delete CATALOG_PRICES[k]);
  shopifyCompanyDirectory.splice(0, shopifyCompanyDirectory.length, ...directory);

  const kept = store.appData?.db || {};
  const db = normalizeDb({ ...emptyDb(), ...kept, products, attention: [], requests: [], health: [] });
  // Registrations, quote requests and quote replies buyers sent since the last load.
  applyBuyerEvents(db, store.buyerEvents);
  db.companies.forEach((c) => {
    const shp = directory.find((s) => s.id === c.shopifyCompanyId);
    if (!shp) {
      c.contacts = [];
      c.orders = [];
      c.revenue = 0;
      c.exceptions = [];
      return;
    }
    c.name = shp.name;
    c.locations.forEach((l) => {
      const sl = shp.locations.find((x) => x.id === l.id);
      if (!sl) {
        l.status = 'Deleted';
        return;
      }
      Object.assign(l, {
        name: sl.name,
        status: 'Active',
        terms: sl.terms,
        ordering: sl.ordering,
        paymentTerms: sl.terms !== 'Not set' ? sl.terms : 'No payment terms',
        purchasingMode: sl.ordering === 'You approve first' ? 'REQUIRE_APPROVAL' : 'DIRECT',
        editableShipping: sl.editableShipping,
        shipping: sl.shipping,
      });
    });
    const fresh = shp.locations.filter((sl) => !c.locations.some((l) => l.id === sl.id));
    if (c.autoAddLocations && fresh.length) {
      joinLaterLocations(db, c, fresh.map((sl) => ({ ...sl, buyers: 0, lastOrder: '—', pricing: { base: null, quantity: null } })));
    }
    const names = c.locations.map((l) => l.name);
    c.contacts = shp.contacts
      .filter((ct) => !ct.location || names.includes(ct.location))
      .map((ct) => ({ name: ct.name, email: ct.email, role: ct.role, access: ct.access, locations: ct.location }));
    c.mainContact = shp.mainContact || c.contacts[0]?.name || '';
    c.orders = companyOrders(store.orders, shp.id, c.locations);
    c.revenue = c.orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.amount, 0);
    c.exceptions = [];
    c.locations.forEach((l) => {
      l.lastOrder = c.orders.find((o) => o.locationId === l.id)?.date || '—';
    });
    // Order requests from the storefront join them, held for review (not in revenue).
    c.orders = [...companyRequests(store.requests || [], shp.id, c.locations, products), ...c.orders];
    recomputeBuyers(c);
  });
  // Customers outside a company, with the pricing the app gave them.
  db.customers = store.customers
    .filter((c) => !(c.companyContactProfiles || []).length)
    .map((c) => {
      const id = `w${numId(c.id)}`;
      return {
        id,
        name: c.displayName || nameless(c.id),
        email: c.defaultEmailAddress?.emailAddress || '',
        status: 'Active',
        source: 'Shopify',
        tags: c.tags || [],
        policyId: store.appData?.customers?.[id]?.policyId || null,
        lastOrder: day(c.lastOrder?.processedAt),
        orders: Number(c.numberOfOrders) || 0,
      };
    });
  return stampRequestHolds(stampContractLimits(syncContractDates(seedSnapshots(ownContractTerms(db)))));
}

// ── What the storefront shows ──────────────────────────────────────────────
// For each company location: the B2B price of each variant the app prices
// differently from Shopify, its quantity prices, and the order limits in force —
// keyed by Shopify ids, the way the theme app extension looks them up. The same
// engine as the app's price preview and order limit checks.
const round = (n) => Math.round(n * 100) / 100;
// A variant's quantity prices: [from, to (null: and up), unit price] — the discount
// off the base or the Shopify price, never above the price the buyer pays anyway.
// `basis`: which quantities count together (all_selected | per_product | per_variant).
function quantityPrices(company, location, product, variant, b2bPrice, policies) {
  const holder = hasOwnSlot(location, 'quantity') ? location : company;
  const q = companyActiveQuantityPolicies(holder, policies).find((p) => quantityInScope(p, product));
  if (!q || !(q.volumeRanges || []).some((r) => Number(r.value))) return null;
  const pays = b2bPrice ?? variant.list;
  const basis = q.volumeBasis === 'base' ? pays : variant.list;
  return {
    name: q.name,
    basis: q.quantityBasis || 'all_selected',
    ranges: q.volumeRanges.map((r) => [
      Number(r.from) || 1,
      r.to == null || r.to === '' ? null : Number(r.to),
      Math.min(pays, round(applyAdjustment('decrease', r.valueType, r.value, basis))),
    ]),
  };
}
// The merchant's own message for a limit, when buyers see it (limits.js ownMessage):
// a product limit's, or an order limit's that sets one thing.
const ownMessage = (limit) =>
  limit?.message && (limit.kind === 'product' || ORDER_FIELDS.filter((f) => settingOf(limit, f).mode === 'set').length === 1) ? limit.message : null;

// The Active contract a company location buys under, as its B2B Portal shows it
// (the prototype's agreementForSession): its number, name, version, dates, the
// pricing it gives and its order limits in the buyer's words. Null without one.
function contractOf(db, contracts, c, l) {
  const ag = contracts.find((a) => a.companyId === c.id && (!a.locationIds || a.locationIds.includes(l.id)));
  if (!ag) return null;
  const limits = (db.limits || []).filter((x) => ag.limitIds.includes(x.id) && x.status === 'Active' && ['company', 'location'].includes(limitLevel(x, c.id, l.id)));
  return {
    number: ag.number,
    name: ag.name,
    version: ag.version,
    dates: ag.dates,
    start: ag.startDate ? fmtDay(ag.startDate) : null,
    end: ag.endDate ? fmtDay(ag.endDate) : null,
    pricing: ag.pricing,
    // Buyer wording for a maximum sent for review; the rest read the same for both sides.
    limits: limits.map((x) =>
      limitRules(x, db)
        .map((r) =>
          r.key === 'thresholdQty' && r.value != null
            ? `Orders over ${r.value} units are sent for approval`
            : r.key?.startsWith('threshold') && r.value != null
              ? `Orders over ${money(r.value).replace(/\.00$/, '')}${r.key.includes('@') ? ` a ${r.key.split('@')[1]}` : ''} are sent for approval`
              : r.text,
        )
        .join(' · '),
    ),
  };
}

export function storefrontOf(db, currency = 'USD') {
  setContractPricing(liveContractPricing(db));
  const contracts = storefrontContracts(db);
  const locations = {};
  (db.companies || []).forEach((c) => {
    (c.locations || []).filter((l) => l.status !== 'Deleted').forEach((l) => {
      // prices: variant → [price, the pricing that sets it (its index in `pricings`)].
      const prices = {};
      const pricings = [];
      const tiers = {};
      (db.products || []).forEach((p) => {
        productVariants(p).forEach((v) => {
          const price = resolvedPriceFor(c, p, db.policies, v, l);
          if (price != null && price !== v.list) {
            const name = resolveDetail(c, p, db.policies, v, l).policy?.name || '';
            if (!pricings.includes(name)) pricings.push(name);
            prices[v.gid] = [price, pricings.indexOf(name)];
          }
          const qty = quantityPrices(c, l, p, v, price, db.policies);
          if (qty) tiers[v.gid] = qty;
        });
      });
      const rec = effectiveRules(db, c.id, l.id);
      const order = {};
      const messages = {};
      Object.entries(rec.settings).forEach(([key, s]) => {
        if (s.mode !== 'set' || !(Number(s.value) > 0)) return;
        order[key] = Number(s.value);
        if (ownMessage(s.limit)) messages[key] = ownMessage(s.limit);
      });
      const products = {};
      (db.products || []).forEach((p) => {
        const r = productRuleFor(db, c.id, l.id, p.sku);
        if (!r) return;
        const e = rec.products[p.sku] || rec.products['*'];
        const message = ownMessage((e.min || e.max || e.increment)?.limit);
        products[p.gid] = message ? { ...r, message } : r;
      });
      const contract = contractOf(db, contracts, c, l);
      locations[locationGid(l.id)] = { company: c.name, location: l.name, pricings, prices, tiers, order, messages, products, ...(contract ? { contract } : {}) };
    });
  });
  return { v: 1, currency, locations };
}

// ── Saving ──────────────────────────────────────────────────────────────────
// Saves what changed since the last save. Throws when Shopify refuses it.
export async function saveLive(installationId, db, currency) {
  const app = JSON.stringify(appDataOf(db));
  const storefront = JSON.stringify(storefrontOf(db, currency));
  const metafields = [];
  if (app !== saved.app) metafields.push({ ownerId: installationId, namespace: NAMESPACE, key: APP_DATA_KEY, type: 'json', value: app });
  if (storefront !== saved.storefront) metafields.push({ ownerId: installationId, namespace: NAMESPACE, key: STOREFRONT_KEY, type: 'json', value: storefront });
  if (!metafields.length) return false;
  metafields.forEach((m) => {
    if (new Blob([m.value]).size > MAX_JSON) throw new Error('The app’s data is over Shopify’s 128 KB limit');
  });
  const data = await graphql(SAVE_MUTATION, { metafields });
  const errors = data.metafieldsSet.userErrors;
  if (errors.length) throw new Error(errors.map((e) => e.message).join(' · '));
  saved = { app, storefront };
  return true;
}
