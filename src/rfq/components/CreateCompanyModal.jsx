import React, { useState, useRef } from 'react';
import { Modal, BlockStack, InlineStack, InlineGrid, Box, Text, Badge, Button, Checkbox, RadioButton, Select, TextField, Collapsible, Icon, Tooltip } from '@shopify/polaris';
import { ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';

const COUNTRIES = [
  { value: 'VN', label: 'Vietnam' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
];
const COUNTRY_LABEL = Object.fromEntries(COUNTRIES.map((c) => [c.value, c.label]));
const FLAGS = { VN: '🇻🇳', US: '🇺🇸', GB: '🇬🇧', SG: '🇸🇬', AU: '🇦🇺' };
const FLAG_OPTIONS = COUNTRIES.map((c) => ({ label: FLAGS[c.value] || c.value, value: c.value }));
const PAYMENT_TERMS = ['No payment terms', 'Due immediately', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];
const TAX_SETTINGS = [
  { value: 'collect', label: 'Collect tax' },
  { value: 'collect_unless_exempt', label: 'Collect tax unless exemptions apply' },
  { value: 'exempt', label: "Don't collect tax" },
];

const emptyAddr = (country = 'VN') => ({ country, firstName: '', lastName: '', company: '', address1: '', address2: '', city: '', postal: '', phone: '', phoneCountry: country });
const addressHasContent = (a = {}) => !!(a.address1 || a.city || a.postal || a.firstName || a.lastName || a.company);
const formatAddress = (a = {}) => {
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ');
  const cityLine = [a.city, a.postal].filter(Boolean).join(', ');
  return [name, a.company, a.address1, a.address2, cityLine, COUNTRY_LABEL[a.country] || a.country].filter(Boolean);
};

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
      <TextField
        label="Phone"
        value={value.phone || ''}
        onChange={set('phone')}
        connectedLeft={<Select label="Phone country" labelHidden options={FLAG_OPTIONS} value={value.phoneCountry || value.country || 'VN'} onChange={set('phoneCountry')} />}
        autoComplete="off"
      />
    </BlockStack>
  );
}

// Address preview (god-file pattern): prefilled from the RFQ, read-only with a note;
// Edit reveals the form, Clear empties it, Discard reverts.
function AddressPreviewPanel({ title, optional, note, value, onChange, addMode }) {
  const [editing, setEditing] = useState(false);
  const snapshot = useRef(null);
  const has = addressHasContent(value);
  const startEdit = () => {
    snapshot.current = value;
    setEditing(true);
  };
  const discard = () => {
    onChange(snapshot.current || emptyAddr(value.country));
    setEditing(false);
  };
  return (
    <Box borderColor="border" borderWidth="025" borderRadius="200" padding="300">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="150" blockAlign="center" wrap={false}>
            <Text as="span" variant="headingSm">{title}</Text>
            {optional ? <Badge size="small">Optional</Badge> : null}
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            {editing ? (
              <>
                <Button variant="plain" onClick={discard}>Discard</Button>
                <Button variant="plain" onClick={() => setEditing(false)}>Done</Button>
              </>
            ) : has ? (
              <>
                <Button variant="plain" tone="critical" onClick={() => onChange(emptyAddr(value.country))}>Clear</Button>
                <Button variant="plain" onClick={startEdit}>Edit</Button>
              </>
            ) : (
              <Button variant="plain" onClick={startEdit}>{addMode ? 'Add' : 'Edit'}</Button>
            )}
          </InlineStack>
        </InlineStack>
        {editing ? (
          <AddressFields value={value} onChange={onChange} />
        ) : (
          <BlockStack gap="050">
            {has ? (
              formatAddress(value).map((line, i) => (
                <Text as="span" key={i} variant="bodyMd">{line}</Text>
              ))
            ) : (
              <Text as="span" tone="subdued" variant="bodyMd">{addMode ? 'No billing address provided.' : 'No shipping address provided.'}</Text>
            )}
            {note && has ? <Text as="span" tone="subdued" variant="bodySm">{note}</Text> : null}
          </BlockStack>
        )}
      </BlockStack>
    </Box>
  );
}

