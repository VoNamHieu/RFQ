import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Modal } from '../../shared/wc.jsx';

// Shared location constants + the location-detail modals (assign buyer,
// edit general, edit shipping). Split out of LocationDetail.jsx.
export const PAYMENT_TERM_OPTIONS = ['No payment terms', 'Due immediately', 'Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];
export const TAX_SETTINGS = [
  { value: 'collect', label: 'Collect tax' },
  { value: 'collect_unless_exempt', label: 'Collect tax unless exemptions apply' },
  { value: 'exempt', label: 'Do not collect tax' },
];
export const COUNTRY_NAMES = { VN: 'Vietnam', US: 'United States', GB: 'United Kingdom', SG: 'Singapore', AU: 'Australia' };
// An address as lines (name, company, street, city, postal code, country); [] when it has none.
export function addressLines(a) {
  const s = a || {};
  const name = [s.firstName, s.lastName].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
  const parts = [name, s.company, s.address1, s.address2, s.city, s.postal].map((x) => String(x || '').trim()).filter(Boolean);
  return parts.length ? [...parts, COUNTRY_NAMES[s.country] || s.country || ''].filter(Boolean) : [];
}
export const ROLE_OPTIONS = ['Ordering only', 'Location admin'];

export function AssignBuyerModal({ company, location, onClose }) {
  const { dispatch } = useStore();
  const candidates = (company.contacts || []).filter((c) => c.locations !== location.name);
  const [email, setEmail] = useState(candidates[0]?.email || '');
  const [role, setRole] = useState('Ordering only');
  const current = candidates.find((x) => x.email === email);
  return (
    <Modal onClose={onClose} heading={`Assign a buyer to ${location.name}`}>
      {candidates.length ? (
        <s-stack gap="small">
          <s-select
            label="Contact"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            details={current && current.locations ? `Currently at ${current.locations}` : 'Not assigned to a location yet'}
          >
            {candidates.map((c) => (
              <s-option key={c.email} value={c.email}>
                {`${c.name} · ${c.email}`}
              </s-option>
            ))}
          </s-select>
          <s-select label="Role" value={role} onChange={(e) => setRole(e.currentTarget.value)}>
            {ROLE_OPTIONS.map((r) => (
              <s-option key={r} value={r}>
                {r}
              </s-option>
            ))}
          </s-select>
        </s-stack>
      ) : (
        <s-paragraph color="subdued">Every contact is already assigned to this location.</s-paragraph>
      )}
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!email}
        onClick={() => {
          dispatch({ type: 'ASSIGN_BUYER', companyId: company.id, locationId: location.id, email, role });
          onClose();
        }}
      >
        Assign buyer
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

export function GeneralModal({ location, onClose, onSave }) {
  const [name, setName] = useState(location.name);
  const [externalId, setExternalId] = useState(location.externalId || '');
  return (
    <Modal onClose={onClose} heading="Edit location">
      <s-stack gap="small">
        <s-text-field label="Name" value={name} onInput={(e) => setName(e.currentTarget.value)} autocomplete="off" />
        <s-text-field
          label="Location ID"
          value={externalId}
          onInput={(e) => setExternalId(e.currentTarget.value)}
          placeholder="External / ERP ID"
          autocomplete="off"
        />
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!name.trim()}
        onClick={() => onSave({ name: name.trim(), externalId: externalId.trim() })}
      >
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// How the location's orders are submitted (Commerce settings).
export const ORDER_SUBMISSION = [
  { value: 'DIRECT', label: 'Automatically submit orders' },
  { value: 'REQUIRE_APPROVAL', label: 'Submit all orders as drafts for review' },
];

// A location's commerce settings as its page lists them (and the company page sums up):
// [label, value] rows.
export function commerceRows(location) {
  const submission = ORDER_SUBMISSION.find((o) => o.value === (location.purchasingMode || 'DIRECT')) || ORDER_SUBMISSION[0];
  const tax = TAX_SETTINGS.find((t) => t.value === (location.taxSettings || 'collect')) || TAX_SETTINGS[0];
  return [
    ['Payment terms', location.paymentTerms || 'No payment terms'],
    ['Order submission', submission.label],
    ['One-time addresses', location.editableShipping ? 'Allowed' : 'Not allowed'],
    ['Tax', `${tax.label} · ${location.taxId ? `Tax ID ${location.taxId}` : 'Tax ID not set'}`],
  ];
}

// Commerce settings, edited together and saved with Save (the location page lists them).
export function CommerceModal({ location, onClose, onSave }) {
  const [f, setF] = useState({
    paymentTerms: location.paymentTerms || 'No payment terms',
    purchasingMode: location.purchasingMode || 'DIRECT',
    editableShipping: !!location.editableShipping,
    taxId: location.taxId || '',
    taxSettings: location.taxSettings || 'collect',
  });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  return (
    <Modal onClose={onClose} heading="Edit commerce settings">
      <s-stack gap="small">
        <s-select label="Payment terms" value={f.paymentTerms} onChange={(e) => set({ paymentTerms: e.currentTarget.value })}>
          {PAYMENT_TERM_OPTIONS.map((t) => (
            <s-option key={t} value={t}>
              {t}
            </s-option>
          ))}
        </s-select>
        <s-select label="Order submission" value={f.purchasingMode} onChange={(e) => set({ purchasingMode: e.currentTarget.value })}>
          {ORDER_SUBMISSION.map((o) => (
            <s-option key={o.value} value={o.value}>
              {o.label}
            </s-option>
          ))}
        </s-select>
        <s-checkbox
          label="Allow any one-time address"
          checked={f.editableShipping}
          onChange={(e) => set({ editableShipping: e.currentTarget.checked })}
        />
        <s-text-field
          label="Tax ID"
          value={f.taxId}
          onInput={(e) => set({ taxId: e.currentTarget.value })}
          placeholder="Tax / VAT ID"
          autocomplete="off"
        />
        <s-select label="Tax settings" value={f.taxSettings} onChange={(e) => set({ taxSettings: e.currentTarget.value })}>
          {TAX_SETTINGS.map((t) => (
            <s-option key={t.value} value={t.value}>
              {t.label}
            </s-option>
          ))}
        </s-select>
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={() => onSave({ ...f, taxId: f.taxId.trim() })}>
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// Billing address (Shopify's "Edit billing address"): its own address — editing it
// sets it apart from shipping. The shipping address's fields, starting from the billing
// address set before (else the shipping address). Back to the shipping address: the
// Shipping address modal's "Billing address same as shipping".
export function BillingModal({ location, onClose, onSave }) {
  const b = location.billing || location.shipping || {};
  const [f, setF] = useState({
    firstName: b.firstName || '',
    lastName: b.lastName || '',
    company: b.company || '',
    address1: b.address1 || '',
    address2: b.address2 || '',
    city: b.city || '',
    postal: b.postal || '',
    country: b.country || 'VN',
    phone: b.phone || '',
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const field = (k, label) => (
    <s-text-field label={label} value={f[k]} onInput={(e) => set(k)(e.currentTarget.value)} autocomplete="off" />
  );
  return (
    <Modal onClose={onClose} heading="Billing address">
      <s-stack gap="small">
        <s-select label="Country/region" value={f.country} onChange={(e) => set('country')(e.currentTarget.value)}>
          {Object.entries(COUNTRY_NAMES).map(([value, label]) => (
            <s-option key={value} value={value}>
              {label}
            </s-option>
          ))}
        </s-select>
        <s-grid gridTemplateColumns="1fr 1fr" gap="small">
          {field('firstName', 'First name')}
          {field('lastName', 'Last name')}
        </s-grid>
        {field('company', 'Company / attention')}
        {field('address1', 'Address')}
        {field('address2', 'Apartment, suite, etc.')}
        <s-grid gridTemplateColumns="1fr 1fr" gap="small">
          {field('city', 'City')}
          {field('postal', 'Postal code')}
        </s-grid>
        {field('phone', 'Phone')}
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={() => onSave({ billingSameAsShipping: false, billing: f })}>
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
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
  // Text fields update per keystroke (Polaris React TextField onChange).
  const field = (k, label) => (
    <s-text-field label={label} value={f[k]} onInput={(e) => set(k)(e.currentTarget.value)} autocomplete="off" />
  );
  return (
    <Modal onClose={onClose} heading="Shipping address">
      <s-stack gap="small">
        <s-select label="Country/region" value={f.country} onChange={(e) => set('country')(e.currentTarget.value)}>
          {Object.entries(COUNTRY_NAMES).map(([value, label]) => (
            <s-option key={value} value={value}>
              {label}
            </s-option>
          ))}
        </s-select>
        <s-grid gridTemplateColumns="1fr 1fr" gap="small">
          {field('firstName', 'First name')}
          {field('lastName', 'Last name')}
        </s-grid>
        {field('company', 'Company / attention')}
        {field('address1', 'Address')}
        {field('address2', 'Apartment, suite, etc.')}
        <s-grid gridTemplateColumns="1fr 1fr" gap="small">
          {field('city', 'City')}
          {field('postal', 'Postal code')}
        </s-grid>
        {field('phone', 'Phone')}
        <s-checkbox
          label="Billing address same as shipping"
          checked={billingSame}
          onChange={(e) => setBillingSame(e.currentTarget.checked)}
        />
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={() => onSave({ shipping: f, billingSameAsShipping: billingSame })}>
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
