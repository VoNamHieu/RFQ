import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {getBusinessSummary} from './api.js';

export default async () => {
  render(<CompanyPurchasingSummary />, document.body);
};

function CompanyPurchasingSummary() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const company = purchasingCompany?.company;
  const location = purchasingCompany?.location;
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!company) return;
    getBusinessSummary({companyId: company.id, locationId: location?.id}).then(setSummary).catch(() => setSummary(null));
  }, [company?.id, location?.id]);

  if (!company) return null;

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-heading>Business purchasing</s-heading>
          {summary?.pricingActive ? <s-badge tone="success">Company pricing active</s-badge> : null}
        </s-stack>
        <s-text>{company.name}{location?.name ? ` · ${location.name}` : ''}</s-text>
        {summary?.priceListName ? <s-text>Pricing: {summary.priceListName}</s-text> : null}
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" onClick={() => shopify.navigation.navigate('extension:qs-b2b-portal')}>Open B2B Portal</s-button>
          <s-button onClick={() => shopify.navigation.navigate('extension:qs-b2b-quotes')}>View quotes</s-button>
          <s-button onClick={() => shopify.navigation.navigate('shopify:customer-account/orders')}>View orders</s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
