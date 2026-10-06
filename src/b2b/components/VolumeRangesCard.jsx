import React from 'react';
import { useStore } from '../store.jsx';

// Fixed column widths for the tier rows (From · To · Type · Value · remove).
const ROW_COLUMNS = '90px 90px 130px 100px auto';

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
    <s-section heading="Volume tiers">
      <s-stack gap="small">
        <s-paragraph color="subdued" fontSize="small">
          Set a discount that kicks in as the quantity goes up. Leave the last “To” blank for “and above”.
        </s-paragraph>

        <s-stack gap="small-200">
          <s-grid gridTemplateColumns="90px 90px 1fr" gap="small-200">
            <s-text color="subdued" fontSize="small">
              From qty
            </s-text>
            <s-text color="subdued" fontSize="small">
              To qty
            </s-text>
            <s-text color="subdued" fontSize="small">
              Discount
            </s-text>
          </s-grid>

          {ranges.map((r, i) => {
            const suffix = r.valueType === 'percentage' ? '%' : '$';
            return (
              <s-grid key={r.id || i} gridTemplateColumns={ROW_COLUMNS} gap="small-200" alignItems="end">
                <s-number-field
                  label="From"
                  labelAccessibilityVisibility="exclusive"
                  min={1}
                  inputMode="numeric"
                  value={String(r.from ?? '')}
                  onInput={(e) => patchRange(i, { from: Number(e.currentTarget.value) })}
                  autocomplete="off"
                />
                <s-number-field
                  label="To"
                  labelAccessibilityVisibility="exclusive"
                  inputMode="numeric"
                  placeholder="∞"
                  value={r.to == null ? '' : String(r.to)}
                  onInput={(e) => {
                    const v = e.currentTarget.value;
                    patchRange(i, { to: v === '' ? null : Number(v) });
                  }}
                  autocomplete="off"
                />
                <s-select
                  label="Type"
                  labelAccessibilityVisibility="exclusive"
                  value={r.valueType}
                  onChange={(e) => patchRange(i, { valueType: e.currentTarget.value })}
                >
                  <s-option value="percentage">Decrease %</s-option>
                  <s-option value="amount">Decrease $</s-option>
                </s-select>
                <s-number-field
                  label="Value"
                  labelAccessibilityVisibility="exclusive"
                  min={0}
                  suffix={suffix}
                  value={String(r.value ?? '')}
                  onInput={(e) => patchRange(i, { value: Number(e.currentTarget.value) })}
                  autocomplete="off"
                />
                <s-button
                  icon="delete"
                  variant="tertiary"
                  tone="critical"
                  accessibilityLabel="Remove tier"
                  onClick={() => removeRange(i)}
                />
              </s-grid>
            );
          })}
        </s-stack>

        <s-stack direction="inline">
          <s-button icon="plus" onClick={addRange}>
            Add tier
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
