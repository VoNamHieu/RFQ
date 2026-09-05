import React from 'react';
import { Modal, BlockStack, InlineStack, InlineGrid, Box, Text, Badge, Button, Banner, Checkbox, Select, TextField, Divider } from '@shopify/polaris';
import { useStore, handoffToB2B } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/companies.js';

const ROLES = [
  { label: 'Ordering only', value: 'Ordering only' },
  { label: 'Location admin', value: 'Location admin' },
];
const PAYMENT_TERMS = ['No payment terms', 'Due on receipt', 'Net 15', 'Net 30', 'Net 60'].map((t) => ({ label: t, value: t }));

const locationsOf = (company) =>
  company
    ? company.locationList || (company.locationSummary && company.locationSummary !== 'Company location' ? [company.locationSummary] : [])
    : [];

export function SyncFlowModals() {
  const { state, dispatch } = useStore();
  const sf = state.syncFlow;
  if (!sf) return null;

  const quote = state.quotes[sf.quoteId];
  const isMember = quote?.syncMode === 'fixed'; // deterministic company (Case 1/2)
  const isIndependent = !isMember; // selector (Case 3/4)
  const company = sf.companyKey ? shopifyCompanyDirectory[sf.companyKey] : null;
  const alreadyInB2B = !!company?.inB2B;
  const buyer = quote?.customer?.name || 'the requester';

  const baseLocations = locationsOf(company);
  const allLocations = [...baseLocations, ...(sf.createdLocations || []).map((l) => l.name)];
  const locCount = allLocations.length || 1;
  const baseBuyers = company ? company.buyerList?.length ?? company.buyers ?? 1 : 0;
  const buyersPill = baseBuyers + (isIndependent && !alreadyInB2B ? 1 : 0);
  const companyAutoSyncs = !!(company?.autoSyncEnabled || state.autoSyncCompanies?.[sf.companyKey]);
  const isReco = isIndependent && !!sf.companyKey && sf.companyKey === quote?.recommendedKey;
  const showAssign = isIndependent; // location picker only for independent requesters

  const close = () => dispatch({ type: 'SYNC_CLOSE' });

  // ── Step 1: choose / confirm the company ───────────────────────────────────
  if (sf.step === 'sync') {
    const companyOptions = Object.entries(shopifyCompanyDirectory)
      .filter(([k]) => k !== 'testnoapp')
      .map(([k, c]) => ({ label: c.inB2B ? `${c.name} · Already in B2B app` : c.name, value: k }));
    const selectLabel = isReco
      ? `Recommended Shopify company${alreadyInB2B ? ' · already in B2B app' : ''}`
      : 'Shopify company';

    return (
      <Modal
        open
        onClose={close}
        title="Sync Shopify company to B2B"
        primaryAction={{ content: 'Review', disabled: !company, onAction: () => dispatch({ type: 'SYNC_GOTO', step: 'review' }) }}
        secondaryActions={[{ content: 'Cancel', onAction: close }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Zone — the company to sync. */}
            {isMember ? (
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="span" tone="subdued" variant="bodySm" fontWeight="medium">Company</Text>
                  <Text as="span" variant="headingMd">{company?.name}</Text>
                </BlockStack>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <KvItem align="start" label="Shopify Company ID" value={company?.shopifyId} />
                  <KvItem align="center" label="Main contact" value={buyer} />
                  <KvItem align="end" label="Locations" value={`${locCount} location${locCount === 1 ? '' : 's'}`} />
                </InlineGrid>
              </BlockStack>
            ) : (
              // Independent: lead with the recommended company + signals; dropdown to change.
              <BlockStack gap="200">
                <BlockStack gap="050">
                  <Text as="span" tone="subdued" variant="bodySm" fontWeight="medium">{selectLabel}</Text>
                  {company ? <Text as="span" variant="headingMd">{company.name}</Text> : null}
                </BlockStack>
                {isReco && company?.signals?.length ? (
                  <InlineStack gap="100">
                    {company.signals.map((s) => (
                      <Badge key={s} tone="info" size="small">{s}</Badge>
                    ))}
                  </InlineStack>
                ) : null}
                <Select
                  label="Select a Shopify company"
                  placeholder="Select a Shopify company…"
                  options={companyOptions}
                  value={sf.companyKey}
                  onChange={(v) => dispatch({ type: 'SYNC_PATCH', patch: { companyKey: v, location: '', createdLocations: [] } })}
                />
              </BlockStack>
            )}

            {/* Consequence of the sync. */}
            {company ? (
              <Text as="p" tone="subdued" variant="bodySm">
                {alreadyInB2B
                  ? `Adds ${buyer} to ${company.name} in B2B. Existing company data won’t be re-synced.`
                  : `Creates the full company in QuoteSnap B2B, including all ${locCount} location${locCount === 1 ? '' : 's'} and its buyers.`}
              </Text>
            ) : (
              <Text as="p" tone="subdued" variant="bodySm">
                Select the Shopify company this requester belongs to, or create a new one.
              </Text>
            )}

            {/* Zone 3 — create-company fallback (independent only; god file inline row). */}
            {isIndependent ? (
              <>
                <Divider />
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <Text as="span" tone="subdued" variant="bodySm">No suitable Shopify company?</Text>
                  <Button onClick={() => dispatch({ type: 'OPEN_CREATE_COMPANY', quoteId: sf.quoteId })}>Create new company</Button>
                </InlineStack>
              </>
            ) : null}
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // ── Step 2a: create a new location (from the review step) ───────────────────
  if (sf.step === 'createLocation') {
    const nl = sf.newLocation || {};
    const patch = (p) => dispatch({ type: 'SYNC_LOCATION_PATCH', patch: p });
    return (
      <Modal
        open
        onClose={close}
        title="Create a location"
        primaryAction={{ content: 'Add location', disabled: !(nl.name || '').trim(), onAction: () => dispatch({ type: 'SYNC_LOCATION_ADD' }) }}
        secondaryActions={[{ content: 'Back', onAction: () => dispatch({ type: 'SYNC_GOTO', step: 'review' }) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Location name" value={nl.name || ''} onChange={(v) => patch({ name: v })} autoComplete="off" requiredIndicator />
            <TextField label="Location ID (optional)" value={nl.locationId || ''} onChange={(v) => patch({ locationId: v })} autoComplete="off" />
            <Divider />
            <Text as="span" variant="headingSm">Address</Text>
            <TextField label="Address" value={nl.address1 || ''} onChange={(v) => patch({ address1: v })} autoComplete="off" />
            <InlineGrid columns={2} gap="300">
              <TextField label="City" value={nl.city || ''} onChange={(v) => patch({ city: v })} autoComplete="off" />
              <TextField label="Postal code" value={nl.postal || ''} onChange={(v) => patch({ postal: v })} autoComplete="off" />
              <TextField label="Country" value={nl.country || ''} onChange={(v) => patch({ country: v })} autoComplete="off" />
              <TextField label="Phone" value={nl.phone || ''} onChange={(v) => patch({ phone: v })} autoComplete="off" />
            </InlineGrid>
            <Divider />
            <Select
              label="Order submission"
              options={[
                { label: 'Buy directly', value: 'direct' },
                { label: 'Require merchant approval (draft)', value: 'draft' },
              ]}
              value={nl.checkoutToDraft ? 'draft' : 'direct'}
              onChange={(v) => patch({ checkoutToDraft: v === 'draft' })}
            />
            <Select label="Payment terms" options={PAYMENT_TERMS} value={nl.paymentTerms || 'No payment terms'} onChange={(v) => patch({ paymentTerms: v })} />
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // ── Step 2: review + assign ────────────────────────────────────────────────
  if (sf.step === 'review') {
    const addBuyerOnly = isIndependent && alreadyInB2B; // Case 4
    const memberSync = isMember; // Case 1
    const title = addBuyerOnly ? `Add ${buyer} to ${company?.name}?` : `Sync ${company?.name} to B2B?`;
    const cta = addBuyerOnly ? 'Add buyer' : memberSync ? 'Sync company' : 'Sync company & add buyer';
    const banner = addBuyerOnly
      ? `${company?.name} is already in B2B — only ${buyer} will be added to the selected location. Existing company data won’t be re-synced.`
      : memberSync
        ? `Creates the full company in B2B, including all ${locCount} location${locCount === 1 ? '' : 's'} and existing buyers.`
        : `Syncs the whole company to B2B, then adds ${buyer} to the selected location.`;

    return (
      <Modal
        open
        onClose={close}
        title={title}
        primaryAction={{ content: cta, onAction: () => dispatch({ type: 'SYNC_CONFIRM' }) }}
        secondaryActions={[{ content: 'Back', onAction: () => dispatch({ type: 'SYNC_GOTO', step: 'sync' }) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone={addBuyerOnly ? 'info' : 'success'}>{banner}</Banner>
            <BlockStack gap="150">
              <Kv label="Company" value={company?.name} />
              <Kv label="Company ID" value={String(company?.shopifyId || '')} />
              {memberSync ? (
                <Kv label="Assigned location" value={baseLocations[0] || company?.locationSummary || '—'} />
              ) : (
                <Kv label="Locations" value={allLocations.join(', ') || '—'} />
              )}
              <Kv label="Main contact" value={company?.mainContact} />
              <Kv label="Auto-sync future quotes" value={sf.autoSync ? 'On' : 'Off'} />
            </BlockStack>

            {showAssign ? (
              <>
                <Divider />
                <Select
                  label="Add buyer to location"
                  options={allLocations.map((l) => ({ label: l, value: l }))}
                  value={sf.location || allLocations[0] || ''}
                  onChange={(v) => dispatch({ type: 'SYNC_PATCH', patch: { location: v } })}
                />
                <Select
                  label="Role"
                  options={ROLES}
                  value={sf.role}
                  onChange={(v) => dispatch({ type: 'SYNC_PATCH', patch: { role: v } })}
                />
                <Box>
                  <Button variant="plain" onClick={() => dispatch({ type: 'SYNC_LOCATION_NEW' })}>
                    + Create new location
                  </Button>
                </Box>
              </>
            ) : null}
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // ── Step 3: success ────────────────────────────────────────────────────────
  return (
    <Modal
      open
      onClose={close}
      title={alreadyInB2B ? 'Buyer added' : 'Sync complete'}
      primaryAction={{ content: 'View in B2B app', onAction: () => handoffToB2B(state, sf.quoteId) }}
      secondaryActions={[{ content: 'Stay in RFQ', onAction: close }]}
    >
      <Modal.Section>
        <BlockStack gap="300" inlineAlign="center">
          <Badge tone="success">Done</Badge>
          <Text as="p" alignment="center">
            {alreadyInB2B
              ? `${buyer} added to ${company?.name}${sf.location ? ` · ${sf.location}` : ''}.`
              : `${company?.name} is now managed in the B2B app${sf.location ? `, ${buyer} added to ${sf.location}` : ''}.`}
          </Text>
          {!alreadyInB2B ? (
            <InlineStack gap="200" blockAlign="center">
              <Badge>{`${locCount} location${locCount === 1 ? '' : 's'}`}</Badge>
              <Badge>{`${buyersPill} buyer${buyersPill === 1 ? '' : 's'}`}</Badge>
            </InlineStack>
          ) : null}
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

// A key/value cell for the sync modal's company grid.
function KvItem({ label, value, align = 'start' }) {
  return (
    <BlockStack gap="050" inlineAlign={align}>
      <Text as="span" tone="subdued" variant="bodySm" alignment={align}>{label}</Text>
      <Text as="span" variant="bodyMd" alignment={align}>{value || '—'}</Text>
    </BlockStack>
  );
}
