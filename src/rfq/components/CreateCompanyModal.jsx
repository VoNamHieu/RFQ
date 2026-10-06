import React, { useState, useRef } from 'react';
import { Modal, Tip } from '../../shared/wc.jsx';
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

const options = (list) =>
  list.map((o) => (
    <s-option key={o.value} value={o.value}>
      {o.label}
    </s-option>
  ));

// Two fields side by side when there's room (Polaris React InlineGrid columns={{ xs: 1, sm: 2 }}).
function TwoUp({ children }) {
  return (
    <s-query-container>
      <s-grid gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr, 1fr" gap="small">
        {children}
      </s-grid>
    </s-query-container>
  );
}

function AddressFields({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.currentTarget.value });
  return (
    <s-stack gap="small">
      <s-select label="Country/region" value={value.country || 'VN'} onChange={set('country')}>
        {options(COUNTRIES)}
      </s-select>
      <TwoUp>
        <s-text-field label="First name" value={value.firstName || ''} onInput={set('firstName')} autocomplete="off" />
        <s-text-field label="Last name" value={value.lastName || ''} onInput={set('lastName')} autocomplete="off" />
      </TwoUp>
      <s-text-field label="Company / attention" value={value.company || ''} onInput={set('company')} autocomplete="off" />
      <s-text-field label="Address" value={value.address1 || ''} onInput={set('address1')} autocomplete="off" />
      <s-text-field label="Apartment, suite, etc." value={value.address2 || ''} onInput={set('address2')} autocomplete="off" />
      <TwoUp>
        <s-text-field label="City" value={value.city || ''} onInput={set('city')} autocomplete="off" />
        <s-text-field label="Postal code" value={value.postal || ''} onInput={set('postal')} autocomplete="off" />
      </TwoUp>
      {/* Phone with the country flag select connected on the left. */}
      <s-grid gridTemplateColumns="88px minmax(0, 1fr)" gap="small-200" alignItems="end">
        <s-select
          label="Phone country"
          labelAccessibilityVisibility="exclusive"
          value={value.phoneCountry || value.country || 'VN'}
          onChange={set('phoneCountry')}
        >
          {options(FLAG_OPTIONS)}
        </s-select>
        <s-text-field label="Phone" value={value.phone || ''} onInput={set('phone')} autocomplete="off" />
      </s-grid>
    </s-stack>
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
    <s-box border="base" borderRadius="base" padding="small">
      <s-stack gap="small-200">
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
          <s-stack direction="inline" gap="small-300" alignItems="center">
            <s-heading>{title}</s-heading>
            {optional ? <s-badge>Optional</s-badge> : null}
          </s-stack>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            {editing ? (
              <>
                <s-link onClick={discard}>Discard</s-link>
                <s-link onClick={() => setEditing(false)}>Done</s-link>
              </>
            ) : has ? (
              <>
                <s-link tone="critical" onClick={() => onChange(emptyAddr(value.country))}>Clear</s-link>
                <s-link onClick={startEdit}>Edit</s-link>
              </>
            ) : (
              <s-link onClick={startEdit}>{addMode ? 'Add' : 'Edit'}</s-link>
            )}
          </s-stack>
        </s-grid>
        {editing ? (
          <AddressFields value={value} onChange={onChange} />
        ) : (
          <s-stack gap="small-500">
            {has ? (
              formatAddress(value).map((line, i) => <s-text key={i}>{line}</s-text>)
            ) : (
              <s-text color="subdued">{addMode ? 'No billing address provided.' : 'No shipping address provided.'}</s-text>
            )}
            {note && has ? <s-text color="subdued" fontSize="small">{note}</s-text> : null}
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}

// Collapsed-by-default disclosure for the non-essential ordering/payment/tax fields
// (god-file <details> "Ordering, payment & tax").
function Disclosure({ title, note, children }) {
  const [open, setOpen] = useState(false);
  return (
    <s-box border="base" borderRadius="base">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ordering-payment-tax"
        onClick={() => setOpen((v) => !v)}
        style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box', padding: 12 }}
      >
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
          <s-stack gap="small-500">
            <s-heading>{title}</s-heading>
            {note ? <s-text color="subdued" fontSize="small">{note}</s-text> : null}
          </s-stack>
          <s-stack direction="inline" gap="small-500" alignItems="center">
            <s-text color="subdued" fontSize="small">{open ? 'Hide' : 'Edit'}</s-text>
            <s-icon type={open ? 'chevron-up' : 'chevron-down'} color="subdued" />
          </s-stack>
        </s-grid>
      </button>
      {open ? (
        <div id="ordering-payment-tax">
          <s-box padding="small" paddingBlockStart="none">
            {children}
          </s-box>
        </div>
      ) : null}
    </s-box>
  );
}

// "Create new company" overlay from the sync flow (spec §5.7 / §2.4).
export function CreateCompanyModal() {
  const { state, dispatch } = useStore();
  const cc = state.createCompany;
  if (!cc) return null;
  const patch = (p) => dispatch({ type: 'CREATE_COMPANY_PATCH', patch: p });
  const close = () => dispatch({ type: 'CLOSE_CREATE_COMPANY' });

  return (
    <Modal onClose={close} heading="Create a company in B2B">
      <s-stack gap="base">
        <s-stack gap="small-200">
          <s-heading>Company details</s-heading>
          <s-stack gap="small">
            <s-text-field label="Company name" value={cc.name} onInput={(e) => patch({ name: e.currentTarget.value })} autocomplete="off" />
            <s-text-field label="Company ID" placeholder="Optional" value={cc.externalId} onInput={(e) => patch({ externalId: e.currentTarget.value })} autocomplete="off" />
          </s-stack>
        </s-stack>

        <s-divider />

        <s-stack gap="small">
          {/* Header row (real layout) with a subtle demo toggle on the right —
              god file: "Demo: simulate an RFQ with no shipping address". */}
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
            <s-heading>Company location</s-heading>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tip content="Demo: simulate an RFQ that arrived without a shipping address.">
                <s-badge tone="info">Demo</s-badge>
              </Tip>
              <s-checkbox label="No shipping address" checked={!!cc.noShipping} onChange={(e) => patch({ noShipping: e.currentTarget.checked })} />
            </div>
          </s-grid>

          {cc.noShipping ? (
            <s-paragraph color="subdued" fontSize="small">This company location has no shipping address yet. You can add one later in the B2B app.</s-paragraph>
          ) : (
            <AddressPreviewPanel
              title="Shipping address"
              optional
              note="This address is taken from the RFQ request."
              value={cc.ship || emptyAddr()}
              onChange={(v) => patch({ ship: v })}
            />
          )}

          <s-checkbox
            label="Billing address same as shipping address"
            checked={cc.billingSame !== false}
            onChange={(e) => patch({ billingSame: e.currentTarget.checked })}
          />
          {cc.billingSame === false && (
            <AddressPreviewPanel title="Billing address" addMode value={cc.bill || emptyAddr()} onChange={(v) => patch({ bill: v })} />
          )}

          <s-text-field
            label="Location ID"
            placeholder="ERP / external ID"
            details="Add an existing external ID or create a unique ID."
            value={cc.locationId}
            onInput={(e) => patch({ locationId: e.currentTarget.value })}
            autocomplete="off"
          />

          {/* Non-essential — collapsed by default, like the god file. */}
          <Disclosure title="Ordering, payment & tax" note="Payment terms, tax exemptions, currency and more.">
            <s-stack gap="small">
              <s-checkbox
                label="Allow buyers to use a one-time shipping address at checkout"
                checked={!!cc.editableShipping}
                onChange={(e) => patch({ editableShipping: e.currentTarget.checked })}
              />
              <s-choice-list
                label="Order submission"
                name="checkout"
                onChange={(e) => patch({ checkoutToDraft: e.currentTarget.values?.[0] === 'draft' })}
              >
                <s-choice value="direct" selected={!cc.checkoutToDraft}>
                  Automatically submit orders
                  <s-text slot="details">Orders without shipping addresses are submitted as draft orders.</s-text>
                </s-choice>
                <s-choice value="draft" selected={!!cc.checkoutToDraft}>
                  Submit all orders as drafts for review
                </s-choice>
              </s-choice-list>
              <s-stack gap="small">
                <s-select label="Payment terms" value={cc.paymentTerms} onChange={(e) => patch({ paymentTerms: e.currentTarget.value })}>
                  {options(PAYMENT_TERMS.map((t) => ({ label: t, value: t })))}
                </s-select>
                <s-text-field
                  label="Tax registration ID"
                  placeholder="Tax / VAT ID"
                  value={cc.taxRegistrationId}
                  onInput={(e) => patch({ taxRegistrationId: e.currentTarget.value })}
                  autocomplete="off"
                />
              </s-stack>
              <s-select label="Tax settings" value={cc.taxSettings} onChange={(e) => patch({ taxSettings: e.currentTarget.value })}>
                {options(TAX_SETTINGS)}
              </s-select>
            </s-stack>
          </Disclosure>
        </s-stack>

        <s-divider />

        <s-stack gap="small">
          <s-stack direction="inline" gap="small-300" alignItems="center">
            <s-heading>Initial company contact</s-heading>
            <s-badge>Existing Shopify customer</s-badge>
          </s-stack>
          <s-stack gap="small">
            <s-text-field label="Name" value={cc.contactName || ''} disabled autocomplete="off" />
            <s-text-field label="Email" value={cc.contactEmail || ''} disabled autocomplete="off" />
          </s-stack>
          <s-checkbox
            label="Set this requester as the company’s main contact"
            checked={cc.setMainContact !== false}
            onChange={(e) => patch({ setMainContact: e.currentTarget.checked })}
          />
        </s-stack>

        <s-divider />

        <s-checkbox
          label="Also sync past quotes"
          details="Add this customer’s past quotes to the B2B company and its quote history."
          checked={cc.syncPast !== false}
          onChange={(e) => patch({ syncPast: e.currentTarget.checked })}
        />
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={!cc.name.trim()} onClick={() => dispatch({ type: 'CREATE_COMPANY_CONFIRM' })}>
        Create company
      </s-button>
      <s-button slot="secondary-actions" onClick={close}>
        Back to RFQ
      </s-button>
    </Modal>
  );
}
