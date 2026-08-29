import React from 'react';
import { Card, BlockStack, InlineStack, Text, Select, TextField } from '@shopify/polaris';
import { useStore } from '../store.jsx';

// v1 base editor: a "Default price" applied to the whole catalog, before rules
// and product overrides. Maps to the policy's profile-level pricingRule/value.
export function DefaultPriceCard() {
  const { state, dispatch } = useStore();
  const b = state.builder;
  const patch = (p) => dispatch({ type: 'BUILDER_PATCH', patch: p });

  const kind =
    b.pricingRule === 'keep' || !b.pricingRule
      ? 'keep'
      : b.pricingRule === 'set'
        ? 'set'
        : b.valueType === 'amount'
          ? 'decrease_amt'
          : 'decrease_pct';

  const setKind = (v) => {
    const map = {
      keep: { pricingRule: 'keep' },
      decrease_pct: { pricingRule: 'decrease', valueType: 'percentage' },
      decrease_amt: { pricingRule: 'decrease', valueType: 'amount' },
      set: { pricingRule: 'set', valueType: 'amount' },
    };
    patch(map[v]);
  };

  const suffix = kind === 'decrease_pct' ? '%' : '$';

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">
          Default price
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          Applies to every product, before pricing rules and product overrides.
        </Text>
        <InlineStack gap="200" blockAlign="end">
          <div style={{ minWidth: 210 }}>
            <Select
              label="Adjustment"
              options={[
                { label: 'Decrease by %', value: 'decrease_pct' },
                { label: 'Decrease by amount', value: 'decrease_amt' },
                { label: 'Fixed price', value: 'set' },
                { label: 'Keep Shopify price', value: 'keep' },
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>
          {kind !== 'keep' && (
            <div style={{ width: 140 }}>
              <TextField
                label="Value"
                type="number"
                min={0}
                suffix={suffix}
                value={String(b.value ?? '')}
                onChange={(v) => patch({ value: Number(v) })}
                autoComplete="off"
              />
            </div>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
