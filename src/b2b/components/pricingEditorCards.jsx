import React, { useState, useMemo } from 'react';
import { Card, BlockStack, InlineGrid, InlineStack, TextField, Text, Box, Button, Select, ChoiceList, RadioButton, Badge, Icon, Checkbox } from '@shopify/polaris';
import { SearchIcon, ImageIcon, ChevronDownIcon, ChevronRightIcon } from '@shopify/polaris-icons';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { productVariants, applyAdjustment } from '../pricing.js';
import { VariantPicker } from './VariantPicker.jsx';

// Cards used by the pricing editor: status/dates, product scope, quantity discount
// basis, and per-variant price overrides. Split out of PricingEditor for readability.
export function ActiveDatesCard({ builder, patch }) {
  const dated = builder.validityType === 'dated';
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Active dates</Text>
        <BlockStack gap="150">
          <RadioButton label="Always on" checked={!dated} id="valid-evergreen" name="validity" onChange={() => patch({ validityType: 'evergreen' })} />
          <RadioButton label="Set a start / end date" checked={dated} id="valid-dated" name="validity" onChange={() => patch({ validityType: 'dated' })} />
        </BlockStack>
        {dated && (
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
            <TextField label="Start date" type="date" value={builder.startDate || ''} onChange={(v) => patch({ startDate: v })} autoComplete="off" />
            <TextField label="End date" type="date" value={builder.endDate || ''} onChange={(v) => patch({ endDate: v })} autoComplete="off" />
          </InlineGrid>
        )}
      </BlockStack>
    </Card>
  );
}

// Which products this pricing covers (all / a collection / specific products).
export function ProductScopeCard({ builder, patch, products }) {
  const st = builder.scopeType || 'all';
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Products</Text>
        <Select
          label="Applies to"
          options={[
            { label: 'All products', value: 'all' },
            { label: 'A collection', value: 'collection' },
            { label: 'Specific products', value: 'products' },
          ]}
          value={st}
          onChange={(v) => patch({ scopeType: v })}
        />
        {st === 'collection' && (
          <Select
            label="Collection"
            options={Object.keys(COLLECTIONS).map((c) => ({ label: c, value: c }))}
            value={builder.collection && COLLECTIONS[builder.collection] ? builder.collection : Object.keys(COLLECTIONS)[0]}
            onChange={(v) => patch({ collection: v })}
          />
        )}
        {st === 'products' && (
          <ChoiceList
            allowMultiple
            title="Products"
            titleHidden
            choices={products.map((p) => ({ label: `${p.title} · ${money(p.list)}`, value: p.sku }))}
            selected={builder.selectedProducts || []}
            onChange={(v) => patch({ selectedProducts: v })}
          />
        )}
      </BlockStack>
    </Card>
  );
}

// Quantity discount basis: off the raw Shopify price, or off the base price.
export function VolumeBasisCard({ builder, patch }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Discount basis</Text>
        <Select
          label="Take the volume discount off"
          options={[
            { label: 'The Shopify price', value: 'shopify' },
            { label: 'The company base price', value: 'base' },
          ]}
          value={builder.volumeBasis || 'shopify'}
          onChange={(v) => patch({ volumeBasis: v })}
        />
      </BlockStack>
    </Card>
  );
}

// Per-VARIANT price overrides, shown as a compact Shopify "price list" table
// grouped by product: each product is one row — [checkbox] · Product (thumbnail +
// name) · Options · Amount — and a product with 2+ priced variants is COLLAPSIBLE
// (click to expand its variant sub-rows). Overrides are keyed by variant id (the
// default variant id equals the product sku, so per-SKU pricing is unchanged).
const OVERRIDE_RULES = [
  { label: 'Set price', value: 'set' },
  { label: 'Price decrease', value: 'decrease' },
  { label: 'Price increase', value: 'increase' },
];
const ROW_GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 148px 92px 92px', gap: 12, alignItems: 'center' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
const CARET = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: '0 0 auto', width: 20 };

