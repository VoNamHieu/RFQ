import React, { useState } from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Select, TextField, Checkbox } from '@shopify/polaris';
import { useStore } from '../store.jsx';

// Shared location constants + the location-detail modals (assign buyer,
// edit general, edit shipping). Split out of LocationDetail.jsx.
export const PAYMENT_TERM_OPTIONS = ['No payment terms', 'Due immediately', 'Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];
export const TAX_SETTINGS = [
  { value: 'collect', label: 'Collect tax' },
  { value: 'collect_unless_exempt', label: 'Collect tax unless exemptions apply' },
  { value: 'exempt', label: 'Do not collect tax' },
];
export const COUNTRY_NAMES = { VN: 'Vietnam', US: 'United States', GB: 'United Kingdom', SG: 'Singapore', AU: 'Australia' };
export const ROLE_OPTIONS = ['Ordering only', 'Location admin'];

export function AssignBuyerModal({ company, location, onClose }) {
  const { dispatch } = useStore();
  const candidates = (company.contacts || []).filter((c) => c.locations !== location.name);
  const [email, setEmail] = useState(candidates[0]?.email || '');
  const [role, setRole] = useState('Ordering only');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign a buyer to ${location.name}`}
      primaryAction={{
        content: 'Assign buyer',
        disabled: !email,
        onAction: () => {
          dispatch({ type: 'ASSIGN_BUYER', companyId: company.id, locationId: location.id, email, role });
          onClose();
        },
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        {candidates.length ? (
          <BlockStack gap="300">
            <Select
              label="Contact"
              options={candidates.map((c) => ({ label: `${c.name} · ${c.email}`, value: c.email }))}
              value={email}
              onChange={setEmail}
              helpText={(() => {
                const c = candidates.find((x) => x.email === email);
                return c && c.locations ? `Currently at ${c.locations}` : 'Not assigned to a location yet';
              })()}
            />
            <Select label="Role" options={ROLE_OPTIONS.map((r) => ({ label: r, value: r }))} value={role} onChange={setRole} />
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued">Every contact is already assigned to this location.</Text>
        )}
      </Modal.Section>
    </Modal>
  );
}

export function GeneralModal({ location, onClose, onSave }) {
  const [name, setName] = useState(location.name);
  const [externalId, setExternalId] = useState(location.externalId || '');
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit location"
      primaryAction={{ content: 'Save', disabled: !name.trim(), onAction: () => onSave({ name: name.trim(), externalId: externalId.trim() }) }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
          <TextField label="Location ID" value={externalId} onChange={setExternalId} placeholder="External / ERP ID" autoComplete="off" />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

export function ShippingModal({ location, onClose, onSave }) {
  const s = location.shipping || {};
  const [f, setF] = useState({
    firstName: s.firstName || '',
    lastName: s.lastName || '',
    company: s.company || '',
    address1: s.address1 || '',
    address2: s.address2 || '',
    city: s.city || '',
    postal: s.postal || '',
    country: s.country || 'VN',
    phone: s.phone || '',
  });
  const [billingSame, setBillingSame] = useState(location.billingSameAsShipping !== false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Shipping address"
      primaryAction={{ content: 'Save', onAction: () => onSave({ shipping: f, billingSameAsShipping: billingSame }) }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Select
            label="Country/region"
            options={Object.entries(COUNTRY_NAMES).map(([value, label]) => ({ value, label }))}
            value={f.country}
            onChange={set('country')}
          />
          <InlineStack gap="300" wrap={false}>
            <Box width="100%"><TextField label="First name" value={f.firstName} onChange={set('firstName')} autoComplete="off" /></Box>
            <Box width="100%"><TextField label="Last name" value={f.lastName} onChange={set('lastName')} autoComplete="off" /></Box>
          </InlineStack>
          <TextField label="Company / attention" value={f.company} onChange={set('company')} autoComplete="off" />
          <TextField label="Address" value={f.address1} onChange={set('address1')} autoComplete="off" />
          <TextField label="Apartment, suite, etc." value={f.address2} onChange={set('address2')} autoComplete="off" />
          <InlineStack gap="300" wrap={false}>
            <Box width="100%"><TextField label="City" value={f.city} onChange={set('city')} autoComplete="off" /></Box>
            <Box width="100%"><TextField label="Postal code" value={f.postal} onChange={set('postal')} autoComplete="off" /></Box>
          </InlineStack>
          <TextField label="Phone" value={f.phone} onChange={set('phone')} autoComplete="off" />
          <Checkbox label="Billing address same as shipping" checked={billingSame} onChange={setBillingSame} />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

