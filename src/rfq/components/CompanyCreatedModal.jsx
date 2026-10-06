import React from 'react';
import { Modal } from '../../shared/wc.jsx';
import { useStore, handoffToB2B } from '../store.jsx';

// The god-file "Company created" success modal, shown after creating a new company
// in B2B from a quote. Re-imported so the confirmation isn't lost to a bare toast.
// "View in B2B app" hands off to the B2B app; "Stay in RFQ" just closes it.
export function CompanyCreatedModal() {
  const { state, dispatch } = useStore();
  const cc = state.companyCreated;
  if (!cc) return null;
  const close = () => dispatch({ type: 'CLOSE_COMPANY_CREATED' });
  const locations = cc.locations ?? 1;
  const buyers = cc.buyers ?? 1;
  return (
    <Modal size="small" onClose={close} heading="Company created">
      <s-stack gap="small-200">
        <s-heading fontSize="large">{`${cc.name} created in B2B app`}</s-heading>
        <s-paragraph color="subdued">The full Shopify company is now available in the QuoteSnap B2B app.</s-paragraph>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge>{`${locations} location${locations === 1 ? '' : 's'}`}</s-badge>
          <s-badge>{`${buyers} buyer${buyers === 1 ? '' : 's'}`}</s-badge>
        </s-stack>
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={() => handoffToB2B(state, cc.quoteId)}>
        View in B2B app
      </s-button>
      <s-button slot="secondary-actions" onClick={close}>
        Stay in RFQ
      </s-button>
    </Modal>
  );
}
