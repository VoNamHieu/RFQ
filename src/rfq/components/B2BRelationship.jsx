import React from 'react';
import { Card, BlockStack, InlineStack, InlineGrid, Box, Text, Badge, Button, Banner, Divider } from '@shopify/polaris';
import { useStore, handoffToB2B } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/companies.js';
import { money2 } from '../utils.js';

const quoteValueOf = (quote) => {
  const lines = quote.lines && quote.lines.length
    ? quote.lines
    : [{ price: quote.product?.price, qty: quote.product?.quantity ?? 1 }];
  return lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty ?? l.quantity) || 1), 0);
};

function SummaryRow({ label, value }) {
  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text as="span" tone="subdued" variant="bodySm">{label}</Text>
      <Text as="span" variant="bodyMd" fontWeight="medium">{value}</Text>
    </InlineStack>
  );
}

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
  const companyName = company?.name || quote.createdCompanyName || '—';
  const locations = company?.locations ?? 1;
  const buyers = company?.buyers ?? 1;
  const managedBanner =
    state === 'shopifySynced' ? (
      <Banner tone="success">
        {quote.quoteAutoSyncEnabled
          ? `${companyName} is available in B2B. Future quotes from any buyer across all Company locations sync automatically.`
          : `${companyName} is available in B2B. This RFQ and future quotes stay in QuoteSnap RFQ until quote sync is enabled.`}
      </Banner>
    ) : null;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">B2B relationship</Text>
          <Badge tone="success">Managed</Badge>
        </InlineStack>
        <BlockStack gap="150">
          <SummaryRow label="Company" value={companyName} />
          <SummaryRow label="Locations" value={String(locations)} />
          <SummaryRow label="Buyers" value={String(buyers)} />
          <SummaryRow label="Quoted value" value={money2(quoteValueOf(quote))} />
          {company?.shopifyId ? (
            <Text as="span" tone="subdued" variant="bodySm">{`Shopify company ${company.shopifyId}`}</Text>
          ) : (
            <Text as="span" tone="subdued" variant="bodySm">Newly created company</Text>
          )}
        </BlockStack>
        {managedBanner}
        <Divider />
        <InlineStack gap="200">
          <Button variant="primary" onClick={() => handoffToB2B(rfqState, quote.number)}>
            {state === 'linked' ? 'View in B2B app' : 'Open in B2B app'}
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

