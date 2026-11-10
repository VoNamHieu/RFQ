import {DEMO_MODE} from './config.js';
import {qsFetch} from './http.js';

const wait = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createQuoteFromOrder(payload) {
  if (DEMO_MODE) {
    await wait();
    return {quoteId: 'Q-2077', status: 'Pending'};
  }

  return qsFetch('/api/customer/order-quotes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
