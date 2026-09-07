import React, { useState } from 'react';
import { Combobox, Listbox, Icon, Checkbox, Text, InlineStack, Tag } from '@shopify/polaris';
import { ChevronDownIcon } from '@shopify/polaris-icons';

// The pricing picker shared by the company section's "Add base pricing" flow
// (AssignModal) and the Add-company wizard: a Combobox whose options carry
// checkboxes (Combobox owns the floating overlay so it positions correctly inside
// a Modal), with the picks shown as removable Tags below. Multi-select unless
// `single`. Presentational — the caller owns `selectedIds` and gets `onChange`.
export function PricingCombobox({
  label,
  placeholder,
  candidates,
  selectedIds,
  onChange,
  single = false,
  optionLabel,
  emptyText = 'No matches',
}) {
  const [inputValue, setInputValue] = useState('');
  const q = inputValue.trim().toLowerCase();
  const filtered = q ? candidates.filter((p) => p.name.toLowerCase().includes(q)) : candidates;
  const selectedPolicies = candidates.filter((p) => selectedIds.includes(p.id));

  const handleSelect = (id) => {
    const on = selectedIds.includes(id);
    const next = single ? (on ? [] : [id]) : on ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    onChange(next);
    if (single) setInputValue('');
  };

  return (
    <>
      <Combobox
        allowMultiple={!single}
        activator={
          <Combobox.TextField
            autoComplete="off"
            label={label}
            labelHidden
            value={inputValue}
            suffix={<Icon source={ChevronDownIcon} tone="subdued" />}
            placeholder={placeholder}
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
              {emptyText}
            </Listbox.Option>
          </Listbox>
        )}
      </Combobox>
      {selectedPolicies.length > 0 && (
        <InlineStack gap="150">
          {selectedPolicies.map((p) => (
            <Tag key={p.id} onRemove={() => onChange(selectedIds.filter((id) => id !== p.id))}>
              {p.name}
            </Tag>
          ))}
        </InlineStack>
      )}
    </>
  );
}
