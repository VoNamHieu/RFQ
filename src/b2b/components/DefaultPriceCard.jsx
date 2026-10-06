import React from 'react';
import { useStore } from '../store.jsx';

const ADJUSTMENTS = [
  { label: 'Decrease by %', value: 'decrease_pct' },
  { label: 'Decrease by amount', value: 'decrease_amt' },
  { label: 'Fixed price', value: 'set' },
  { label: 'Keep Shopify price', value: 'keep' },
];

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
    <s-section heading="Default price">
      <s-stack gap="small">
        <s-paragraph color="subdued" fontSize="small">
          Applies to every product, before pricing rules and product overrides.
        </s-paragraph>
        <s-grid gridTemplateColumns={kind !== 'keep' ? '210px 140px' : '210px'} gap="small-200" alignItems="end">
          <s-select label="Adjustment" value={kind} onChange={(e) => setKind(e.currentTarget.value)}>
            {ADJUSTMENTS.map((o) => (
              <s-option key={o.value} value={o.value}>
                {o.label}
              </s-option>
            ))}
          </s-select>
          {kind !== 'keep' && (
            <s-number-field
              label="Value"
              min={0}
              suffix={suffix}
              value={String(b.value ?? '')}
              autocomplete="off"
              onInput={(e) => patch({ value: Number(e.currentTarget.value) })}
            />
          )}
        </s-grid>
      </s-stack>
    </s-section>
  );
}
