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
  RadioButton,
  Select,
  Divider,
  TextField,
} from '@shopify/polaris';
import { useStore, handoffToB2B } from '../store.jsx';
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

const COUNTRIES = [
  { value: 'VN', label: 'Vietnam' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
];
const PAYMENT_TERMS = ['No payment terms', 'Due immediately', 'Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];
const TAX_SETTINGS = [
  { value: 'collect', label: 'Collect tax' },
  { value: 'collect_unless_exempt', label: 'Collect tax unless exemptions apply' },
  { value: 'exempt', label: 'Do not collect tax' },
];

// Reusable address editor for the shipping/billing sections.
function AddressFields({ value, onChange }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <BlockStack gap="300">
      <Select label="Country/region" options={COUNTRIES} value={value.country || 'VN'} onChange={set('country')} />
      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
        <TextField label="First name" value={value.firstName || ''} onChange={set('firstName')} autoComplete="off" />
        <TextField label="Last name" value={value.lastName || ''} onChange={set('lastName')} autoComplete="off" />
      </InlineGrid>
      <TextField label="Company / attention" value={value.company || ''} onChange={set('company')} autoComplete="off" />
      <TextField label="Address" value={value.address1 || ''} onChange={set('address1')} autoComplete="off" />
      <TextField label="Apartment, suite, etc." value={value.address2 || ''} onChange={set('address2')} autoComplete="off" />
      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
        <TextField label="City" value={value.city || ''} onChange={set('city')} autoComplete="off" />
        <TextField label="Postal code" value={value.postal || ''} onChange={set('postal')} autoComplete="off" />
      </InlineGrid>
      <TextField label="Phone" value={value.phone || ''} onChange={set('phone')} autoComplete="off" />
    </BlockStack>
  );
}

// "Create new company" overlay from the sync flow (spec §5.7 / §2.4) — full form.
export function CreateCompanyModal() {
  const { state, dispatch } = useStore();
  const cc = state.createCompany;
  if (!cc) return null;
  const patch = (p) => dispatch({ type: 'CREATE_COMPANY_PATCH', patch: p });
  const ship = cc.ship || {};

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
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">Company details</Text>
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
            <TextField label="Company name" value={cc.name} onChange={(v) => patch({ name: v })} autoComplete="off" />
            <TextField label="Company ID" placeholder="Optional" value={cc.externalId} onChange={(v) => patch({ externalId: v })} autoComplete="off" />
          </InlineGrid>
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm">Company location — shipping address</Text>
            <Checkbox label="No shipping address" checked={!!cc.noShipping} onChange={(v) => patch({ noShipping: v })} />
          </InlineStack>
          {cc.noShipping ? (
            <Text as="p" tone="subdued" variant="bodySm">This company location has no shipping address yet. You can add one later in the B2B app.</Text>
          ) : (
            <AddressFields value={ship} onChange={(v) => patch({ ship: v })} />
          )}
          <TextField label="Location ID" placeholder="Optional external ID" value={cc.locationId} onChange={(v) => patch({ locationId: v })} autoComplete="off" />
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">Billing address</Text>
          <Checkbox label="Billing address same as shipping" checked={cc.billingSame !== false} onChange={(v) => patch({ billingSame: v })} />
          {cc.billingSame === false && <AddressFields value={cc.bill || {}} onChange={(v) => patch({ bill: v })} />}
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">Checkout &amp; payment</Text>
          <BlockStack gap="150">
            <RadioButton
              label="Automatically submit orders"
              checked={!cc.checkoutToDraft}
              id="checkout-direct"
              name="checkout"
              onChange={() => patch({ checkoutToDraft: false })}
            />
            <RadioButton
              label="Submit all orders as drafts for review"
              checked={!!cc.checkoutToDraft}
              id="checkout-draft"
              name="checkout"
              onChange={() => patch({ checkoutToDraft: true })}
            />
          </BlockStack>
          <Checkbox label="Allow buyers to use a one-time shipping address at checkout" checked={!!cc.editableShipping} onChange={(v) => patch({ editableShipping: v })} />
          <Select label="Payment terms" options={PAYMENT_TERMS.map((t) => ({ label: t, value: t }))} value={cc.paymentTerms} onChange={(v) => patch({ paymentTerms: v })} />
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">Tax</Text>
          <Select label="Tax settings" options={TAX_SETTINGS} value={cc.taxSettings} onChange={(v) => patch({ taxSettings: v })} />
          <TextField label="Tax registration ID" placeholder="Optional" value={cc.taxRegistrationId} onChange={(v) => patch({ taxRegistrationId: v })} autoComplete="off" />
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">Initial company contact</Text>
          <Text as="p" variant="bodyMd">{cc.contactName}</Text>
          <Text as="p" tone="subdued" variant="bodySm">{cc.contactEmail}</Text>
          <Checkbox label="Set this requester as the company’s main contact" checked={cc.setMainContact !== false} onChange={(v) => patch({ setMainContact: v })} />
          <Checkbox label="Auto-sync new quotes for this company" checked={!!cc.autoSync} onChange={(v) => patch({ autoSync: v })} />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
