import React, { useRef, useState, useEffect } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Box,
  Text,
  Badge,
  Button,
  Popover,
  ActionList,
  Select,
  TextField,
  Tag,
  Icon,
  Divider,
} from '@shopify/polaris';
import { DragHandleIcon, EditIcon, DeleteIcon, PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
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

  const [addMenu, setAddMenu] = useState(false);
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
        <Box padding="200">
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            <span style={{ cursor: 'grab', display: 'flex' }} aria-label="Drag to reorder">
              <Icon source={DragHandleIcon} tone="subdued" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {`Rule ${i + 1}`}
              </Text>
              <Text as="p" tone="subdued" variant="bodySm">
                {`${ruleTypeLabel(rule)}${ruleField(rule) === 'all' ? '' : ` · ${ruleValuesSummary(rule)}`}`}
              </Text>
            </div>
            <Badge tone={tone}>{disc}</Badge>
            <Button size="slim" onClick={() => dispatch({ type: 'SET_RULE_EDIT', index: i })}>
              Edit
            </Button>
            <Button
              size="slim"
              icon={DeleteIcon}
              tone="critical"
              variant="tertiary"
              accessibilityLabel="Delete rule"
              onClick={() => dispatch({ type: 'DELETE_RULE', index: i })}
            />
          </InlineStack>
        </Box>
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
        <Box padding="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Badge>{ruleTypeLabel(rule)}</Badge>
                <Text as="span" tone="subdued" variant="bodySm">
                  {`${matchN} product${matchN === 1 ? '' : 's'} match`}
                </Text>
              </InlineStack>
              <Button
                icon={DeleteIcon}
                tone="critical"
                variant="tertiary"
                accessibilityLabel="Delete rule"
                onClick={() => dispatch({ type: 'DELETE_RULE', index: i })}
              />
            </InlineStack>

            {field === 'all' ? (
              <Text as="p" tone="subdued" variant="bodySm">
                Every product in this price list.
              </Text>
            ) : (
              <BlockStack gap="150">
                <Text as="span" variant="bodySm" fontWeight="medium">
                  {`Apply to these ${ruleTypeLabel(rule).toLowerCase()} values`}
                </Text>
                <InlineStack gap="100" wrap>
                  {values.map((v) => (
                    <Tag key={v} onRemove={() => setValues(values.filter((x) => x !== v))}>
                      {v}
                    </Tag>
                  ))}
                </InlineStack>
                {remaining.length > 0 && (
                  <Select
                    labelHidden
                    label="Add value"
                    placeholder={values.length ? 'Add another…' : 'Select…'}
                    options={['', ...remaining].map((o) => ({ label: o || 'Select…', value: o }))}
                    value=""
                    onChange={(v) => v && setValues([...values, v])}
                  />
                )}
              </BlockStack>
            )}

            <InlineStack gap="200" blockAlign="end">
              <div style={{ minWidth: 190 }}>
                <Select
                  label="Price"
                  options={[
                    { label: 'Decrease by %', value: 'decrease_pct' },
                    { label: 'Decrease by amount', value: 'decrease_amt' },
                    { label: 'Fixed price', value: 'set' },
                  ]}
                  value={rk}
                  onChange={setRk}
                />
              </div>
              <div style={{ width: 140 }}>
                <TextField
                  label="Value"
                  labelHidden
                  type="number"
                  min={0}
                  value={String(rule.value ?? '')}
                  onChange={(v) => dispatch({ type: 'UPDATE_RULE', index: i, patch: { value: Number(v) } })}
                  suffix={suffix}
                  autoComplete="off"
                />
              </div>
            </InlineStack>

            <InlineStack align="end">
              <Button variant="primary" size="slim" onClick={() => dispatch({ type: 'SET_RULE_EDIT', index: null })}>
                Done
              </Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </div>
    );
  };

  const rowsMarkup = rules.map((rule, i) => (ruleEdit === i ? editorRow(rule, i) : collapsedRow(rule, i)));

  const addControl = (
    <Popover
      active={addMenu}
      onClose={() => setAddMenu(false)}
      preferredAlignment="left"
      // The editor is a custom full-screen overlay at z-index 517 (PricingEditor),
      // above Polaris' default overlay z-index (400) — so without this the menu
      // opens *behind* the editor and looks like the button does nothing. Lift it
      // over the editor but keep it under the Frame toast (520).
      zIndexOverride={518}
      activator={
        <Button icon={PlusIcon} disclosure onClick={() => setAddMenu((v) => !v)}>
          Add rule
        </Button>
      }
    >
      <ActionList
        items={RULE_FIELDS.map((f) => ({
          content: f.label,
          disabled: f.field === 'all' && hasAll,
          onAction: () => {
            setAddMenu(false);
            dispatch({ type: 'ADD_RULE', field: f.field });
          },
        }))}
      />
    </Popover>
  );

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="150" blockAlign="center">
            <Text as="h3" variant="headingSm">
              Pricing rules
            </Text>
            {rules.length > 0 && <Badge>{String(rules.length)}</Badge>}
          </InlineStack>
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">
          Price all products or a set by collection, vendor, tag or type. When several rules match one product, the higher rule wins — drag the handle to reorder.
        </Text>

        {rules.length === 0 ? (
          <Box padding="400" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="200" inlineAlign="center">
              <Text as="p" fontWeight="semibold">
                No pricing rules
              </Text>
              <Text as="p" tone="subdued" variant="bodySm" alignment="center">
                Every product keeps its Shopify price. Add an “All products” rule to price the whole catalog, or a narrower rule for a subset.
              </Text>
              {addControl}
            </BlockStack>
          </Box>
        ) : (
          <BlockStack gap="0">
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
            <Box paddingBlockStart="200">{addControl}</Box>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
