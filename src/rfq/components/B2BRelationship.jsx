import React from 'react';
import {
  Card,
  Modal,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Text,
  Badge,
  Button,
  Banner,
  Checkbox,
  Select,
  Divider,
  TextField,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/companies.js';

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
  const { dispatch } = useStore();
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
          <Button onClick={() => dispatch({ type: 'TOAST', message: 'Opens the B2B app' })}>
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

// Sync → Review → Success flow (spec §5.6).
export function SyncFlowModals() {
  const { state, dispatch } = useStore();
  const sf = state.syncFlow;
  if (!sf) return null;
  const company = shopifyCompanyDirectory[sf.companyKey];
  const alreadyInB2B = !!company?.inB2B;
  const locations = company?.locationList || (company?.locationSummary ? [company.locationSummary] : []);
  const close = () => dispatch({ type: 'SYNC_CLOSE' });

  if (sf.step === 'sync') {
    return (
      <Modal
        open
        onClose={close}
        title={`Sync ${company?.name || 'company'} to B2B`}
        primaryAction={{ content: 'Review', onAction: () => dispatch({ type: 'SYNC_GOTO', step: 'review' }) }}
        secondaryActions={[
          { content: 'Create new company', onAction: () => dispatch({ type: 'OPEN_CREATE_COMPANY', quoteId: sf.quoteId }) },
          { content: 'Cancel', onAction: close },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued" variant="bodySm">
              We matched this requester to a Shopify company. Confirm to bring it into the B2B app.
            </Text>
            <Box borderColor="border" borderWidth="025" borderRadius="200" padding="300">
              <BlockStack gap="100">
                <Text as="span" variant="bodyMd" fontWeight="medium">
                  {company?.name}
                </Text>
                <Text as="span" tone="subdued" variant="bodySm">
                  {`ID ${company?.shopifyId || ''} · ${company?.locationSummary || ''}`}
                </Text>
                {company?.signals?.length ? (
                  <InlineStack gap="100">
                    {company.signals.map((s) => (
                      <Badge key={s} tone="info" size="small">
                        {s}
                      </Badge>
                    ))}
                  </InlineStack>
                ) : null}
              </BlockStack>
            </Box>
            <Checkbox
              label="Auto-sync new quotes for this company"
              checked={sf.autoSync}
              onChange={(v) => dispatch({ type: 'SYNC_PATCH', patch: { autoSync: v } })}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  if (sf.step === 'review') {
    return (
      <Modal
        open
        onClose={close}
        title={`Sync ${company?.name || 'company'} to B2B?`}
        primaryAction={{ content: 'Confirm', onAction: () => dispatch({ type: 'SYNC_CONFIRM' }) }}
        secondaryActions={[{ content: 'Back', onAction: () => dispatch({ type: 'SYNC_GOTO', step: 'sync' }) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone={alreadyInB2B ? 'info' : 'success'}>
              {alreadyInB2B
                ? 'This company is already in B2B — we’ll add this buyer only, no re-sync.'
                : 'We’ll sync the whole company to B2B, then add this buyer to the selected location.'}
            </Banner>
            <BlockStack gap="150">
              <Kv label="Company" value={company?.name} />
              <Kv label="Company ID" value={String(company?.shopifyId || '')} />
              <Kv label="Locations" value={locations.join(', ') || '—'} />
              <Kv label="Main contact" value={company?.mainContact} />
              <Kv label="Auto-sync" value={sf.autoSync ? 'On' : 'Off'} />
            </BlockStack>
            {!alreadyInB2B && locations.length > 0 && (
              <>
                <Divider />
                <Select
                  label="Add buyer to location"
                  options={locations.map((l) => ({ label: l, value: l }))}
                  value={sf.location || locations[0]}
                  onChange={(v) => dispatch({ type: 'SYNC_PATCH', patch: { location: v } })}
                />
                <Select
                  label="Role"
                  options={[
                    { label: 'Ordering only', value: 'Ordering only' },
                    { label: 'Location admin', value: 'Location admin' },
                  ]}
                  value={sf.role}
                  onChange={(v) => dispatch({ type: 'SYNC_PATCH', patch: { role: v } })}
                />
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // success
  return (
    <Modal
      open
      onClose={close}
      title={alreadyInB2B ? 'Buyer added' : 'Sync complete'}
      primaryAction={{ content: 'View in B2B app', onAction: () => dispatch({ type: 'TOAST', message: 'Opens the B2B app' }) }}
      secondaryActions={[{ content: 'Stay in RFQ', onAction: close }]}
    >
      <Modal.Section>
        <BlockStack gap="200" inlineAlign="center">
          <Badge tone="success">Done</Badge>
          <Text as="p" alignment="center">
            {company?.name} is now managed in the B2B app
            {!alreadyInB2B && sf.location ? `, buyer added to ${sf.location}.` : '.'}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function Kv({ label, value }) {
  return (
    <InlineStack align="space-between">
      <Text as="span" tone="subdued" variant="bodySm">
        {label}
      </Text>
      <Text as="span" variant="bodySm">
        {value || '—'}
      </Text>
    </InlineStack>
  );
}

// "Create new company" overlay from the sync flow (spec §5.7 / §2.4).
export function CreateCompanyModal() {
  const { state, dispatch } = useStore();
  const cc = state.createCompany;
  if (!cc) return null;
  const patch = (p) => dispatch({ type: 'CREATE_COMPANY_PATCH', patch: p });

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_CREATE_COMPANY' })}
      title="Create a company in B2B"
      size="large"
      primaryAction={{ content: 'Create company', onAction: () => dispatch({ type: 'CREATE_COMPANY_CONFIRM' }), disabled: !cc.name.trim() }}
      secondaryActions={[{ content: 'Back to RFQ', onAction: () => dispatch({ type: 'CLOSE_CREATE_COMPANY' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Company details
            </Text>
            <TextField label="Company name" value={cc.name} onChange={(v) => patch({ name: v })} autoComplete="off" />
            <TextField label="Company ID" placeholder="Optional" value={cc.externalId} onChange={(v) => patch({ externalId: v })} autoComplete="off" />
          </BlockStack>
          <Divider />
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Company location
            </Text>
            <TextField label="Address" value={cc.shipAddress} onChange={(v) => patch({ shipAddress: v })} autoComplete="off" />
            <TextField label="City" value={cc.shipCity} onChange={(v) => patch({ shipCity: v })} autoComplete="off" />
          </BlockStack>
          <Divider />
          <BlockStack gap="150">
            <Text as="h3" variant="headingSm">
              Initial company contact
            </Text>
            <Text as="p" variant="bodyMd">
              {cc.contactName}
            </Text>
            <Text as="p" tone="subdued" variant="bodySm">
              {cc.contactEmail} · set as the company’s main contact
            </Text>
          </BlockStack>
          <Divider />
          <Checkbox label="Auto-sync new quotes for this company" checked={cc.autoSync} onChange={(v) => patch({ autoSync: v })} />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
