import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState} from 'preact/hooks';
import {createQuoteFromOrder} from './api.js';

export default async () => {
  render(<RequestQuoteAction />, document.body);
};

function RequestQuoteAction() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const company = purchasingCompany?.company;
  const location = purchasingCompany?.location;
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function onSubmit() {
    setLoading(true);
    setError('');
    try {
      const created = await createQuoteFromOrder({
        orderId: shopify.orderId,
        note: note.trim(),
        companyId: company?.id,
        locationId: location?.id,
      });
      setResult(created);
    } catch (err) {
      setError(err.message || 'Unable to create a quote request.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <s-customer-account-action heading="Quote request created">
        <s-stack direction="block" gap="base">
          <s-banner tone="success">{result.quoteId} has been sent to the seller.</s-banner>
          <s-text>You can track the request from Quotes in your customer account.</s-text>
        </s-stack>
        <s-button slot="primary-action" onClick={() => shopify.navigation.navigate('extension:qs-b2b-quotes')}>View quotes</s-button>
        <s-button slot="secondary-actions" onClick={() => shopify.close()}>Close</s-button>
      </s-customer-account-action>
    );
  }

  return (
    <s-customer-account-action heading="Request a quote from this order">
      <s-stack direction="block" gap="base">
        {company ? <s-text>Purchasing for {company.name}{location?.name ? ` · ${location.name}` : ''}.</s-text> : null}
        <s-text>We'll use the products from this order as the starting point for a new quote request.</s-text>
        <s-text-field
          label="Message to seller (optional)"
          value={note}
          onInput={(event) => setNote(event.target.value)}
        />
        {error ? <s-banner tone="critical">{error}</s-banner> : null}
      </s-stack>
      <s-button slot="primary-action" variant="primary" loading={loading} onClick={onSubmit}>Create quote request</s-button>
      <s-button slot="secondary-actions" onClick={() => shopify.close()}>Cancel</s-button>
    </s-customer-account-action>
  );
}
