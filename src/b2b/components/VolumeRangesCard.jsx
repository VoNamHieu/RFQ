import React from 'react';
import { Card, BlockStack, InlineStack, Box, Text, Button, TextField, Select, Icon } from '@shopify/polaris';
import { DeleteIcon, PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';

// Volume (quantity) pricing tiers editor (spec §5.2 / quantityEditor). Each tier
// is {id, from, to (null = ∞), valueType, value}; higher quantities pay less.
export function VolumeRangesCard() {
  const { state, dispatch } = useStore();
  const ranges = state.builder?.volumeRanges || [];

  const setRanges = (next) => dispatch({ type: 'BUILDER_PATCH', patch: { volumeRanges: next } });
  const patchRange = (i, patch) => setRanges(ranges.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const removeRange = (i) => setRanges(ranges.filter((_, k) => k !== i));
  const addRange = () => {
    const last = ranges[ranges.length - 1];
    const from = last ? (last.to != null ? last.to + 1 : (last.from || 0) + 10) : 1;
    setRanges([...ranges, { id: `r${ranges.length + 1}`, from, to: null, valueType: 'percentage', value: 0 }]);
  };

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">
          Volume tiers
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          Set a discount that kicks in as the quantity goes up. Leave the last “To” blank for “and above”.
        </Text>

        <BlockStack gap="200">
          <InlineStack gap="200">
            <div style={{ width: 90 }}>
              <Text as="span" tone="subdued" variant="bodySm">
                From qty
              </Text>
            </div>
            <div style={{ width: 90 }}>
              <Text as="span" tone="subdued" variant="bodySm">
                To qty
              </Text>
            </div>
            <div style={{ flex: 1 }}>
              <Text as="span" tone="subdued" variant="bodySm">
                Discount
              </Text>
            </div>
          </InlineStack>

          {ranges.map((r, i) => {
            const suffix = r.valueType === 'percentage' ? '%' : '$';
            return (
              <InlineStack key={r.id || i} gap="200" blockAlign="end" wrap={false}>
                <div style={{ width: 90 }}>
                  <TextField
                    label="From"
                    labelHidden
                    type="number"
                    min={1}
                    value={String(r.from ?? '')}
                    onChange={(v) => patchRange(i, { from: Number(v) })}
                    autoComplete="off"
                  />
                </div>
                <div style={{ width: 90 }}>
                  <TextField
                    label="To"
                    labelHidden
                    type="number"
                    placeholder="∞"
                    value={r.to == null ? '' : String(r.to)}
                    onChange={(v) => patchRange(i, { to: v === '' ? null : Number(v) })}
                    autoComplete="off"
                  />
                </div>
                <div style={{ width: 130 }}>
                  <Select
                    label="Type"
                    labelHidden
                    options={[
                      { label: 'Decrease %', value: 'percentage' },
                      { label: 'Decrease $', value: 'amount' },
                    ]}
                    value={r.valueType}
                    onChange={(v) => patchRange(i, { valueType: v })}
                  />
                </div>
                <div style={{ width: 100 }}>
                  <TextField
                    label="Value"
                    labelHidden
                    type="number"
                    min={0}
                    suffix={suffix}
                    value={String(r.value ?? '')}
                    onChange={(v) => patchRange(i, { value: Number(v) })}
                    autoComplete="off"
                  />
                </div>
                <Button
                  icon={DeleteIcon}
                  variant="tertiary"
                  tone="critical"
                  accessibilityLabel="Remove tier"
                  onClick={() => removeRange(i)}
                />
              </InlineStack>
            );
          })}
        </BlockStack>

        <Box>
          <Button icon={PlusIcon} onClick={addRange}>
            Add tier
          </Button>
        </Box>
      </BlockStack>
    </Card>
  );
}
