import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {getRegistrationStatus} from './api.js';

export default async () => {
  render(<ProfileRegistration />, document.body);
};

function ProfileRegistration() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (purchasingCompany) return;
    getRegistrationStatus().then(setStatus).catch(() => setStatus({status: 'none'}));
  }, [Boolean(purchasingCompany)]);

  if (purchasingCompany) return null;
  if (!status) return <s-spinner accessibilityLabel="Loading business registration" />;

  if (status.status === 'pending') {
    return (
      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-heading>Business account</s-heading>
            <s-badge tone="info">Pending review</s-badge>
          </s-stack>
          <s-text>{status.application?.legalName || 'Your business application'} is being reviewed.</s-text>
          <s-button onClick={() => shopify.navigation.navigate('extension:qs-b2b-registration')}>View application</s-button>
        </s-stack>
      </s-section>
    );
  }

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-heading>Buying for a business?</s-heading>
        <s-text>Apply for company pricing, volume pricing, and B2B purchasing.</s-text>
        <s-button variant="primary" onClick={() => shopify.navigation.navigate('extension:qs-b2b-registration')}>
          Apply for business account
        </s-button>
      </s-stack>
    </s-section>
  );
}
