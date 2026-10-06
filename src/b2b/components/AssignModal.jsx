import React from 'react';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityEntries, locationPricingEntries, scopeTypeLabel } from '../pricing.js';
import { Modal } from '../../shared/wc.jsx';
import { PricingCombobox } from './PricingCombobox.jsx';
import { LocationScopePicker } from './LocationScopePicker.jsx';

// Assign existing pricing(s) to a company, or swap one for another (spec §2.8),
// laid out like the god file's "Assign price list" modal: a picker whose options
// carry checkboxes, the picks shown as removable tags, OR create a new one. Add is
// MULTI-select (base and quantity alike); swap is single.
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
      onClose={() => dispatch({ type: 'CLOSE_ASSIGN' })}
      heading={isSwap ? `Change ${swapped?.name || kindName}` : `Assign ${kindName}: ${location?.name || company?.name || ''}`}
    >
      <s-stack gap="base">
        <s-stack gap="small-300">
          <s-heading>{isSwap ? `Replace with an existing ${kindName}` : `Use an existing ${kindName}`}</s-heading>
          {candidates.length === 0 ? (
            <s-paragraph color="subdued">{`No other ${kindName} available — create a new one below.`}</s-paragraph>
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
                <s-paragraph color="subdued" fontSize="small">
                  Pick one or more — the lowest priority applies first.
                </s-paragraph>
              )}
            </>
          )}
        </s-stack>

        {pickLocations ? (
          <LocationScopePicker
            company={company}
            locationIds={someLocations ? pickedLocIds : null}
            onChange={(ids) => dispatch({ type: 'ASSIGN_PATCH', patch: { applyTo: ids ? 'some' : 'all', locationIds: ids || [] } })}
          />
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--p-color-border)' }} />
          <s-text color="subdued" fontSize="small">
            OR
          </s-text>
          <div style={{ flex: 1, height: 1, background: 'var(--p-color-border)' }} />
        </div>

        <s-button icon="plus" inlineSize="fill" onClick={createNew}>{`Create a new ${kindName}`}</s-button>
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        disabled={selectedIds.length === 0 || (someLocations && pickedLocIds.length === 0)}
        onClick={() => dispatch({ type: 'ASSIGN_CONFIRM' })}
      >
        {isSwap ? 'Change' : 'Assign'}
      </s-button>
      <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'CLOSE_ASSIGN' })}>
        Cancel
      </s-button>
    </Modal>
  );
}
