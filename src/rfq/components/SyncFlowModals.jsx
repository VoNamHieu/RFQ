import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Badge, Button, Banner, Checkbox, Select, Divider } from '@shopify/polaris';
import { useStore, handoffToB2B } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/companies.js';

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
      primaryAction={{ content: 'View in B2B app', onAction: () => handoffToB2B(state, sf.quoteId) }}
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
