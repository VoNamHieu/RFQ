import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<PortalLinkBlock />, document.body);
};

function PortalLinkBlock() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const company = purchasingCompany?.company;
  const location = purchasingCompany?.location;

  const message = company
    ? `Quotes and business pricing for ${company.name}${location?.name ? ` · ${location.name}` : ''}`
    : 'Manage your quotes and business purchasing';

  return (
    <s-section>
      <s-stack direction="inline" gap="small" justifyContent="center" alignItems="center">
        <s-text>{message}</s-text>
        <s-link onClick={() => shopify.navigation.navigate('extension:qs-b2b-portal')}>Open B2B Portal</s-link>
      </s-stack>
    </s-section>
  );
}
