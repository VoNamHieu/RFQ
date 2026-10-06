import React from 'react';
import { Modal, BlockStack, Text, Button } from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityEntries, locationPricingEntries, scopeTypeLabel } from '../pricing.js';
import { PricingCombobox } from './PricingCombobox.jsx';
import { LocationScopePicker } from './LocationScopePicker.jsx';

// Assign existing pricing(s) to a company, or swap one for another (spec §2.8),
// laid out like the god file's "Assign price list" modal: a Combobox dropdown whose
// options carry checkboxes (Combobox manages the floating overlay so it positions
// correctly inside the Modal), the picks shown as removable tags, OR create a new
// one. Add is MULTI-select (base and quantity alike); swap is single.
export function AssignModal() {
  const { state, dispatch } = useStore();
  const a = state.assign;
  if (!a) return null;
  const isQuantity = a.kind === 'quantity';
  const kindName = isQuantity ? 'quantity pricing' : 'base pricing';
  const isSwap = a.mode === 'swap';
  const single = isSwap;
  const company = state.db.companies.find((c) => c.id === a.companyId);
  // From a Location page: the target is that location, and what it already has
  // (its own or inherited from the company) can't be picked again.
  const location = a.locationId ? (company?.locations || []).find((l) => l.id === a.locationId) : null;
  const assignedIds = location
    ? (({ bases, quantities }) => (isQuantity ? quantities : bases))(locationPricingEntries(company, location, state.db.policies, { includeInactive: true })).map((e) => e.policy.id)
    : (isQuantity ? companyQuantityEntries : companyBaseEntries)(company, state.db.policies).map((e) => e.policy.id);

  const candidates = state.db.policies.filter(
    (p) =>
      (isQuantity ? p.priceKind === 'quantity' : p.priceKind !== 'quantity') &&
      p.audienceType === 'b2b' &&
      (isSwap ? p.id !== a.swapId : true) &&
      !assignedIds.includes(p.id),
  );

  // Adding from a company page with 2+ locations: all of them, or only some.
  const locations = company?.locations || [];
  const pickLocations = !location && !isSwap && locations.length > 1;
  const someLocations = pickLocations && a.applyTo === 'some';
  const pickedLocIds = someLocations ? a.locationIds || [] : [];

  const swapped = isSwap ? state.db.policies.find((p) => p.id === a.swapId) : null;
  const selectedIds = a.selectedIds || [];

  const optionLabel = (p) => `${p.name} · Priority ${p.priority ?? '—'} · ${scopeTypeLabel(p)}`;

  const createNew = () => {
    dispatch({ type: 'CLOSE_ASSIGN' });
    dispatch({
      type: 'OPEN_EDITOR',
      policy: null,
      kind: a.kind,
      context: {
        mode: isQuantity ? 'add-quantity' : 'add-base',
        companyId: a.companyId,
        locationId: a.locationId || null,
        locationIds: someLocations ? pickedLocIds : null,
      },
    });
  };

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_ASSIGN' })}
      title={isSwap ? `Change ${swapped?.name || kindName}` : `Assign ${kindName}: ${location?.name || company?.name || ''}`}
      primaryAction={{
        content: isSwap ? 'Change' : 'Assign',
        onAction: () => dispatch({ type: 'ASSIGN_CONFIRM' }),
        disabled: selectedIds.length === 0 || (someLocations && pickedLocIds.length === 0),
      }}
      secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_ASSIGN' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <BlockStack gap="150">
            <Text as="h3" variant="headingSm">
              {isSwap ? `Replace with an existing ${kindName}` : `Use an existing ${kindName}`}
            </Text>
            {candidates.length === 0 ? (
              <Text as="p" tone="subdued">{`No other ${kindName} available — create a new one below.`}</Text>
            ) : (
              <>
                <PricingCombobox
                  label={`Use an existing ${kindName}`}
                  placeholder={`Select ${kindName}`}
                  candidates={candidates}
                  selectedIds={selectedIds}
                  onChange={(ids) => dispatch({ type: 'ASSIGN_SET', ids })}
                  single={single}
                  optionLabel={optionLabel}
                  emptyText={`No matching ${kindName}`}
                />
                {!single && (
                  <Text as="p" tone="subdued" variant="bodySm">Pick one or more — the lowest priority applies first.</Text>
                )}
              </>
            )}
          </BlockStack>

          {pickLocations ? (
            <LocationScopePicker
              company={company}
              locationIds={someLocations ? pickedLocIds : null}
              onChange={(ids) => dispatch({ type: 'ASSIGN_PATCH', patch: { applyTo: ids ? 'some' : 'all', locationIds: ids || [] } })}
            />
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--p-color-border)' }} />
            <Text as="span" tone="subdued" variant="bodySm">OR</Text>
            <div style={{ flex: 1, height: 1, background: 'var(--p-color-border)' }} />
          </div>

          <Button icon={PlusIcon} fullWidth onClick={createNew}>{`Create a new ${kindName}`}</Button>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
