import {DEMO_MODE} from './config.js';
import {qsFetch} from './http.js';

const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getRegistrationStatus() {
  if (DEMO_MODE) {
    await wait();
    return {status: 'none'};
  }
  return qsFetch('/api/customer/registration');
}

export async function getBusinessSummary(context = {}) {
  if (DEMO_MODE) {
    await wait();
    return {
      pricingActive: true,
      priceListName: 'Distributor Tier 2',
      paymentTerms: 'Net 30',
      purchasingMode: 'Buy directly',
      negotiatedProductCount: 12,
    };
  }

  // The location's Business account terms, as the B2B Portal's (api/customer/portal.js).
  if (!context.locationId) return null;
  const {business} = await qsFetch(`/api/customer/portal?locationId=${encodeURIComponent(context.locationId)}`);
  return {
    pricingActive: !!business?.pricingActive,
    priceListName: business?.pricing || null,
    paymentTerms: business?.paymentTerms || null,
    purchasingMode: business?.ordering || null,
  };
}
