import React from 'react';
import { Card, BlockStack, InlineStack, InlineGrid, Box, Text, Badge, Button, Banner } from '@shopify/polaris';
import { useStore, handoffToB2B } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/companies.js';

// The RFQ↔B2B relationship card. The sync flow and the create-company overlay it
// launches live in sibling files; re-exported so callers keep one import.
export { SyncFlowModals } from './SyncFlowModals.jsx';
export { CreateCompanyModal } from './CreateCompanyModal.jsx';

function companyKeyOf(quote) {
  return (
    quote.syncedCompanyKey ||
    quote.linkedCompanyKey ||
    quote.fixedCompanyKey ||
    quote.recommendedKey ||
    quote.previewCompanyKey ||
    null
  );
}

// Right-column B2B relationship card (spec §5.6): four states.
export function B2BRelationshipCard({ quote }) {
  const { state: rfqState, dispatch } = useStore();
  const key = companyKeyOf(quote);
  const company = key ? shopifyCompanyDirectory[key] : null;
  const state = quote.state;

  if (state === 'uninstalled') {
    return (
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            Wholesale B2B Solution
          </Text>
          <Badge>App not installed</Badge>
          <Text as="p" tone="subdued" variant="bodySm">
            Install the B2B app to turn this requester into a managed company with its own pricing.
          </Text>
          <InlineGrid columns={2} gap="200">
            <Stat label="Open quotes" value="12" />
            <Stat label="Est. B2B revenue" value="$48k" />
          </InlineGrid>
          <InlineStack gap="200">
            <Button variant="primary" onClick={() => dispatch({ type: 'INSTALL_B2B', id: quote.number })}>
              Install
            </Button>
            <Button variant="tertiary" onClick={() => dispatch({ type: 'TOAST', message: 'Learn more' })}>
              Learn more
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  if (state === 'new') {
    const named = quote.syncMode === 'fixed' && company;
    return (
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            B2B
          </Text>
          <Badge tone="attention">Not in B2B app</Badge>
          <Text as="p" tone="subdued" variant="bodySm">
            {named
              ? `${company.name} is a Shopify company but isn’t in the B2B app yet. Sync it to manage its pricing.`
              : 'This requester’s company isn’t in the B2B app yet. Identify or create it to manage pricing.'}
          </Text>
          <Button variant="primary" onClick={() => dispatch({ type: 'SYNC_OPEN', id: quote.number })}>
            Sync to B2B app
          </Button>
        </BlockStack>
      </Card>
    );
  }

  // shopifySynced or linked → managed
  const managedBanner =
    state === 'shopifySynced' ? (
      <Banner tone="success">
        {quote.quoteAutoSyncEnabled
          ? 'Synced. New quotes for this company auto-sync to B2B.'
          : 'Synced to the B2B app.'}
      </Banner>
    ) : null;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          B2B
        </Text>
        <Badge tone="success">Managed in B2B</Badge>
        {(company || quote.createdCompanyName) && (
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {company?.name || quote.createdCompanyName}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {company?.shopifyId ? `Company ${company.shopifyId}` : 'Newly created company'}
            </Text>
          </BlockStack>
        )}
        {managedBanner}
        <InlineStack gap="200">
          <Button onClick={() => handoffToB2B(rfqState, quote.number)}>
            {state === 'linked' ? 'View in B2B' : 'Open in B2B'}
          </Button>
          <Button variant="tertiary" onClick={() => dispatch({ type: 'TOAST', message: 'Opens in Shopify' })}>
            Open in Shopify
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <Box background="bg-surface-secondary" padding="200" borderRadius="200">
      <BlockStack gap="050">
        <Text as="span" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="span" variant="headingMd">
          {value}
        </Text>
      </BlockStack>
    </Box>
  );
}

