import React from 'react';
import { Modal, BlockStack, Text } from '@shopify/polaris';
import { useStore, handoffToB2B } from '../store.jsx';

// The god-file "Company created" success modal, shown after creating a new company
// in B2B from a quote. Re-imported so the confirmation isn't lost to a bare toast.
// "View in B2B app" hands off to the B2B app; "Stay in RFQ" just closes it.
export function CompanyCreatedModal() {
  const { state, dispatch } = useStore();
  const cc = state.companyCreated;
  if (!cc) return null;
  const close = () => dispatch({ type: 'CLOSE_COMPANY_CREATED' });
  return (
    <Modal
      open
      onClose={close}
      title="Company created"
      primaryAction={{ content: 'View in B2B app', onAction: () => handoffToB2B(state, cc.quoteId) }}
      secondaryActions={[{ content: 'Stay in RFQ', onAction: close }]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">{`${cc.name} created in B2B app`}</Text>
          <Text as="p" tone="subdued">
            The full Shopify company is now available in the QuoteSnap B2B app.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
