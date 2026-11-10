import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { companyForCustomerEmail } from '../pricing.js';
import { Modal } from '../../shared/wc.jsx';

// Assign one pricing profile to many targets at once (legacy renderAssign, the
// unlocked/target-picker path): companies, locations, customers, customer tags, or
// the store-wide default. Target types are constrained by the policy's audience.
// A company pick adds it to the company's pricing; a location pick to that
// location's own (see locationSlotArray).
export function MultiAssignModal() {
  const { state, dispatch } = useStore();
  const am = state.assignMulti;
  const policy = am ? state.db.policies.find((p) => p.id === am.policyId) : null;
  const isD2C = policy?.audienceType === 'd2c';
  const [targetType, setTargetType] = useState(isD2C ? 'customer' : 'company');
  const [ids, setIds] = useState([]);
  if (!am || !policy) return null;

  const targets = isD2C
    ? [
        { id: 'customer', label: 'Customers' },
        { id: 'tag', label: 'Customer tags' },
        { id: 'global', label: 'Store-wide' },
      ]
    : [
        { id: 'company', label: 'Companies' },
        { id: 'location', label: 'Locations' },
        { id: 'global', label: 'Store-wide' },
      ];

  const companyChoices = state.db.companies.map((c) => ({ label: c.name, value: c.id }));
  const locationChoices = state.db.companies.flatMap((c) =>
    (c.locations || []).map((l) => ({ label: `${c.name} · ${l.name}`, value: `${c.id}::${l.id}` })),
  );
  const customerChoices = (state.db.customers || [])
    .filter((cu) => !companyForCustomerEmail(state.db, cu.email))
    .map((cu) => ({ label: `${cu.name} · ${cu.email}`, value: cu.id }));
  const tagChoices = (state.db.tagPricing || []).map((t) => ({ label: t.name, value: t.id }));

  const choicesFor = { company: companyChoices, location: locationChoices, customer: customerChoices, tag: tagChoices }[targetType] || [];
  const isGlobal = targetType === 'global';
  const globalLabel = isD2C ? 'All customers (store-wide wholesale default)' : 'All Companies (store-wide default)';

  const switchTarget = (t) => {
    setTargetType(t);
    setIds([]);
  };
  const confirm = () => {
    dispatch({ type: 'MULTI_ASSIGN', policyId: policy.id, targetType, ids: isGlobal ? [] : ids });
  };

  return (
    <Modal onClose={() => dispatch({ type: 'CLOSE_MULTI_ASSIGN' })} heading={`Assign ${policy.name} to…`}>
      <s-stack gap="small">
        <s-stack direction="inline">
          <s-button-group gap="none" accessibilityLabel="Target type">
            {targets.map((t) => (
              <s-press-button
                key={t.id}
                slot="secondary-actions"
                pressed={targetType === t.id}
                onClick={(e) => {
                  // A press button flips itself on click; the picked one stays pressed.
                  e.currentTarget.pressed = true;
                  if (targetType !== t.id) switchTarget(t.id);
                }}
              >
                {t.label}
              </s-press-button>
            ))}
          </s-button-group>
        </s-stack>

        {isGlobal ? (
          <s-banner tone="info">{`Make “${policy.name}” the ${globalLabel}. It applies wherever no more specific pricing is assigned.`}</s-banner>
        ) : choicesFor.length === 0 ? (
          <s-paragraph color="subdued">No eligible targets of this type.</s-paragraph>
        ) : (
          <s-choice-list
            key={targetType}
            label="Assign to"
            labelAccessibilityVisibility="exclusive"
            name={`multi-assign-${targetType}`}
            multiple
            onChange={(e) => setIds(e.currentTarget.values || [])}
          >
            {choicesFor.map((c) => (
              <s-choice key={c.value} value={c.value} selected={ids.includes(c.value)}>
                {c.label}
              </s-choice>
            ))}
          </s-choice-list>
        )}
      </s-stack>

      <s-button slot="primary-action" variant="primary" disabled={!isGlobal && ids.length === 0} onClick={confirm}>
        Assign
      </s-button>
      <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'CLOSE_MULTI_ASSIGN' })}>
        Cancel
      </s-button>
    </Modal>
  );
}
