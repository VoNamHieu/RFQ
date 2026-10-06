import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, BlockStack, InlineGrid, InlineStack, TextField, Text, Box, Button, Select, ChoiceList, Badge, Icon, Checkbox, Tooltip, Banner } from '@shopify/polaris';
import { SearchIcon, ImageIcon, ChevronDownIcon, ChevronRightIcon, InfoIcon, MaximizeIcon, XIcon } from '@shopify/polaris-icons';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { productVariants, applyAdjustment, locationCatalog } from '../pricing.js';
import { VariantPicker } from './VariantPicker.jsx';

// Timezone options mirror the B2B god file's Active dates card.
const TIMEZONES = [
  '(GMT+07:00) Indochina Time - Bangkok',
  '(GMT+00:00) UTC',
  '(GMT-05:00) Eastern Time - New York',
  '(GMT+10:00) AEST - Sydney',
];

// Cards used by the pricing editor: status/dates, product scope, quantity discount
// basis, and per-variant price overrides. Split out of PricingEditor for readability.
// Active dates: timezone + start date/time, with an optional end date (god-file parity).
export function ActiveDatesCard({ builder, patch }) {
  // Seed policies carry an endDate without an explicit flag — treat that as "has end".
  const hasEnd = builder.hasEndDate ?? !!builder.endDate;
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Active dates</Text>
        <Select
          label="Timezone"
          options={TIMEZONES.map((tz) => ({ label: tz, value: tz }))}
          value={builder.timezone || TIMEZONES[0]}
          onChange={(v) => patch({ timezone: v })}
        />
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
          <TextField label="Start date" type="date" value={builder.startDate || ''} onChange={(v) => patch({ startDate: v })} autoComplete="off" />
          <TextField label="Start time" value={builder.startTime || '12:00 AM'} onChange={(v) => patch({ startTime: v })} autoComplete="off" />
        </InlineGrid>
        <Checkbox
          label="Set end date"
          checked={hasEnd}
          onChange={(v) => patch(v ? { hasEndDate: true } : { hasEndDate: false, endDate: '', endTime: '' })}
        />
        {hasEnd && (
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
            <TextField label="End date" type="date" value={builder.endDate || ''} onChange={(v) => patch({ endDate: v })} autoComplete="off" />
            <TextField label="End time" value={builder.endTime || '12:00 AM'} onChange={(v) => patch({ endTime: v })} autoComplete="off" />
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
        <InlineStack gap="100" blockAlign="center" wrap={false}>
          <Text as="h3" variant="headingSm">Discount basis</Text>
          <Tooltip
            preferredPosition="above"
            width="wide"
            content={
              <BlockStack gap="150">
                <Text as="span" variant="bodySm">Choose the price your volume discount applies to.</Text>
                <BlockStack gap="025">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Shopify price</Text>
                  <Text as="span" variant="bodySm" tone="subdued">The product's original store price.</Text>
                </BlockStack>
                <BlockStack gap="025">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Base price</Text>
                  <Text as="span" variant="bodySm" tone="subdued">The price set by the base pricing of the buyer's company or location. Falls back to the Shopify price if none is set.</Text>
                </BlockStack>
              </BlockStack>
            }
          >
            <span style={{ display: 'inline-flex', cursor: 'help' }}><Icon source={InfoIcon} tone="subdued" /></span>
          </Tooltip>
        </InlineStack>
        <Select
          label="Take the volume discount off"
          options={[
            { label: 'The Shopify price', value: 'shopify' },
            { label: 'The base price', value: 'base' },
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
  { label: 'Decrease by %', value: 'decrease_pct' },
  { label: 'Decrease by amount', value: 'decrease_amt' },
  { label: 'Increase by %', value: 'increase_pct' },
  { label: 'Increase by amount', value: 'increase_amt' },
];
// Map an override's {rule, valueType} to/from the Select option value, so a decrease
// or increase can be either a percentage or a fixed amount.
const overrideOptValue = (o) => (!o || !o.rule || o.rule === 'set' ? 'set' : `${o.rule}_${o.valueType === 'percentage' ? 'pct' : 'amt'}`);
const overrideOptPatch = (val) => {
  if (val === 'set') return { rule: 'set', valueType: 'amount' };
  const [rule, unit] = val.split('_');
  return { rule, valueType: unit === 'pct' ? 'percentage' : 'amount' };
};
const isPctOverride = (o) => o?.rule !== 'set' && o?.valueType === 'percentage';
const ROW_GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 148px 92px 92px', gap: 12, alignItems: 'center' };
// Expanded: two more columns after Product — Original price and Price source.
const WIDE_GRID = { ...ROW_GRID, gridTemplateColumns: 'auto minmax(200px, 1fr) 112px 112px 148px 92px 104px' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
const CARET = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: '0 0 auto', width: 20 };

// `locations`: [{ company, location }] the pricing reaches — expanded, the overrides
// can be viewed at one of them (see the View picker below).
export function ProductOverridesCard({ builder, patch, products, locations = [] }) {
  const overrides = builder.variantAdjustments || {};
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  // Full-screen mode: `snapshot` is the overrides when it opened (Close puts them back).
  const [full, setFull] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [viewKey, setViewKey] = useState('all');

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
  // The price an override starts from: the catalog's price at the location being
  // viewed when its price list sets one, else the Shopify price.
  const originOf = (vid, view) => {
    const catalogPrice = view?.prices?.[vid];
    if (catalogPrice != null) return { price: catalogPrice, source: 'Catalog' };
    return { price: variantIndex[vid]?.variant?.list ?? variantIndex[vid]?.product?.list ?? 0, source: 'Shopify' };
  };
  // Original price + Price source cells (expanded view); a product outside the
  // viewed location's catalog has neither there.
  const originCells = (price, source, inCatalog) =>
    inCatalog ? (
      <>
        <Text as="span" variant="bodyMd" alignment="end">{price}</Text>
        <span><Badge tone={source === 'Catalog' ? 'info' : undefined}>{source}</Badge></span>
      </>
    ) : (
      <>
        <Text as="span" variant="bodyMd" alignment="end" tone="subdued">—</Text>
        <Text as="span" variant="bodyMd" tone="subdued">—</Text>
      </>
    );
  // The Options select + Amount input + resolved "Buyer pays" price for one variant
  // (wide: Original price and Price source first).
  const rowCell = (vid, inCatalog = true, view = null, wide = false) => {
    const o = overrides[vid];
    const origin = originOf(vid, view);
    const final = applyAdjustment(o.rule || 'set', o.valueType || 'amount', o.value, origin.price);
    return (
      <>
        {wide && originCells(money(origin.price), origin.source, inCatalog)}
        <Select label="Options" labelHidden options={OVERRIDE_RULES} value={overrideOptValue(o)} onChange={(v) => setField(vid, overrideOptPatch(v))} />
        <TextField label="Amount" labelHidden type="number" min={0} {...(isPctOverride(o) ? { suffix: '%', max: 100 } : { prefix: '$' })} value={String(o.value ?? '')} onChange={(v) => setField(vid, { value: Number(v) || 0 })} autoComplete="off" />
        {inCatalog
          ? <Text as="span" variant="bodyMd" alignment="end" fontWeight="medium">{money(final)}</Text>
          : <Text as="span" variant="bodyMd" alignment="end" tone="subdued">—</Text>}
      </>
    );
  };

  const searchButton = (
    // Looks like a search field but is a button — clicking opens the picker
    // modal (Shopify resource-picker pattern) rather than typing inline.
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
  );
  const table = (view, wide = false) => {
    const notIn = (product) => !!view && !view.skus.includes(product.sku);
    const grid = wide ? WIDE_GRID : ROW_GRID;
    return (
      <>
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
                <div style={grid}>
                  <Checkbox label="" labelHidden checked={false} onChange={toggleAll} />
                  <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Product</Text>
                  {wide && <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium" alignment="end">Original price</Text>}
                  {wide && <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Price source</Text>}
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
                    <div style={grid}>
                      <Checkbox label="" labelHidden checked={selected.has(v.id)} onChange={() => toggleRow(v.id)} />
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <span style={{ width: 20, flex: '0 0 auto' }} />
                        <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                        <div style={{ minWidth: 0 }}>
                          <Text as="span" variant="bodyMd" truncate>{g.product.title}</Text>
                          <Text as="p" tone="subdued" variant="bodySm" truncate>{v.title || v.id}</Text>
                          {notIn(g.product) ? <Badge tone="attention">Not in catalog</Badge> : null}
                        </div>
                      </InlineStack>
                      {rowCell(v.id, !notIn(g.product), view, wide)}
                    </div>
                  </Box>
                );
              }
              // Multiple priced variants → collapsible product row + variant sub-rows.
              // The product row's Options/Amount bulk-set every variant; when the
              // variants differ it shows "Mixed" (edit inline to see per-variant).
              const optVals = g.variants.map((v) => overrideOptValue(overrides[v.id]));
              const vals = g.variants.map((v) => overrides[v.id].value);
              const sameRule = optVals.every((r) => r === optVals[0]);
              const sameVal = vals.every((x) => x === vals[0]);
              const groupPct = sameRule && isPctOverride(overrides[g.variants[0].id]);
              const groupOpts = sameRule ? OVERRIDE_RULES : [{ label: 'Mixed', value: 'mixed', disabled: true }, ...OVERRIDE_RULES];
              // Buyer-pays for the whole product: each variant's actual final price,
              // shown as a low–high range (a single value when they coincide) — even
              // when the variants' overrides differ, so it always reads as a price.
              const finals = g.variants.map((v) => {
                const o = overrides[v.id];
                return applyAdjustment(o.rule || 'set', o.valueType || 'amount', o.value, originOf(v.id, view).price);
              });
              const payLo = Math.min(...finals);
              const payHi = Math.max(...finals);
              const bulkPays = payLo === payHi ? money(payLo) : `${money(payLo)}–${money(payHi)}`;
              // The product row's Original price (a range when variants differ) and source.
              const origins = g.variants.map((v) => originOf(v.id, view));
              const oLo = Math.min(...origins.map((x) => x.price));
              const oHi = Math.max(...origins.map((x) => x.price));
              const oSources = [...new Set(origins.map((x) => x.source))];
              return (
                <Box key={g.product.sku} borderBlockStartWidth={topBorder} borderColor="border">
                  <Box paddingBlock="200" paddingInline="300">
                    <div style={grid}>
                      <Checkbox label="" labelHidden checked={pAll ? true : pSome ? 'indeterminate' : false} onChange={() => toggleGroup(vids)} />
                      <button type="button" onClick={() => toggleExpand(g.product.sku)} style={{ all: 'unset', cursor: 'pointer', display: 'block', minWidth: 0 }}>
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <span style={CARET}><Icon source={isExp ? ChevronDownIcon : ChevronRightIcon} tone="subdued" /></span>
                          <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                          <div style={{ minWidth: 0 }}>
                            <Text as="span" variant="bodyMd" truncate>{g.product.title}</Text>
                            <Text as="p" tone="subdued" variant="bodySm">{`${g.variants.length} variants`}</Text>
                            {notIn(g.product) ? <Badge tone="attention">Not in catalog</Badge> : null}
                          </div>
                        </InlineStack>
                      </button>
                      {wide && originCells(oLo === oHi ? money(oLo) : `${money(oLo)}–${money(oHi)}`, oSources.length === 1 ? oSources[0] : 'Mixed', !notIn(g.product))}
                      <Select label="Options" labelHidden options={groupOpts} value={sameRule ? optVals[0] : 'mixed'} onChange={(v) => { if (v !== 'mixed') setGroupField(vids, overrideOptPatch(v)); }} />
                      <TextField label="Amount" labelHidden type="number" min={0} {...(groupPct ? { suffix: '%', max: 100 } : { prefix: '$' })} value={sameVal ? String(vals[0] ?? '') : ''} placeholder={sameVal ? undefined : 'Mixed'} onChange={(v) => setGroupField(vids, { value: Number(v) || 0 })} autoComplete="off" />
                      {notIn(g.product)
                        ? <Text as="span" variant="bodyMd" alignment="end" tone="subdued">—</Text>
                        : <Text as="span" variant="bodyMd" alignment="end" fontWeight="medium">{bulkPays}</Text>}
                    </div>
                  </Box>
                  {isExp && g.variants.map((v) => (
                    <Box key={v.id} paddingBlock="200" paddingInline="300" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                      <div style={grid}>
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
                        {rowCell(v.id, !notIn(g.product), view, wide)}
                      </div>
                    </Box>
                  ))}
                </Box>
              );
            })}
            </div>
          </Box>
        )}
      </>
    );
  };

  // Expanded: the same editor full screen (Shopify's maximize pattern), plus a View
  // picker to check the overrides at one location — a product outside its catalog
  // doesn't get its override there. Done keeps the edits; Close puts them back.
  const openFull = () => { setSnapshot(overrides); setViewKey('all'); setFull(true); };
  const closeFull = (keep) => {
    if (!keep) patch({ variantAdjustments: snapshot || {} });
    setFull(false);
  };
  // Escape closes the expanded view only (not the pricing editor underneath).
  useEffect(() => {
    if (!full || pickerOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      closeFull(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  const keyOf = (t) => `${t.company.id}::${t.location.id}`;
  const target = locations.find((t) => keyOf(t) === viewKey) || null;
  const view = target ? { ...target, ...locationCatalog(target.location, products) } : null;
  const severalCompanies = new Set(locations.map((t) => t.company.id)).size > 1;
  const outside = view ? groups.filter((g) => !view.skus.includes(g.product.sku)).length : 0;
  const countBadge = allIds.length > 0 ? <Badge>{`${allIds.length} variant${allIds.length === 1 ? '' : 's'}`}</Badge> : null;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          {/* align="start": nested stacks inherit the header's space-between otherwise */}
          <InlineStack align="start" gap="200" blockAlign="center">
            <Text as="h3" variant="headingSm">Product price overrides</Text>
            {countBadge}
          </InlineStack>
          <Tooltip content="Expand">
            <Button icon={MaximizeIcon} variant="tertiary" accessibilityLabel="Expand product price overrides" onClick={openFull} />
          </Tooltip>
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">Give specific product variants their own price. Overrides win over rules and the default.</Text>
        {searchButton}
        {table(null)}
      </BlockStack>

      {/* Portalled to <body>: inside the editor page it would sit under the admin
          frame's top bar, nav and the editor's aside. Polaris modals (the product
          picker) still open on top of it. */}
      {full && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product price overrides"
          style={{ position: 'fixed', inset: 0, zIndex: 517, display: 'flex', flexDirection: 'column', background: 'var(--p-color-bg-surface, #fff)' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              background: 'var(--p-color-bg-surface-secondary, #f7f7f7)',
              borderBottom: '1px solid var(--p-color-border, #e3e3e3)',
              flex: '0 0 auto',
            }}
          >
            <InlineStack align="start" gap="200" blockAlign="center">
              <Text as="h2" variant="headingMd">Product price overrides</Text>
              {countBadge}
            </InlineStack>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button onClick={() => closeFull(false)}>Close</Button>
              <Button variant="primary" onClick={() => closeFull(true)}>Done</Button>
              <Button variant="tertiary" icon={XIcon} accessibilityLabel="Close" onClick={() => closeFull(false)} />
            </div>
          </div>
          <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: 16 }}>
            <BlockStack gap="300">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>{searchButton}</div>
                {locations.length > 0 && (
                  <div style={{ width: 320, flex: '0 0 auto' }}>
                    <Select
                      label="View"
                      labelInline
                      options={[
                        { label: 'All locations', value: 'all' },
                        ...locations.map((t) => ({ label: severalCompanies ? `${t.location.name} · ${t.company.name}` : t.location.name, value: keyOf(t) })),
                      ]}
                      value={target ? viewKey : 'all'}
                      onChange={setViewKey}
                    />
                  </div>
                )}
              </div>
              {view && (
                <Banner tone="info">
                  <Text as="p">
                    {`${view.location.name}${severalCompanies ? ` (${view.company.name})` : ''} uses the ${view.name} catalog. `}
                    {outside
                      ? `${outside} of the products with an override ${outside === 1 ? 'isn’t' : 'aren’t'} in it, so ${outside === 1 ? 'it doesn’t' : 'they don’t'} get the override price there.`
                      : 'Every product with an override is in it.'}
                  </Text>
                </Banner>
              )}
              {groups.length ? (
                table(view, true)
              ) : (
                <Box background="bg-surface-secondary" borderRadius="200" paddingBlock="3200">
                  <BlockStack gap="100" inlineAlign="center">
                    <Text as="p" variant="headingSm">No products to display</Text>
                    <Text as="p" tone="subdued">Add products to set an override price</Text>
                  </BlockStack>
                </Box>
              )}
            </BlockStack>
          </div>
        </div>,
        document.body,
      )}

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
