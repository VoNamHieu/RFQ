import React from 'react';
import { Modal, BlockStack, InlineStack, InlineGrid, Box, Text, Checkbox, RadioButton, Select, Divider, TextField } from '@shopify/polaris';
import { useStore } from '../store.jsx';

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
