import {DEMO_MODE} from './config.js';
import {qsFetch} from './http.js';

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

function contextParams(context = {}) {
  const params = new URLSearchParams();
  if (context.companyId) params.set('companyId', context.companyId);
  if (context.locationId) params.set('locationId', context.locationId);
  return params.toString();
}

const ORDERS_QUERY = `query PortalOrders {
  customer {
    emailAddress { emailAddress }
    orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
      nodes {
        id
        name
        processedAt
        cancelledAt
        financialStatus
        fulfillmentStatus
        totalPrice { amount currencyCode }
        purchasingEntity { ... on PurchasingCompany { location { id } } }
        lineItems(first: 10) { nodes { id name quantity image { url } } }
      }
    }
  }
}`;

// The customer's orders, newest first, and their email — from the Customer Account
// API, so they're real in demo mode too.
export async function loadOrders() {
  const response = await fetch('shopify://customer-account/api/2026-07/graphql.json', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: ORDERS_QUERY}),
  });
  const {data, errors} = await response.json();
  if (errors?.length) throw new Error(errors[0].message);
  return {email: data.customer.emailAddress?.emailAddress || null, orders: data.customer.orders.nodes};
}

// What the portal shows for the buyer's company location, from the app's backend
// (api/customer/portal.js): { business, contract, requests }. Real data, also in demo mode.
export function loadPortal(locationId) {
  return qsFetch(`/api/customer/portal?${contextParams({locationId})}`);
}

// The buyer's answer to a contract the seller sent them to approve at their location
// (its Contract proposal card), for the version they see: kind 'approve', or 'changes'
// with what should change. Returns { response } for the card
// (api/customer/contract-response.js).
export function answerContract(locationId, number, version, kind, message = '') {
  return qsFetch('/api/customer/contract-response', {
    method: 'POST',
    body: JSON.stringify({locationId, number, version, kind, message}),
  });
}

export async function getRegistrationStatus() {
  if (DEMO_MODE) {
    await wait();
    return {status: 'none'};
  }
  return qsFetch('/api/customer/registration');
}