export function ProductOverridesCard({ builder, patch, products }) {
  const overrides = builder.variantAdjustments || {};
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());

  // variantId → { product, variant }, for prefilling prices from the picker.
  const variantIndex = useMemo(() => {
    const m = {};
    products.forEach((p) => productVariants(p).forEach((v) => { m[v.id] = { product: p, variant: v }; }));
    return m;
  }, [products]);

  // Priced variants grouped under their product, in catalog order.
  const groups = [];
  products.forEach((p) => {
    const vs = productVariants(p).filter((v) => overrides[v.id]);
    if (vs.length) groups.push({ product: p, variants: vs });
  });
  const allIds = groups.flatMap((g) => g.variants.map((v) => v.id));
  const selCount = allIds.filter((id) => selected.has(id)).length;
  const allSel = allIds.length > 0 && selCount === allIds.length;

  const setField = (vid, patchObj) =>
    patch({ variantAdjustments: { ...overrides, [vid]: { rule: 'set', valueType: 'amount', value: 0, ...(overrides[vid] || {}), ...patchObj } } });
  // Product-level bulk edit: apply the same rule/amount to every variant at once.
  const setGroupField = (vids, patchObj) => {
    const next = { ...overrides };
    vids.forEach((vid) => { next[vid] = { rule: 'set', valueType: 'amount', value: 0, ...(next[vid] || {}), ...patchObj }; });
    patch({ variantAdjustments: next });
  };
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(allIds));
  const toggleRow = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleGroup = (vids) =>
    setSelected((s) => {
      const n = new Set(s);
      const all = vids.every((id) => n.has(id));
      vids.forEach((id) => (all ? n.delete(id) : n.add(id)));
      return n;
    });
  const toggleExpand = (sku) =>
    setExpanded((e) => {
      const n = new Set(e);
      if (n.has(sku)) n.delete(sku);
      else n.add(sku);
      return n;
    });
  const removeSelected = () => {
    const next = { ...overrides };
    allIds.forEach((id) => { if (selected.has(id)) delete next[id]; });
    patch({ variantAdjustments: next });
    setSelected(new Set());
  };
  // Commit a picker selection: keep existing prices for variants that stay, add
  // newly-picked ones at their list price, drop those unchecked.
  const commit = (picked) => {
    const next = {};
    picked.forEach((vid) => {
      next[vid] = overrides[vid] || { rule: 'set', valueType: 'amount', value: variantIndex[vid]?.variant?.list ?? variantIndex[vid]?.product?.list ?? 0 };
    });
    patch({ variantAdjustments: next });
    setPickerOpen(false);
  };
  // The Options select + Amount input + resolved "Buyer pays" price for one variant.
  const rowCell = (vid) => {
    const o = overrides[vid];
    const listPrice = variantIndex[vid]?.variant?.list ?? variantIndex[vid]?.product?.list ?? 0;
    const final = applyAdjustment(o.rule || 'set', o.valueType || 'amount', o.value, listPrice);
    return (
      <>
        <Select label="Options" labelHidden options={OVERRIDE_RULES} value={o.rule || 'set'} onChange={(v) => setField(vid, { rule: v })} />
        <TextField label="Amount" labelHidden type="number" prefix="$" min={0} value={String(o.value ?? '')} onChange={(v) => setField(vid, { value: Number(v) || 0 })} autoComplete="off" />
        <Text as="span" variant="bodyMd" alignment="end" fontWeight="medium">{money(final)}</Text>
      </>
    );
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingSm">Product price overrides</Text>
          {allIds.length > 0 ? <Badge>{`${allIds.length} variant${allIds.length === 1 ? '' : 's'}`}</Badge> : null}
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">Give specific product variants their own price. Overrides win over rules and the default.</Text>

        {/* Looks like a search field but is a button — clicking opens the picker
            modal (Shopify resource-picker pattern) rather than typing inline. */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label="Add products"
          style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <Box borderColor="border" borderWidth="025" borderRadius="200" background="bg-surface" paddingBlock="150" paddingInline="300">
            <InlineStack gap="150" blockAlign="center" wrap={false}>
              <span style={{ display: 'flex', flex: '0 0 auto' }}>
                <Icon source={SearchIcon} tone="subdued" />
              </span>
              <Text as="span" tone="subdued">Add products</Text>
            </InlineStack>
          </Box>
        </button>

        {groups.length > 0 && (
          <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden">
            <div style={{ overflowX: 'auto' }}>
            {selCount > 0 ? (
              <Box background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border" paddingBlock="200" paddingInline="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Checkbox label="" labelHidden checked={allSel ? true : 'indeterminate'} onChange={toggleAll} />
                    <Text as="span" variant="bodySm" fontWeight="medium">{`${selCount} selected`}</Text>
                  </InlineStack>
                  <Button variant="tertiary" tone="critical" onClick={removeSelected}>Remove</Button>
                </InlineStack>
              </Box>
            ) : (
              <Box background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border" paddingBlock="150" paddingInline="300">
                <div style={ROW_GRID}>
                  <Checkbox label="" labelHidden checked={false} onChange={toggleAll} />
                  <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Product</Text>
                  <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Options</Text>
                  <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Amount</Text>
                  <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium" alignment="end">Buyer pays</Text>
                </div>
              </Box>
            )}
            {groups.map((g, gi) => {
              const vids = g.variants.map((v) => v.id);
              const collapsible = g.variants.length > 1;
              const isExp = expanded.has(g.product.sku);
              const pAll = vids.every((id) => selected.has(id));
              const pSome = vids.some((id) => selected.has(id));
              const topBorder = gi === 0 ? '0' : '025';
              // Single priced variant → one inline row (no expand needed).
              if (!collapsible) {
                const v = g.variants[0];
                return (
                  <Box key={g.product.sku} paddingBlock="200" paddingInline="300" borderBlockStartWidth={topBorder} borderColor="border">
                    <div style={ROW_GRID}>
                      <Checkbox label="" labelHidden checked={selected.has(v.id)} onChange={() => toggleRow(v.id)} />
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <span style={{ width: 20, flex: '0 0 auto' }} />
                        <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                        <div style={{ minWidth: 0 }}>
                          <Text as="span" variant="bodyMd" truncate>{g.product.title}</Text>
                          <Text as="p" tone="subdued" variant="bodySm" truncate>{v.title || v.id}</Text>
                        </div>
                      </InlineStack>
                      {rowCell(v.id)}
                    </div>
                  </Box>
                );
              }
              // Multiple priced variants → collapsible product row + variant sub-rows.
              // The product row's Options/Amount bulk-set every variant; when the
              // variants differ it shows "Mixed" (edit inline to see per-variant).
              const rules = g.variants.map((v) => overrides[v.id].rule || 'set');
              const vals = g.variants.map((v) => overrides[v.id].value);
              const sameRule = rules.every((r) => r === rules[0]);
              const sameVal = vals.every((x) => x === vals[0]);
              const groupOpts = sameRule ? OVERRIDE_RULES : [{ label: 'Mixed', value: 'mixed', disabled: true }, ...OVERRIDE_RULES];
              // Buyer-pays for the whole product: each variant's actual final price,
              // shown as a low–high range (a single value when they coincide) — even
              // when the variants' overrides differ, so it always reads as a price.
              const finals = g.variants.map((v) => {
                const o = overrides[v.id];
                return applyAdjustment(o.rule || 'set', o.valueType || 'amount', o.value, v.list ?? g.product.list);
              });
              const payLo = Math.min(...finals);
              const payHi = Math.max(...finals);
              const bulkPays = payLo === payHi ? money(payLo) : `${money(payLo)}–${money(payHi)}`;
              return (
                <Box key={g.product.sku} borderBlockStartWidth={topBorder} borderColor="border">
                  <Box paddingBlock="200" paddingInline="300">
                    <div style={ROW_GRID}>
                      <Checkbox label="" labelHidden checked={pAll ? true : pSome ? 'indeterminate' : false} onChange={() => toggleGroup(vids)} />
                      <button type="button" onClick={() => toggleExpand(g.product.sku)} style={{ all: 'unset', cursor: 'pointer', display: 'block', minWidth: 0 }}>
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <span style={CARET}><Icon source={isExp ? ChevronDownIcon : ChevronRightIcon} tone="subdued" /></span>
                          <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                          <div style={{ minWidth: 0 }}>
                            <Text as="span" variant="bodyMd" truncate>{g.product.title}</Text>
                            <Text as="p" tone="subdued" variant="bodySm">{`${g.variants.length} variants`}</Text>
                          </div>
                        </InlineStack>
                      </button>
                      <Select label="Options" labelHidden options={groupOpts} value={sameRule ? rules[0] || 'set' : 'mixed'} onChange={(v) => { if (v !== 'mixed') setGroupField(vids, { rule: v }); }} />
                      <TextField label="Amount" labelHidden type="number" prefix="$" min={0} value={sameVal ? String(vals[0] ?? '') : ''} placeholder={sameVal ? undefined : 'Mixed'} onChange={(v) => setGroupField(vids, { value: Number(v) || 0 })} autoComplete="off" />
                      <Text as="span" variant="bodyMd" alignment="end" fontWeight="medium">{bulkPays}</Text>
                    </div>
                  </Box>
                  {isExp && g.variants.map((v) => (
                    <Box key={v.id} paddingBlock="200" paddingInline="300" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                      <div style={ROW_GRID}>
                        {/* Variant checkbox indented one level (under the thumbnail);
                            name aligned under the product title with its SKU on a
                            second line — Shopify variant-row pattern. */}
                        <span style={{ paddingInlineStart: 40, display: 'flex', alignItems: 'center' }}>
                          <Checkbox label="" labelHidden checked={selected.has(v.id)} onChange={() => toggleRow(v.id)} />
                        </span>
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <span style={{ width: 20, flex: '0 0 auto' }} />
                          <div style={{ minWidth: 0 }}>
                            <Text as="span" variant="bodyMd" truncate>{v.title || v.id}</Text>
                            {v.id && v.id !== v.title ? <Text as="p" tone="subdued" variant="bodySm" truncate>{v.id}</Text> : null}
                          </div>
                        </InlineStack>
                        {rowCell(v.id)}
                      </div>
                    </Box>
                  ))}
                </Box>
              );
            })}
            </div>
          </Box>
        )}
      </BlockStack>

      {pickerOpen && (
        <VariantPicker
          products={products}
          initialSelected={Object.keys(overrides)}
          onCancel={() => setPickerOpen(false)}
          onAdd={commit}
        />
      )}
    </Card>
  );
}
