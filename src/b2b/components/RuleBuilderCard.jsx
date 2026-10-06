import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store.jsx';
import { MenuButton } from '../../shared/wc.jsx';
import {
  RULE_FIELDS,
  ruleField,
  ruleValues,
  ruleTypeLabel,
  ruleValuesSummary,
  ruleAdjustmentLabel,
  conditionValueOptions,
  ruleMatchCount,
} from '../pricing.js';

// Conditional-rule list for the base pricing editor (spec §5.3): collapsed rows
// with drag-to-reorder, an inline editor per rule, an add-rule menu, a >5-rule
// scroll container, and rAF edge auto-scroll while dragging.
export function RuleBuilderCard() {
  const { state, dispatch } = useStore();
  const rules = state.builder?.conditionalRules || [];
  const ruleEdit = state.ruleEdit;
  const products = state.db.products;

  const [dropIndex, setDropIndex] = useState(null);
  const scrollRef = useRef(null);
  const dragIndex = useRef(null);
  const pointerY = useRef(0);
  const rafRef = useRef(null);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const scrollable = rules.length > 5 && ruleEdit == null;
  const hasAll = rules.some((r) => ruleField(r) === 'all');

  const stopAutoScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };
  const startAutoScroll = () => {
    if (rafRef.current) return;
    const tick = () => {
      const el = scrollRef.current;
      if (dragIndex.current == null || !el) {
        rafRef.current = null;
        return;
      }
      const r = el.getBoundingClientRect();
      const EDGE = 44;
      const MAX = 16;
      const y = pointerY.current;
      let dy = 0;
      if (y < r.top + EDGE) dy = -MAX * Math.min(1, (r.top + EDGE - y) / EDGE);
      else if (y > r.bottom - EDGE) dy = MAX * Math.min(1, (y - (r.bottom - EDGE)) / EDGE);
      if (dy) el.scrollTop += dy;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const onDragStart = (e, i) => {
    dragIndex.current = i;
    pointerY.current = e.clientY;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    startAutoScroll();
  };
  const onDragOver = (e, i) => {
    if (dragIndex.current == null) return;
    e.preventDefault();
    pointerY.current = e.clientY;
    if (i !== dragIndex.current) setDropIndex(i);
  };
  const onDrop = (e, i) => {
    if (dragIndex.current == null) return;
    e.preventDefault();
    const from = dragIndex.current;
    dragIndex.current = null;
    setDropIndex(null);
    stopAutoScroll();
    if (from !== i) dispatch({ type: 'MOVE_RULE', from, to: i });
  };
  const onDragEnd = () => {
    dragIndex.current = null;
    setDropIndex(null);
    stopAutoScroll();
  };

  const collapsedRow = (rule, i) => {
    const disc = ruleAdjustmentLabel(rule);
    const tone = rule.rule !== 'set' && rule.value ? 'success' : undefined;
    return (
      <div
        key={rule.id}
        draggable
        onDragStart={(e) => onDragStart(e, i)}
        onDragOver={(e) => onDragOver(e, i)}
        onDrop={(e) => onDrop(e, i)}
        onDragEnd={onDragEnd}
        style={{
          border: '1px solid var(--p-color-border)',
          borderRadius: 8,
          marginBottom: 8,
          background: 'var(--p-color-bg-surface)',
          boxShadow: dropIndex === i ? 'inset 0 2px 0 0 var(--p-color-bg-fill-emphasis)' : 'none',
        }}
      >
        <s-box padding="small-200">
          <s-grid gridTemplateColumns="auto minmax(0, 1fr) auto auto auto" gap="small-200" alignItems="center">
            <span style={{ cursor: 'grab', display: 'flex' }} aria-label="Drag to reorder">
              <s-icon type="drag-handle" color="subdued" />
            </span>
            <div style={{ minWidth: 0 }}>
              <s-paragraph fontWeight="semibold">{`Rule ${i + 1}`}</s-paragraph>
              <s-paragraph color="subdued" fontSize="small">
                {`${ruleTypeLabel(rule)}${ruleField(rule) === 'all' ? '' : ` · ${ruleValuesSummary(rule)}`}`}
              </s-paragraph>
            </div>
            <s-badge tone={tone}>{disc}</s-badge>
            <s-button
              icon="edit"
              variant="tertiary"
              accessibilityLabel="Edit rule"
              onClick={() => dispatch({ type: 'SET_RULE_EDIT', index: i })}
            />
            <s-button
              icon="delete"
              tone="critical"
              variant="tertiary"
              accessibilityLabel="Delete rule"
              onClick={() => dispatch({ type: 'DELETE_RULE', index: i })}
            />
          </s-grid>
        </s-box>
      </div>
    );
  };

  const editorRow = (rule, i) => {
    const field = ruleField(rule);
    const values = ruleValues(rule);
    const options = conditionValueOptions(field, products);
    const remaining = options.filter((o) => !values.includes(o));
    const matchN = ruleMatchCount(rule, products);
    const rk = rule.rule === 'set' ? 'set' : rule.valueType === 'amount' ? 'decrease_amt' : 'decrease_pct';
    const suffix = rk === 'decrease_pct' ? '%' : '$';

    const setValues = (next) =>
      dispatch({
        type: 'UPDATE_RULE',
        index: i,
        patch: { conditions: [{ field, operator: 'is', values: next }] },
      });
    const setRk = (v) => {
      const patch =
        v === 'set'
          ? { rule: 'set', valueType: 'amount' }
          : v === 'decrease_amt'
            ? { rule: 'decrease', valueType: 'amount' }
            : { rule: 'decrease', valueType: 'percentage' };
      dispatch({ type: 'UPDATE_RULE', index: i, patch });
    };

    return (
      <div
        key={rule.id}
        style={{
          border: '1px solid var(--p-color-border-emphasis)',
          borderRadius: 8,
          marginBottom: 8,
          boxShadow: '0 0 0 3px var(--p-color-bg-surface-secondary)',
          background: 'var(--p-color-bg-surface)',
        }}
      >
        <s-box padding="base">
          <s-stack gap="small">
            <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-badge>{ruleTypeLabel(rule)}</s-badge>
                <s-text color="subdued" fontSize="small">
                  {`${matchN} product${matchN === 1 ? '' : 's'} match`}
                </s-text>
              </s-stack>
              <s-button
                icon="delete"
                tone="critical"
                variant="tertiary"
                accessibilityLabel="Delete rule"
                onClick={() => dispatch({ type: 'DELETE_RULE', index: i })}
              />
            </s-grid>

            {field === 'all' ? (
              <s-paragraph color="subdued" fontSize="small">
                Every product in this price list.
              </s-paragraph>
            ) : (
              <s-stack gap="small-300">
                <s-paragraph fontSize="small" fontWeight="medium">
                  {`Apply to these ${ruleTypeLabel(rule).toLowerCase()} values`}
                </s-paragraph>
                {values.length > 0 && (
                  <s-stack direction="inline" gap="small-400">
                    {values.map((v) => (
                      <s-clickable-chip
                        key={v}
                        removable
                        accessibilityLabel={v}
                        onRemove={() => setValues(values.filter((x) => x !== v))}
                      >
                        {v}
                      </s-clickable-chip>
                    ))}
                  </s-stack>
                )}
                {remaining.length > 0 && (
                  // Keyed by the picked values so the select remounts (back to the
                  // placeholder) after each pick — its value is always "".
                  <s-select
                    key={values.join('|')}
                    label="Add value"
                    labelAccessibilityVisibility="exclusive"
                    placeholder={values.length ? 'Add another…' : 'Select…'}
                    value=""
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      // Idempotent: onChange can fire twice for one pick.
                      if (v && !values.includes(v)) setValues([...values, v]);
                    }}
                  >
                    {remaining.map((o) => (
                      <s-option key={o} value={o}>
                        {o}
                      </s-option>
                    ))}
                  </s-select>
                )}
              </s-stack>
            )}

            <s-grid gridTemplateColumns="190px 140px" gap="small-200" alignItems="end">
              <s-select label="Price" value={rk} onChange={(e) => setRk(e.currentTarget.value)}>
                <s-option value="decrease_pct">Decrease by %</s-option>
                <s-option value="decrease_amt">Decrease by amount</s-option>
                <s-option value="set">Fixed price</s-option>
              </s-select>
              <s-number-field
                label="Value"
                labelAccessibilityVisibility="exclusive"
                min={0}
                value={String(rule.value ?? '')}
                onInput={(e) => dispatch({ type: 'UPDATE_RULE', index: i, patch: { value: Number(e.currentTarget.value) } })}
                suffix={suffix}
                autocomplete="off"
              />
            </s-grid>

            <s-stack direction="inline" justifyContent="end">
              <s-button variant="primary" onClick={() => dispatch({ type: 'SET_RULE_EDIT', index: null })}>
                Done
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </div>
    );
  };

  const rowsMarkup = rules.map((rule, i) => (ruleEdit === i ? editorRow(rule, i) : collapsedRow(rule, i)));

  // Popover + ActionList → MenuButton (s-menu renders in the top layer, so it
  // opens above the full-screen editor overlay without a z-index override).
  const addControl = (
    <MenuButton
      icon="plus"
      items={RULE_FIELDS.map((f) => ({
        content: f.label,
        disabled: f.field === 'all' && hasAll,
        onAction: () => dispatch({ type: 'ADD_RULE', field: f.field }),
      }))}
    >
      Add rule
    </MenuButton>
  );

  return (
    <s-section>
      <s-stack gap="small">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-heading>Pricing rules</s-heading>
          {rules.length > 0 && <s-badge>{String(rules.length)}</s-badge>}
        </s-stack>
        <s-paragraph color="subdued" fontSize="small">
          Price all products or a set by collection, vendor, tag or type. When several rules match one product, the higher rule wins — drag the handle to reorder.
        </s-paragraph>

        {rules.length === 0 ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack gap="small-200" alignItems="center">
              <s-paragraph fontWeight="semibold">No pricing rules</s-paragraph>
              {/* s-paragraph ignores text-align (its inner <p> sets start); inline
                  s-text in a centered block centers. */}
              <div style={{ textAlign: 'center' }}>
                <s-text color="subdued" fontSize="small">
                  Every product keeps its Shopify price. Add an “All products” rule to price the whole catalog, or a narrower rule for a subset.
                </s-text>
              </div>
              {addControl}
            </s-stack>
          </s-box>
        ) : (
          <div>
            <div
              ref={scrollRef}
              style={
                scrollable
                  ? { maxHeight: 334, overflowY: 'auto', overflowX: 'hidden', margin: '0 -4px', padding: '2px 4px' }
                  : undefined
              }
            >
              {rowsMarkup}
            </div>
            <s-box paddingBlockStart="small-200">{addControl}</s-box>
          </div>
        )}
      </s-stack>
    </s-section>
  );
}