// Collapsed-by-default disclosure for the non-essential ordering/payment/tax fields
// (god-file <details> "Ordering, payment & tax").
function Disclosure({ title, note, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Box borderColor="border" borderWidth="025" borderRadius="200">
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}>
        <Box padding="300">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <BlockStack gap="050">
              <Text as="span" variant="headingSm">{title}</Text>
              {note ? <Text as="span" tone="subdued" variant="bodySm">{note}</Text> : null}
            </BlockStack>
            <InlineStack gap="050" blockAlign="center" wrap={false}>
              <Text as="span" tone="subdued" variant="bodySm">{open ? 'Hide' : 'Edit'}</Text>
              <Icon source={open ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
            </InlineStack>
          </InlineStack>
        </Box>
      </button>
      <Collapsible id="ordering-payment-tax" open={open}>
        <Box padding="300" paddingBlockStart="0">
          {children}
        </Box>
      </Collapsible>
    </Box>
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
          {/* Header row (real layout) with a subtle demo toggle on the right —
              god file: "Demo: simulate an RFQ with no shipping address". */}
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm">Company location</Text>
            <InlineStack gap="150" blockAlign="center" wrap={false}>
              <Tooltip content="Demo: simulate an RFQ that arrived without a shipping address.">
                <Badge tone="info" size="small">Demo</Badge>
              </Tooltip>
              <Checkbox label="No shipping address" checked={!!cc.noShipping} onChange={(v) => patch({ noShipping: v })} />
            </InlineStack>
          </InlineStack>

          {cc.noShipping ? (
            <Text as="p" tone="subdued" variant="bodySm">This company location has no shipping address yet. You can add one later in the B2B app.</Text>
          ) : (
            <AddressPreviewPanel
              title="Shipping address"
              optional
              note="This address is taken from the RFQ request."
              value={cc.ship || emptyAddr()}
              onChange={(v) => patch({ ship: v })}
            />
          )}

          <Checkbox label="Billing address same as shipping address" checked={cc.billingSame !== false} onChange={(v) => patch({ billingSame: v })} />
          {cc.billingSame === false && (
            <AddressPreviewPanel title="Billing address" addMode value={cc.bill || emptyAddr()} onChange={(v) => patch({ bill: v })} />
          )}

          <TextField
            label="Location ID"
            placeholder="ERP / external ID"
            helpText="Add an existing external ID or create a unique ID."
            value={cc.locationId}
            onChange={(v) => patch({ locationId: v })}
            autoComplete="off"
          />

          {/* Non-essential — collapsed by default, like the god file. */}
          <Disclosure title="Ordering, payment & tax" note="Payment terms, tax exemptions, currency and more.">
            <BlockStack gap="300">
              <Checkbox label="Allow buyers to use a one-time shipping address at checkout" checked={!!cc.editableShipping} onChange={(v) => patch({ editableShipping: v })} />
              <BlockStack gap="150">
                <Text as="span" variant="bodyMd" fontWeight="medium">Order submission</Text>
                <RadioButton label="Automatically submit orders" helpText="Orders without shipping addresses are submitted as draft orders." checked={!cc.checkoutToDraft} id="checkout-direct" name="checkout" onChange={() => patch({ checkoutToDraft: false })} />
                <RadioButton label="Submit all orders as drafts for review" checked={!!cc.checkoutToDraft} id="checkout-draft" name="checkout" onChange={() => patch({ checkoutToDraft: true })} />
              </BlockStack>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <Select label="Payment terms" options={PAYMENT_TERMS.map((t) => ({ label: t, value: t }))} value={cc.paymentTerms} onChange={(v) => patch({ paymentTerms: v })} />
                <TextField label="Tax registration ID" placeholder="Tax / VAT ID" value={cc.taxRegistrationId} onChange={(v) => patch({ taxRegistrationId: v })} autoComplete="off" />
              </InlineGrid>
              <Select label="Tax settings" options={TAX_SETTINGS} value={cc.taxSettings} onChange={(v) => patch({ taxSettings: v })} />
            </BlockStack>
          </Disclosure>
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="300">
          <InlineStack gap="150" blockAlign="center">
            <Text as="h3" variant="headingSm">Initial company contact</Text>
            <Badge size="small">Existing Shopify customer</Badge>
          </InlineStack>
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
            <TextField label="Name" value={cc.contactName || ''} disabled autoComplete="off" />
            <TextField label="Email" value={cc.contactEmail || ''} disabled autoComplete="off" />
          </InlineGrid>
          <Checkbox label="Set this requester as the company’s main contact" checked={cc.setMainContact !== false} onChange={(v) => patch({ setMainContact: v })} />
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <Checkbox
          label="Automatically sync future quotes from this company"
          helpText="Future quotes from any buyer in this company, across all locations, will automatically sync to the B2B app."
          checked={!!cc.autoSync}
          onChange={(v) => patch({ autoSync: v })}
        />
      </Modal.Section>
    </Modal>
  );
}
