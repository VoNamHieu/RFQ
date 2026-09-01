import React, { useState } from 'react';
import { Modal, BlockStack, Text, ButtonGroup, Button, ChoiceList, Banner, Box } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { companyForCustomerEmail } from '../pricing.js';

// Assign one pricing profile to many targets at once (legacy renderAssign, the
// unlocked/target-picker path): companies, customers, customer tags, or the
// store-wide default. Target types are constrained by the policy's audience.
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
        { id: 'global', label: 'Store-wide' },
      ];

  const companyChoices = state.db.companies.map((c) => ({ label: c.name, value: c.id }));
  const customerChoices = (state.db.customers || [])
    .filter((cu) => !companyForCustomerEmail(state.db, cu.email))
    .map((cu) => ({ label: `${cu.name} · ${cu.email}`, value: cu.id }));
  const tagChoices = (state.db.tagPricing || []).map((t) => ({ label: t.name, value: t.id }));

  const choicesFor = { company: companyChoices, customer: customerChoices, tag: tagChoices }[targetType] || [];
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
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_MULTI_ASSIGN' })}
      title={`Assign ${policy.name} to…`}
      primaryAction={{ content: 'Assign', onAction: confirm, disabled: !isGlobal && ids.length === 0 }}
      secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_MULTI_ASSIGN' }) }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <ButtonGroup variant="segmented">
            {targets.map((t) => (
              <Button key={t.id} pressed={targetType === t.id} onClick={() => switchTarget(t.id)}>
                {t.label}
              </Button>
            ))}
          </ButtonGroup>

          {isGlobal ? (
            <Banner tone="info">
              {`Make “${policy.name}” the ${globalLabel}. It applies wherever no more specific pricing is assigned.`}
            </Banner>
          ) : choicesFor.length === 0 ? (
            <Text as="p" tone="subdued">No eligible targets of this type.</Text>
          ) : (
            <Box maxWidth="100%">
              <ChoiceList allowMultiple title="Assign to" titleHidden choices={choicesFor} selected={ids} onChange={setIds} />
            </Box>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
