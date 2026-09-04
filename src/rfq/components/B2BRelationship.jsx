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
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingSm">B2B relationship</Text>
            <Badge>App not installed</Badge>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">
            Install QuoteSnap B2B to manage this buyer as a company with shared pricing and quote history.
          </Text>
          <InlineGrid columns={2} gap="200">
            <Stat label="Quotes" value={String(quote.quoteCount ?? 1)} />
            <Stat label="Quoted value" value={money2(quoteValueOf(quote))} />
          </InlineGrid>
          <InlineStack gap="200">
            <Button onClick={() => dispatch({ type: 'INSTALL_B2B', id: quote.number })}>Install QuoteSnap B2B</Button>
            <Button variant="tertiary" onClick={() => dispatch({ type: 'TOAST', message: 'Learn more' })}>Learn more</Button>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">Prefills your first company on install — nothing created automatically.</Text>
        </BlockStack>
      </Card>
    );
  }

  if (state === 'new') {
    // Member (syncMode 'fixed') → the company is deterministic; independent
    // (selector) → the merchant still has to pick, so it reads "not identified"
    // and does NOT assert the company's B2B status (mirrors the god file).
    const isMember = quote.syncMode === 'fixed';
    const memberCompany = isMember ? company : null;
    return (
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingSm">B2B relationship</Text>
            <Badge tone={isMember ? 'attention' : 'info'}>{isMember ? 'Not in B2B app' : 'Company not identified'}</Badge>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">
            {isMember && memberCompany
              ? `Sync ${memberCompany.name} to QuoteSnap B2B app to bring in the full company, including company information, locations, and buyers.`
              : 'No company has been identified for this requester yet. Select a Shopify company to continue syncing to QuoteSnap B2B app.'}
          </Text>
          <InlineGrid columns={3} gap="200">
            <Stat label="Quotes" value={String(quote.quoteCount ?? 1)} />
            <Stat label="Quoted value" value={money2(quoteValueOf(quote))} />
            <Stat label="Company" value={isMember && memberCompany ? memberCompany.name : 'Not selected'} />
          </InlineGrid>
          <Button onClick={() => dispatch({ type: 'SYNC_OPEN', id: quote.number })}>
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
          <Button onClick={() => handoffToB2B(rfqState, quote.number)}>
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

