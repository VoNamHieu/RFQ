import React, { useState } from 'react';
import { useStore } from '../../store.jsx';
import { locationPricingEntries } from '../../pricing.js';
import { shopifyCompanies } from '../../data/directory.js';
import { Modal, Tip, useWcId } from '../../../shared/wc.jsx';

export function LocationsTab({ company }) {
  const { state, dispatch } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  // Row selection (the leading checkbox column) and the ids awaiting delete confirmation.
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmIds, setConfirmIds] = useState(null);
  const rowId = useWcId('location-row');
  const locations = company.locations || [];
  const selected = locations.filter((l) => selectedIds.includes(l.id));
  const allSelected = locations.length > 0 && selected.length === locations.length;
  // Checkbox handlers always SET from the checkbox's state (change can fire twice).
  const selectAll = (on) => setSelectedIds(on ? locations.map((l) => l.id) : []);
  const selectRow = (id, on) =>
    setSelectedIds((ids) => (on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));
  // Bulk actions, as in Shopify's index tables: while rows are selected the column
  // headings give way to "N selected" and the actions, so the table doesn't move.
  // s-table drops its header row in its list layout (narrow windows); there they
  // sit above the list instead. See .qs-bulk-bar in wc.css.
  const bulk = selected.length > 0;
  const askDelete = () => setConfirmIds(selected.map((l) => l.id));
  const heading = (label) => (bulk ? <span className="qs-bulk-hidden">{label}</span> : label);

  const rows = locations.map((l, index) => {
    const buyers = typeof l.buyers === 'number' ? l.buyers : (company.contacts || []).filter((c) => c.locations === l.name).length;
    const { bases, quantities } = locationPricingEntries(company, l, state.db.policies);
    const names = [...bases, ...quantities].map((e) => e.policy.name);
    const linkId = `${rowId}-${l.id || index}`;
    return (
      <s-table-row key={l.id || index} clickDelegate={linkId}>
        <s-table-cell>
          <s-checkbox
            accessibilityLabel={`Select ${l.name}`}
            checked={selectedIds.includes(l.id)}
            onChange={(e) => selectRow(l.id, e.currentTarget.checked)}
          />
        </s-table-cell>
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
          <s-badge tone={l.status === 'Deleted' ? 'critical' : 'success'}>{l.status || 'Active'}</s-badge>
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
        {bulk ? (
          <div className="qs-bulk-list">
            <s-box paddingBlockStart="small-200">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text fontWeight="semibold">{`${selected.length} selected`}</s-text>
                <s-button tone="critical" onClick={askDelete}>
                  Delete locations
                </s-button>
              </s-stack>
            </s-box>
          </div>
        ) : null}
      </s-box>
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="inline">
            <s-checkbox
              accessibilityLabel={allSelected ? 'Deselect all locations' : 'Select all locations'}
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              disabled={locations.length === 0}
              onChange={(e) => selectAll(e.currentTarget.checked)}
            />
          </s-table-header>
          <s-table-header listSlot="primary">
            {bulk ? (
              <span className="qs-bulk-bar">
                <s-text fontWeight="semibold">{`${selected.length} selected`}</s-text>
                <s-button tone="critical" onClick={askDelete}>
                  Delete locations
                </s-button>
              </span>
            ) : (
              'Location'
            )}
          </s-table-header>
          <s-table-header listSlot="labeled">{heading('Payment terms')}</s-table-header>
          <s-table-header listSlot="labeled">{heading('Purchasing')}</s-table-header>
          <s-table-header listSlot="labeled">{heading('Pricing')}</s-table-header>
          <s-table-header listSlot="labeled" format="numeric">
            {heading('Buyers')}
          </s-table-header>
          <s-table-header listSlot="secondary">{heading('Status')}</s-table-header>
        </s-table-header-row>
        <s-table-body>{rows}</s-table-body>
      </s-table>
      {addOpen && <AddFromShopifyModal company={company} onClose={() => setAddOpen(false)} />}
      {confirmIds && (
        <DeleteLocationsModal
          company={company}
          locationIds={confirmIds}
          onClose={() => setConfirmIds(null)}
          onDeleted={() => setSelectedIds([])}
        />
      )}
    </s-section>
  );
}

// Confirms removing locations from the app (the location page's Delete uses it too).
export function DeleteLocationsModal({ company, locationIds, onClose, onDeleted }) {
  const { dispatch } = useStore();
  const locs = (company.locations || []).filter((l) => locationIds.includes(l.id));
  const n = locs.length;
  return (
    <Modal onClose={onClose} heading={n === 1 ? `Delete ${locs[0].name}?` : `Delete ${n} locations?`}>
      <s-stack gap="small">
        <s-paragraph>
          {n === 1 ? 'This location is' : 'These locations are'} removed from the B2B app, with the pricing assigned to{' '}
          {n === 1 ? 'it' : 'them'}. Locations in Shopify aren't affected.
        </s-paragraph>
        {n > 1 ? (
          <s-unordered-list>
            {locs.map((l) => (
              <s-list-item key={l.id}>{l.name}</s-list-item>
            ))}
          </s-unordered-list>
        ) : null}
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        onClick={() => {
          onClose();
          onDeleted?.();
          dispatch({ type: 'DELETE_LOCATIONS', companyId: company.id, locationIds });
        }}
      >
        {n === 1 ? 'Delete location' : 'Delete locations'}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// Add location: pick from the company's Shopify locations not in the app yet
// (locations themselves are created in Shopify).
function AddFromShopifyModal({ company, onClose }) {
  const { state, dispatch } = useStore();
  const [picked, setPicked] = useState([]);
  const shp = shopifyCompanies(state.shopifyNewLocations).find((s) => s.id === company.shopifyCompanyId || s.name === company.name);
  const has = (l) => (company.locations || []).some((x) => x.id === l.id || x.name === l.name);
  const remaining = (shp?.locations || []).filter((l) => !has(l));
  // Checkbox handlers always SET from the checkbox's state (change can fire twice).
  const pick = (id, on) => setPicked((ids) => (on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));
  const n = picked.length;
  return (
    <Modal onClose={onClose} heading="Add locations from Shopify">
      {remaining.length ? (
        <s-stack gap="small">
          <s-stack gap="small-200">
            {remaining.map((l) => (
              <s-checkbox key={l.id} label={l.name} checked={picked.includes(l.id)} onChange={(e) => pick(l.id, e.currentTarget.checked)} />
            ))}
          </s-stack>
          <s-paragraph color="subdued" fontSize="small">
            All of a location’s information in Shopify syncs over when it’s added, including its contacts.
          </s-paragraph>
        </s-stack>
      ) : (
        <s-paragraph>
          {shp ? `Every Shopify location of ${company.name} is already in the app.` : `${company.name} has no locations in Shopify to add.`}
        </s-paragraph>
      )}
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={n === 0}
        onClick={() => {
          dispatch({ type: 'ADD_SHOPIFY_LOCATIONS', companyId: company.id, shopifyLocationIds: picked });
          onClose();
        }}
      >
        {n > 1 ? `Add ${n} locations` : 'Add location'}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
