import React, { useEffect, useRef, useState } from 'react';
import { MenuButton } from '../../shared/wc.jsx';
import { ATTRIBUTE_SCOPES, newProductRule, productScopeLabel, ruleOverlaps, ruleSkus } from '../limits.js';
import { ProductScopeFields } from './pricingEditorCards.jsx';

// Rules picked by a product attribute; the values come from the catalog.
const ATTRIBUTE_PICKS = [
  { scopeType: 'tags', label: 'Product tags', field: 'tag', noun: 'tag' },
  { scopeType: 'vendors', label: 'Vendors', field: 'vendor', noun: 'vendor' },
  { scopeType: 'productTypes', label: 'Product types', field: 'productType', noun: 'product type' },
].map((a) => ({ ...a, key: ATTRIBUTE_SCOPES[a.scopeType].key }));
const SCOPES = [
  { scopeType: 'all', label: 'All products' },
  { scopeType: 'collection', label: 'Specific collections' },
  { scopeType: 'products', label: 'Specific products' },
  ...ATTRIBUTE_PICKS,
];
const filled = (v) => v !== '' && v != null;
// A rule's quantities as a badge: "Min 12 · Packs of 12".
function quantitiesLabel(r) {
  const parts = [
    filled(r.min) && (String(r.min) === '0' ? 'No minimum' : `Min ${r.min}`),
    filled(r.max) && `Max ${r.max}`,
    filled(r.increment) && (String(r.increment) === '1' ? 'No pack size' : `Packs of ${r.increment}`),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No quantities yet';
}

// A product limit's rules, laid out like the pricing editor's rules
// (RuleBuilderCard): collapsed rows with drag-to-reorder, one rule open at a time
// for editing, and an add-rule menu where "All products" is off once a rule has it.
// Rules are in order: a product in more than one takes the higher rule's quantities.
export function LimitRulesCard({ rules, setRules, ruleField, errors, products, db, startOpen }) {
  const [open, setOpen] = useState(startOpen);
  const [dropIndex, setDropIndex] = useState(null);
  const scrollRef = useRef(null);
  const dragIndex = useRef(null);
  const pointerY = useRef(0);
  const rafRef = useRef(null);
  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  const hasAll = rules.some((r) => r.scopeType === 'all');
  const overlaps = ruleOverlaps({ kind: 'product', rules }, db);
  const titleOf = (sku) => products.find((p) => p.sku === sku)?.title || sku;
  // Product titles can hold commas ("Industrial filter, XL"), so a list uses semicolons.
  const someTitles = (skus) => {
    const names = skus.slice(0, 3).map(titleOf);
    if (skus.length > 3) return `${names.join('; ')} and ${skus.length - 3} more`;
    return names.length > 1 ? `${names.slice(0, -1).join('; ')} and ${names.at(-1)}` : names[0];
  };
  const overlapNote = (left) => {
    const from = [...new Set(left.map((x) => x.rule + 1))];
    const n = left.length;
    return `${n} of these product${n === 1 ? ' is' : 's are'} already in ${from.length === 1 ? `rule ${from[0]}` : 'earlier rules'}, so ${n === 1 ? 'it follows' : 'they follow'} ${from.length === 1 ? 'that rule' : 'those'}: ${someTitles(left.map((x) => x.sku))}.`;
  };
  const matchCount = (r) => (r.scopeType === 'all' ? products.length : ruleSkus(r, db).length);
  const ruleErrors = (i) => Object.entries(errors).filter(([k]) => k === `rule-${i}` || k.startsWith(`rule-${i}-`)).map(([, v]) => v);

  const patchRule = (i, p) => setRules(rules.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const remove = (i) => {
    setRules(rules.filter((_, j) => j !== i));
    setOpen((o) => (o == null || o < i ? o : o === i ? null : o - 1));
  };
  const add = (scopeType) => {
    setRules([...rules, { ...newProductRule(), scopeType }]);
    setOpen(rules.length);
  };
  const move = (from, to) => {
    const next = [...rules];
    const [r] = next.splice(from, 1);
    next.splice(to, 0, r);
    setRules(next);
    setOpen((o) => (o === from ? to : o == null ? o : o > from && o <= to ? o - 1 : o < from && o >= to ? o + 1 : o));
  };

  // Drag to reorder, with the list scrolling at its edges (as in RuleBuilderCard).
  const scrollable = rules.length > 5 && open == null;
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
      const box = el.getBoundingClientRect();
      const EDGE = 44;
      const MAX = 16;
      const y = pointerY.current;
      let dy = 0;
      if (y < box.top + EDGE) dy = -MAX * Math.min(1, (box.top + EDGE - y) / EDGE);
      else if (y > box.bottom - EDGE) dy = MAX * Math.min(1, (y - (box.bottom - EDGE)) / EDGE);
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
    if (from !== i) move(from, i);
  };
  const onDragEnd = () => {
    dragIndex.current = null;
    setDropIndex(null);
    stopAutoScroll();
  };

  const collapsedRow = (r, i) => {
    const errs = ruleErrors(i);
    const scope = productScopeLabel(r);
    return (
      <div
        key={r.id}
        data-field={`rule-${i}`}
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
          <s-grid gridTemplateColumns={rules.length > 1 ? 'auto minmax(0, 1fr) auto auto auto' : 'auto minmax(0, 1fr) auto auto'} gap="small-200" alignItems="center">
            <span style={{ cursor: 'grab', display: 'flex' }} aria-label="Drag to reorder">
              <s-icon type="drag-handle" color="subdued" />
            </span>
            <div style={{ minWidth: 0 }}>
              <s-paragraph fontWeight="semibold">{`Rule ${i + 1}`}</s-paragraph>
              <s-paragraph color="subdued" fontSize="small">
                {scope[0].toUpperCase() + scope.slice(1)}
              </s-paragraph>
              {overlaps[i]?.length ? (
                <s-paragraph color="subdued" fontSize="small" data-field={`rule-${i}-overlap`}>
                  {overlapNote(overlaps[i])}
                </s-paragraph>
              ) : null}
              {errs.length ? (
                <s-paragraph tone="critical" fontSize="small">
                  {errs.join(' · ')}
                </s-paragraph>
              ) : null}
            </div>
            <s-badge>{quantitiesLabel(r)}</s-badge>
            <s-button icon="edit" variant="tertiary" accessibilityLabel={`Edit rule ${i + 1}`} onClick={() => setOpen(i)} />
            {rules.length > 1 ? <s-button icon="delete" tone="critical" variant="tertiary" accessibilityLabel={`Delete rule ${i + 1}`} onClick={() => remove(i)} /> : null}
          </s-grid>
        </s-box>
      </div>
    );
  };

  const editorRow = (r, i) => {
    const n = matchCount(r);
    return (
      <div
        key={r.id}
        data-field={`rule-${i}`}
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
                <s-badge>{`Rule ${i + 1}`}</s-badge>
                <s-text color="subdued" fontSize="small">{`${n} product${n === 1 ? '' : 's'} match`}</s-text>
              </s-stack>
              {rules.length > 1 ? <s-button icon="delete" tone="critical" variant="tertiary" accessibilityLabel={`Delete rule ${i + 1}`} onClick={() => remove(i)} /> : null}
            </s-grid>
            {/* The storefront's catalog too, so a product limit can be checked there. */}
            <ProductScopeFields builder={r} patch={(p) => patchRule(i, p)} products={products} allDisabled={hasAll && r.scopeType !== 'all'} attributeScopes={ATTRIBUTE_PICKS} />
            {errors[`rule-${i}-products`] && <s-paragraph tone="critical">{errors[`rule-${i}-products`]}</s-paragraph>}
            {overlaps[i]?.length ? (
              <s-paragraph color="subdued" fontSize="small" data-field={`rule-${i}-overlap`}>
                {overlapNote(overlaps[i])}
              </s-paragraph>
            ) : null}
            <s-query-container>
              <s-grid gridTemplateColumns="@container (inline-size > 490px) 1fr 1fr 1fr, 1fr" gap="small">
                {ruleField(i, 'min', 'Minimum')}
                {ruleField(i, 'max', 'Maximum')}
                {ruleField(i, 'increment', 'Sold in multiples of')}
              </s-grid>
            </s-query-container>
            {errors[`rule-${i}`] && <s-paragraph tone="critical">{errors[`rule-${i}`]}</s-paragraph>}
            <s-stack direction="inline" justifyContent="end">
              <s-button variant="primary" onClick={() => setOpen(null)}>
                Done
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </div>
    );
  };

  // Popover + ActionList → MenuButton, as in the pricing editor.
  const addControl = (
    <MenuButton icon="plus" items={SCOPES.map((x) => ({ content: x.label, disabled: x.scopeType === 'all' && hasAll, onAction: () => add(x.scopeType) }))}>
      Add rule
    </MenuButton>
  );

  return (
    <s-section>
      <s-stack gap="small">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-heading>Rules</s-heading>
          {rules.length > 0 && <s-badge>{String(rules.length)}</s-badge>}
        </s-stack>
        <s-paragraph color="subdued" fontSize="small">
          Set quantities for all products, or by collection, product, tag, vendor or product type. When several rules match one product, the higher rule wins — drag the handle to reorder.
        </s-paragraph>
        <div>
          <div
            ref={scrollRef}
            style={scrollable ? { maxHeight: 334, overflowY: 'auto', overflowX: 'hidden', margin: '0 -4px', padding: '2px 4px' } : undefined}
          >
            {rules.map((r, i) => (open === i ? editorRow(r, i) : collapsedRow(r, i)))}
          </div>
          <s-box paddingBlockStart="small-200">{addControl}</s-box>
        </div>
        <s-paragraph color="subdued" fontSize="small">
          Counted per variant, like Shopify’s quantity rules. Use multiples for case packs, e.g. 12. The minimum and maximum must be multiples of it. Leave a field empty to keep what wider limits set; 0 is no minimum and 1 no pack size.
        </s-paragraph>
      </s-stack>
    </s-section>
  );
}
