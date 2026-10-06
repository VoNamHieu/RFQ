import React, { useState } from 'react';
import { useStore } from '../../store.jsx';
import { locationPricingEntries } from '../../pricing.js';
import { Modal, Tip, useWcId } from '../../../shared/wc.jsx';

const PAYMENT_TERMS = ['No payment terms', 'Due on receipt', 'Net 15', 'Net 30', 'Net 60'];

export function LocationsTab({ company }) {
  const { state, dispatch } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const rowId = useWcId('location-row');
  const locations = company.locations || [];

  const rows = locations.map((l, index) => {
    const buyers = typeof l.buyers === 'number' ? l.buyers : (company.contacts || []).filter((c) => c.locations === l.name).length;
    const { bases, quantities } = locationPricingEntries(company, l, state.db.policies);
    const names = [...bases, ...quantities].map((e) => e.policy.name);
    const linkId = `${rowId}-${l.id || index}`;
    return (
      <s-table-row key={l.id || index} clickDelegate={linkId}>
        <s-table-cell>
          <s-stack gap="small-500">
            <s-link id={linkId} onClick={() => dispatch({ type: 'OPEN_LOCATION', companyId: company.id, locationId: l.id })}>
              {l.name}
            </s-link>
            {l.address ? (
              <s-text color="subdued" fontSize="small">
                {l.address}
              </s-text>
            ) : null}
          </s-stack>
        </s-table-cell>
        <s-table-cell>{l.terms || l.paymentTerms || '—'}</s-table-cell>
        <s-table-cell>{l.ordering || (l.purchasingMode === 'REQUIRE_APPROVAL' ? 'You approve first' : 'Buys directly')}</s-table-cell>
        <s-table-cell>
          {names.length ? (
            <s-stack direction="inline" gap="small-400" alignItems="center">
              <s-text fontSize="small">{names.slice(0, 3).join(', ')}</s-text>
              {names.length > 3 ? (
                <Tip content={names.slice(3).join(', ')}>
                  <s-badge>{`+${names.length - 3}`}</s-badge>
                </Tip>
              ) : null}
            </s-stack>
          ) : (
            <s-text fontSize="small">Not set</s-text>
          )}
        </s-table-cell>
        <s-table-cell>{buyers}</s-table-cell>
        <s-table-cell>
          <s-badge tone="success">{l.status || 'Active'}</s-badge>
        </s-table-cell>
      </s-table-row>
    );
  });

  return (
    <s-section padding="none">
      <s-box padding="small" paddingBlockEnd="none">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
          <s-heading>Locations</s-heading>
          <s-button icon="plus" variant="tertiary" onClick={() => setAddOpen(true)}>
            Add location
          </s-button>
        </s-grid>
        <s-box paddingBlock="small-200">
          <s-checkbox
            label="Automatically add new locations"
            details="Locations added to this company in Shopify are added here too and use the company's pricing."
            checked={!!company.autoAddLocations}
            onChange={(e) => dispatch({ type: 'SET_AUTO_ADD_LOCATIONS', companyId: company.id, on: e.currentTarget.checked })}
          />
        </s-box>
      </s-box>
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Location</s-table-header>
          <s-table-header listSlot="labeled">Payment terms</s-table-header>
          <s-table-header listSlot="labeled">Purchasing</s-table-header>
          <s-table-header listSlot="labeled">Pricing</s-table-header>
          <s-table-header listSlot="labeled" format="numeric">
            Buyers
          </s-table-header>
          <s-table-header listSlot="secondary">Status</s-table-header>
        </s-table-header-row>
        <s-table-body>{rows}</s-table-body>
      </s-table>
      {addOpen && <AddLocationModal company={company} onClose={() => setAddOpen(false)} dispatch={dispatch} />}
    </s-section>
  );
}

function AddLocationModal({ company, onClose, dispatch }) {
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('No payment terms');
  const [purchasingMode, setPurchasingMode] = useState('DIRECT');
  return (
    <Modal onClose={onClose} heading={`Add a location to ${company.name}`}>
      <s-stack gap="small">
        <s-text-field label="Location name" value={name} onInput={(e) => setName(e.currentTarget.value)} autocomplete="off" />
        <s-text-field
          label="Location ID"
          placeholder="Optional external ID"
          value={externalId}
          onInput={(e) => setExternalId(e.currentTarget.value)}
          autocomplete="off"
        />
        <s-select label="Payment terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.currentTarget.value)}>
          {PAYMENT_TERMS.map((t) => (
            <s-option key={t} value={t}>
              {t}
            </s-option>
          ))}
        </s-select>
        <s-select label="Order submission" value={purchasingMode} onChange={(e) => setPurchasingMode(e.currentTarget.value)}>
          <s-option value="DIRECT">Automatically submit orders</s-option>
          <s-option value="REQUIRE_APPROVAL">Submit as drafts for review</s-option>
        </s-select>
        <s-paragraph color="subdued" fontSize="small">
          The new location uses the company pricing. You can add its own pricing later from the location page.
        </s-paragraph>
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!name.trim()}
        onClick={() => {
          dispatch({ type: 'ADD_LOCATION', companyId: company.id, name: name.trim(), externalId: externalId.trim(), paymentTerms, purchasingMode });
          onClose();
        }}
      >
        Add location
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
