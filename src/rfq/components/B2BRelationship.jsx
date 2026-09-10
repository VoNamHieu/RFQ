import React from 'react';
import { Card, BlockStack, InlineStack, InlineGrid, Box, Text, Badge, Button, Divider } from '@shopify/polaris';
import { useStore, handoffToB2B, managedCompanyKeyForEmail } from '../store.jsx';
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
export { CompanyCreatedModal } from './CompanyCreatedModal.jsx';

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
            {quote.scenario === 'Merchant created — B2B app not installed'
              ? `${company?.name || 'This company'} isn’t on the Wholesale B2B app yet, so this quote stays in QuoteSnap RFQ. Install the app to manage this buyer as a company with shared pricing and quote history.`
              : 'Install QuoteSnap B2B to manage this buyer as a company with shared pricing and quote history.'}
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

  // The customer is already managed under a company via another quote, but THIS
  // quote isn't linked yet — show a consistent "in B2B" card (not "not identified")
  // so all of a customer's quotes agree on their B2B membership.
  const managedKey = managedCompanyKeyForEmail(rfqState.quotes, quote.customer?.email);
  const selfLinked = !!(quote.syncedCompanyKey || quote.linkedCompanyKey);
  if (state !== 'linked' && state !== 'shopifySynced' && managedKey && !selfLinked) {
    const managed = shopifyCompanyDirectory[managedKey];
    const buyerName = quote.customer?.name || 'This customer';
    return (
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingSm">B2B relationship</Text>
            <Badge tone="info">In B2B app</Badge>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">
            {`${buyerName} is already a buyer at ${managed?.name || 'a company'} in the B2B app. This quote isn’t part of that company’s history yet — sync it to add it.`}
          </Text>
          <BlockStack gap="150">
            <SummaryRow label="Company" value={managed?.name || '—'} />
            <SummaryRow label="Quoted value" value={money2(quoteValueOf(quote))} />
          </BlockStack>
          <InlineStack gap="200">
            <Button onClick={() => dispatch({ type: 'LINK_QUOTE_TO_COMPANY', id: quote.number, companyKey: managedKey })}>
              Update to B2B
            </Button>
            <Button variant="tertiary" onClick={() => handoffToB2B(rfqState, quote.number)}>Open in B2B app</Button>
          </InlineStack>
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

