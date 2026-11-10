import {DEMO_MODE} from './config.js';
import {qsFetch} from './http.js';
import {DEMO_QUOTES} from './demo-data.js';

const wait = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

export async function loadQuotes(context = {}) {
  if (DEMO_MODE) {
    await wait();
    return DEMO_QUOTES.map((quote) => ({...quote, lines: quote.lines.map((line) => ({...line}))}));
  }

  const params = new URLSearchParams();
  if (context.companyId) params.set('companyId', context.companyId);
  if (context.locationId) params.set('locationId', context.locationId);
  const data = await qsFetch(`/api/customer/quotes?${params.toString()}`);
  return data.quotes || [];
}

export async function acceptQuote(quoteId, context = {}) {
  if (DEMO_MODE) {
    await wait();
    return {status: 'Accepted', savedToPricing: true};
  }

  return qsFetch(`/api/customer/quotes/${encodeURIComponent(quoteId)}/accept`, {
    method: 'POST',
    body: JSON.stringify(context),
  });
}

export async function sendCounter(quoteId, unitPrice, context = {}) {
  if (DEMO_MODE) {
    await wait();
    return {status: 'Counter sent', savedToPricing: false, counterUnitPrice: Number(unitPrice)};
  }

  return qsFetch(`/api/customer/quotes/${encodeURIComponent(quoteId)}/counter`, {
    method: 'POST',
    body: JSON.stringify({...context, unitPrice: Number(unitPrice)}),
  });
}
