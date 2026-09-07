import React, { useState } from 'react';
import { Modal, BlockStack, Box, Text, Button, InlineStack, Combobox, Listbox, Icon, Checkbox, Tag } from '@shopify/polaris';
import { PlusIcon, ChevronDownIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityPolicy, scopeTypeLabel } from '../pricing.js';

const fmtDate = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

// "When" summary, mirroring the god file (e.g. "From Aug 27, 2026 12:00 AM").
function whenLabel(p) {
  if (!p.startDate) return 'Always on';
  let s = `From ${fmtDate(p.startDate)} ${p.startTime || '12:00 AM'}`;
  if (p.endDate) s += ` until ${fmtDate(p.endDate)} ${p.endTime || '12:00 AM'}`;
  return s;
}

function SummaryRow({ label, value }) {
  return (
    <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
      <Text as="span" tone="subdued" variant="bodySm">{label}</Text>
      <Text as="span" variant="bodyMd">{value}</Text>
    </InlineStack>
  );
}

// Assign existing pricing(s) to a company, or swap one for another (spec §2.8),
// laid out like the god file's "Assign price list" modal: a Combobox dropdown whose
// options carry checkboxes (Combobox manages the floating overlay so it positions
// correctly inside the Modal), the picks shown as removable tags, OR create a new
// one, then a "What they will get" summary. Base add is MULTI-select; quantity and
// swap are single-slot.
export function AssignModal() {
  const { state, dispatch } = useStore();
  const [inputValue, setInputValue] = useState('');
  const a = state.assign;
  if (!a) return null;
  const isQuantity = a.kind === 'quantity';
  const kindName = isQuantity ? 'quantity pricing' : 'base pricing';
  const isSwap = a.mode === 'swap';
  const single = isQuantity || isSwap;
  const company = state.db.companies.find((c) => c.id === a.companyId);
  const assignedIds = isQuantity
    ? [companyQuantityPolicy(company, state.db.policies)?.id].filter(Boolean)
    : companyBaseEntries(company, state.db.policies).map((e) => e.policy.id);

  const candidates = state.db.policies.filter(
    (p) =>
      (isQuantity ? p.priceKind === 'quantity' : p.priceKind !== 'quantity') &&
      p.audienceType === 'b2b' &&
      (isSwap ? p.id !== a.swapId : true) &&
      !assignedIds.includes(p.id),
  );

  const swapped = isSwap ? state.db.policies.find((p) => p.id === a.swapId) : null;
  const selectedIds = a.selectedIds || [];
  const selectedPolicies = candidates.filter((p) => selectedIds.includes(p.id));

  const optionLabel = (p) =>
    isQuantity ? `${p.name} · ${scopeTypeLabel(p)}` : `${p.name} · Priority ${p.priority ?? '—'} · ${scopeTypeLabel(p)}`;

  const q = inputValue.trim().toLowerCase();
  const filtered = q ? candidates.filter((p) => p.name.toLowerCase().includes(q)) : candidates;

  const handleSelect = (id) => {
    const on = selectedIds.includes(id);
    const next = single ? (on ? [] : [id]) : on ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    dispatch({ type: 'ASSIGN_SET', ids: next });
    if (single) setInputValue('');
  };

  const createNew = () => {
    dispatch({ type: 'CLOSE_ASSIGN' });
    dispatch({
      type: 'OPEN_EDITOR',
      policy: null,
      kind: a.kind,
      context: { mode: isQuantity ? 'add-quantity' : 'add-base', companyId: a.companyId },
    });
  };

  return (
    <Modal
      open
      onClose={() => dispatch({ type: 'CLOSE_ASSIGN' })}
      title={isSwap ? `Change ${swapped?.name || kindName}` : `Assign ${kindName}: ${company?.name || ''}`}
      primaryAction={{
        content: isSwap ? 'Change' : 'Assign',
        onAction: () => dispatch({ type: 'ASSIGN_CONFIRM' }),
        disabled: selectedIds.length === 0,
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
                <Combobox
                  allowMultiple={!single}
                  activator={
                    <Combobox.TextField
                      autoComplete="off"
                      label={`Use an existing ${kindName}`}
                      labelHidden
                      value={inputValue}
                      suffix={<Icon source={ChevronDownIcon} tone="subdued" />}
                      placeholder={`Select ${kindName}`}
                      onChange={setInputValue}
                    />
                  }
                >
                  {filtered.length > 0 ? (
                    <Listbox onSelect={handleSelect}>
                      {filtered.map((p) => {
                        const on = selectedIds.includes(p.id);
                        return (
                          <Listbox.Option key={p.id} value={p.id} selected={on} accessibilityLabel={p.name}>
                            <InlineStack gap="200" blockAlign="center" wrap={false}>
                              <span style={{ pointerEvents: 'none', display: 'inline-flex' }}>
                                <Checkbox label="" labelHidden checked={on} onChange={() => {}} />
                              </span>
                              <Text as="span" variant="bodyMd">{optionLabel(p)}</Text>
                            </InlineStack>
                          </Listbox.Option>
                        );
                      })}
                    </Listbox>
                  ) : (
                    <Listbox>
                      <Listbox.Option value="__none" accessibilityLabel="No matches" disabled>
                        No matching {kindName}
                      </Listbox.Option>
                    </Listbox>
                  )}
                </Combobox>
                {selectedPolicies.length > 0 && (
                  <InlineStack gap="150">
                    {selectedPolicies.map((p) => (
                      <Tag key={p.id} onRemove={() => dispatch({ type: 'ASSIGN_SET', ids: selectedIds.filter((id) => id !== p.id) })}>
                        {p.name}
                      </Tag>
                    ))}
                  </InlineStack>
                )}
                {!single && (
                  <Text as="p" tone="subdued" variant="bodySm">Pick one or more — the lowest priority applies first.</Text>
                )}
              </>
            )}
          </BlockStack>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--p-color-border)' }} />
            <Text as="span" tone="subdued" variant="bodySm">OR</Text>
            <div style={{ flex: 1, height: 1, background: 'var(--p-color-border)' }} />
          </div>

          <Button icon={PlusIcon} fullWidth onClick={createNew}>{`Create a new ${kindName}`}</Button>

          {/* Preview only makes sense for a single pick; hide it once multiple are chosen. */}
          {selectedPolicies.length === 1 && (
            <Box background="bg-surface-secondary" borderRadius="200" padding="300">
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">What they will get</Text>
                <BlockStack gap="100">
                  <SummaryRow label="Products" value={scopeTypeLabel(selectedPolicies[0])} />
                  {!isQuantity && <SummaryRow label="Priority" value={String(selectedPolicies[0].priority ?? '—')} />}
                  <SummaryRow label="When" value={whenLabel(selectedPolicies[0])} />
                </BlockStack>
              </BlockStack>
            </Box>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
