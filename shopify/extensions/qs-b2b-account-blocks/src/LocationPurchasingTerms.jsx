import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {getBusinessSummary} from './api.js';

export default async () => {
  render(<LocationPurchasingTerms />, document.body);
};

function LocationPurchasingTerms() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const company = purchasingCompany?.company;
  const locationId = shopify.locationId;
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!company) return;
    getBusinessSummary({companyId: company.id, locationId}).then(setSummary).catch(() => setSummary(null));
  }, [company?.id, locationId]);

  if (!company || !summary) return null;

  return (
    <s-section>
      <s-stack direction="block" gap="small">
        <s-heading>Purchasing terms</s-heading>
        {summary.paymentTerms ? <s-text>Payment terms: {summary.paymentTerms}</s-text> : null}
        {summary.purchasingMode ? <s-text>Ordering: {summary.purchasingMode}</s-text> : null}
        {summary.pricingActive ? <s-text>Company pricing is active for this location.</s-text> : null}
      </s-stack>
    </s-section>
  );
}
