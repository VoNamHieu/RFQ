import React from 'react';
import { Modal, BlockStack, Box, Text, RadioButton, Button, Badge, InlineStack } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { companyBaseEntries, scopeTypeLabel } from '../pricing.js';

// Assign an existing base pricing to a company, or swap one for another
// (spec §2.8 target-locked). "Create new" hands off to the editor.
export function AssignModal() {
  const { state, dispatch } = useStore();
  const a = state.assign;
  if (!a) return null;
  const company = state.db.companies.find((c) => c.id === a.companyId);
  const assignedIds = companyBaseEntries(company, state.db.policies).map((e) => e.policy.id);

  // Candidate bases: b2b base policies not already on the company (swap keeps the one being replaced out too).
  const candidates = state.db.policies.filter(
    (p) => p.priceKind === 'base' && p.audienceType === 'b2b' && (a.mode === 'swap' ? p.id !== a.swapId : true) && !assignedIds.includes(p.id),
  );

  const isSwap = a.mode === 'swap';
  const swapped = isSwap ? state.db.policies.find((p) => p.id === a.swapId) : null;

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_ASSIGN' })}
      title={isSwap ? `Change ${swapped?.name || 'base pricing'} to…` : 'Add a base pricing'}
      primaryAction={{
        content: isSwap ? 'Change' : 'Add',
        onAction: () => dispatch({ type: 'ASSIGN_CONFIRM' }),
        disabled: !a.selectedId,
      }}
      secondaryActions={[
        {
          content: 'Create a new base pricing',
          onAction: () => {
            dispatch({ type: 'CLOSE_ASSIGN' });
            dispatch({ type: 'OPEN_EDITOR', policy: null, context: { mode: 'add-base', companyId: a.companyId } });
          },
        },
        { content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_ASSIGN' }) },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Text as="p" tone="subdued" variant="bodySm">
            Pick a reusable base pricing from the library
            {isSwap ? ' to replace the current one.' : ' to add to this company. The lowest priority applies first.'}
          </Text>
          {candidates.length === 0 ? (
            <Text as="p" tone="subdued">
              No other base pricing available — create a new one.
            </Text>
          ) : (
            candidates.map((p) => (
              <Box
                key={p.id}
                padding="300"
                borderWidth="025"
                borderColor={a.selectedId === p.id ? 'border-emphasis' : 'border'}
                borderRadius="200"
              >
                <RadioButton
                  label={
                    <InlineStack gap="150" blockAlign="center">
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {p.name}
                      </Text>
                      <Badge size="small">{`Priority ${p.priority ?? '—'}`}</Badge>
                    </InlineStack>
                  }
                  helpText={scopeTypeLabel(p)}
                  checked={a.selectedId === p.id}
                  id={`assign-${p.id}`}
                  name="assign-base"
                  onChange={() => dispatch({ type: 'ASSIGN_SELECT', id: p.id })}
                />
              </Box>
            ))
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
