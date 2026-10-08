import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWcId } from '../../shared/wc.jsx';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { productVariants, applyAdjustment, locationCatalog, scopeCollections } from '../pricing.js';
import { VariantPicker } from './VariantPicker.jsx';

// Timezone options mirror the B2B god file's Active dates card.
const TIMEZONES = [
  '(GMT+07:00) Indochina Time - Bangkok',
  '(GMT+00:00) UTC',
  '(GMT-05:00) Eastern Time - New York',
  '(GMT+10:00) AEST - Sydney',
];

// Two fields side by side once the card is wide enough (Polaris React
// InlineGrid columns={{ xs: 1, sm: 2 }}).
const TWO_UP = '@container (inline-size > 400px) 1fr 1fr, 1fr';

// Cards used by the pricing editor: status/dates, product scope, quantity discount
// basis, and per-variant price overrides. Split out of PricingEditor for readability.
// Active dates: timezone + start date/time, with an optional end date (god-file parity).
export function ActiveDatesCard({ builder, patch }) {
  // Seed policies carry an endDate without an explicit flag — treat that as "has end".
  const hasEnd = builder.hasEndDate ?? !!builder.endDate;
  return (
    <s-section heading="Active dates">
      <s-stack gap="small">
        <s-select label="Timezone" value={builder.timezone || TIMEZONES[0]} onChange={(e) => patch({ timezone: e.currentTarget.value })}>
          {TIMEZONES.map((tz) => (
            <s-option key={tz} value={tz}>
              {tz}
            </s-option>
          ))}
        </s-select>
        <s-query-container>
          <s-grid gridTemplateColumns={TWO_UP} gap="small">
            {/* Date fields commit on change (typing emits partial dates on input). */}
            <s-date-field label="Start date" value={builder.startDate || ''} onChange={(e) => patch({ startDate: e.currentTarget.value })} />
            <s-text-field
              label="Start time"
              value={builder.startTime || '12:00 AM'}
              onInput={(e) => patch({ startTime: e.currentTarget.value })}
              autocomplete="off"
            />
          </s-grid>
        </s-query-container>
        <s-checkbox
          label="Set end date"
          checked={hasEnd}
          onChange={(e) => {
            const v = e.currentTarget.checked;
            patch(v ? { hasEndDate: true } : { hasEndDate: false, endDate: '', endTime: '' });
          }}
        />
        {hasEnd && (
          <s-query-container>
            <s-grid gridTemplateColumns={TWO_UP} gap="small">
              <s-date-field label="End date" value={builder.endDate || ''} onChange={(e) => patch({ endDate: e.currentTarget.value })} />
              <s-text-field
                label="End time"
                value={builder.endTime || '12:00 AM'}
                onInput={(e) => patch({ endTime: e.currentTarget.value })}
                autocomplete="off"
              />
            </s-grid>
          </s-query-container>
        )}
      </s-stack>
    </s-section>
  );
}

// Which products this pricing covers (all / a collection / specific products).
const SCOPE_CHOICES = [
  ['all', 'All products'],
  ['products', 'Specific products'],
  ['collection', 'Specific collections'],
  ['tags', 'Product tags'],
];
// Quantity pricing's Products (production's ProductsCard): all products, specific
// products (Search products opens Select products), specific collections or product
// tags. The picker works on variants; picking any variant picks its product.
export function QuantityProductsCard({ builder, patch, products }) {
  const name = useWcId('qty-products');
  const [pickerOpen, setPickerOpen] = useState(false);
  const st = builder.scopeType || 'all';
  const skus = builder.selectedProducts || [];
  const picked = products.filter((p) => skus.includes(p.sku));
  const collections = scopeCollections(builder);
  const tags = [...new Set(products.flatMap((p) => p.tags || []))].sort();
  const pickedTags = builder.selectedTags || [];
  const pickVariants = (vids) => {
    const set = new Set(vids);
    patch({ selectedProducts: products.filter((p) => productVariants(p).some((v) => set.has(v.id))).map((p) => p.sku) });
    setPickerOpen(false);
  };
  // A nested list's change also reaches the scope list; only its own counts.
  const ownChange = (fn) => (e) => {
    if (e.target !== e.currentTarget) return;
    fn([...(e.currentTarget.values || [])]);
  };
  return (
    <s-section heading="Products">
      <s-stack gap="small">
        {/* Each choice's field sits right under it, as in Shopify — so every choice
            is its own list (s-choice's details slot only shows text); `st` keeps
            exactly one of them selected. A list keeps its own checked state, so
            the one that loses the selection is remounted (keyed on it). */}
        <s-stack gap="none">
          {SCOPE_CHOICES.map(([value, label]) => (
            <React.Fragment key={value}>
              <s-choice-list
                key={`${value}-${st === value}`}
                label={label}
                labelAccessibilityVisibility="exclusive"
                name={`${name}-${value}`}
                onChange={ownChange(([v]) => v && patch({ scopeType: v }))}
              >
                <s-choice value={value} selected={st === value}>{label}</s-choice>
              </s-choice-list>
              {st === value && value === 'products' && (
                <s-box paddingInlineStart="large-200">
                  <s-stack gap="small-200">
                    <s-search-field
                      label="Search products"
                      labelAccessibilityVisibility="exclusive"
                      placeholder="Search products"
                      value=""
                      onClick={() => setPickerOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setPickerOpen(true);
                      }}
                    />
                    {picked.length ? (
                      <s-stack direction="inline" gap="small-300">
                        {picked.map((p) => (
                          <s-clickable-chip
                            key={p.sku}
                            removable
                            accessibilityLabel={`Remove ${p.title}`}
                            onRemove={() => patch({ selectedProducts: skus.filter((x) => x !== p.sku) })}
                          >
                            {p.title}
                          </s-clickable-chip>
                        ))}
                      </s-stack>
                    ) : null}
                  </s-stack>
                </s-box>
              )}
              {st === value && value === 'collection' && (
                <s-box paddingInlineStart="large-200">
                  <s-choice-list multiple label="Collections" labelAccessibilityVisibility="exclusive" name={`${name}-collections`} onChange={ownChange((vals) => patch({ selectedCollections: vals }))}>
                    {Object.keys(COLLECTIONS).map((c) => (
                      <s-choice key={c} value={c} selected={collections.includes(c)}>
                        {c}
                      </s-choice>
                    ))}
                  </s-choice-list>
                </s-box>
              )}
              {st === value && value === 'tags' && (
                <s-box paddingInlineStart="large-200">
                  <s-choice-list multiple label="Product tags" labelAccessibilityVisibility="exclusive" name={`${name}-tags`} onChange={ownChange((vals) => patch({ selectedTags: vals }))}>
                    {tags.map((t) => (
                      <s-choice key={t} value={t} selected={pickedTags.includes(t)}>
                        {t}
                      </s-choice>
                    ))}
                  </s-choice-list>
                </s-box>
              )}
            </React.Fragment>
          ))}
        </s-stack>
      </s-stack>
      {pickerOpen && (
        <VariantPicker
          products={products}
          initialSelected={picked.flatMap((p) => productVariants(p).map((v) => v.id))}
          heading="Select products"
          actionLabel={() => 'Select'}
          onCancel={() => setPickerOpen(false)}
          onAdd={(sel) => pickVariants([...sel])}
        />
      )}
    </s-section>
  );
}

export function ProductScopeCard({ builder, patch, products }) {
  const name = useWcId('scope-products');
  const st = builder.scopeType || 'all';
  const selected = builder.selectedProducts || [];
  return (
    <s-section heading="Products">
      <s-stack gap="small">
        <s-select label="Applies to" value={st} onChange={(e) => patch({ scopeType: e.currentTarget.value })}>
          <s-option value="all">All products</s-option>
          <s-option value="collection">A collection</s-option>
          <s-option value="products">Specific products</s-option>
        </s-select>
        {st === 'collection' && (
          <s-select
            label="Collection"
            value={builder.collection && COLLECTIONS[builder.collection] ? builder.collection : Object.keys(COLLECTIONS)[0]}
            onChange={(e) => patch({ collection: e.currentTarget.value })}
          >
            {Object.keys(COLLECTIONS).map((c) => (
              <s-option key={c} value={c}>
                {c}
              </s-option>
            ))}
          </s-select>
        )}
        {st === 'products' && (
          <s-choice-list
            multiple
            label="Products"
            labelAccessibilityVisibility="exclusive"
            name={name}
            onChange={(e) => patch({ selectedProducts: [...(e.currentTarget.values || [])] })}
          >
            {products.map((p) => (
              <s-choice key={p.sku} value={p.sku} selected={selected.includes(p.sku)}>
                {`${p.title} · ${money(p.list)}`}
              </s-choice>
            ))}
          </s-choice-list>
        )}
      </s-stack>
    </s-section>
  );
}

// Quantity discount basis: off the raw Shopify price, or off the base price.
export function VolumeBasisCard({ builder, patch }) {
  const tipId = useWcId('basis-tip');
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-400" alignItems="center">
          <s-heading>Discount basis</s-heading>
          <span style={{ display: 'inline-flex', cursor: 'help' }}>
            <s-icon type="info" color="subdued" interestFor={tipId} />
          </span>
          <s-tooltip id={tipId}>
            <s-paragraph fontSize="small">Choose the price your volume discount applies to.</s-paragraph>
            <s-paragraph fontSize="small" fontWeight="semibold">Shopify price</s-paragraph>
            <s-paragraph fontSize="small" color="subdued">The product's original store price.</s-paragraph>
            <s-paragraph fontSize="small" fontWeight="semibold">Base price</s-paragraph>
            <s-paragraph fontSize="small" color="subdued">
              The price set by the base pricing of the buyer's company or location. Falls back to the Shopify price if none is set.
            </s-paragraph>
          </s-tooltip>
        </s-stack>
        <s-select label="Take the volume discount off" value={builder.volumeBasis || 'shopify'} onChange={(e) => patch({ volumeBasis: e.currentTarget.value })}>
          <s-option value="shopify">The Shopify price</s-option>
          <s-option value="base">The base price</s-option>
        </s-select>
      </s-stack>
    </s-section>
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
// Checkbox · Product · Original price · Options · Amount · Buyer pays.
const ROW_GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 92px 148px 92px 92px', gap: 12, alignItems: 'center' };
// Expanded: Price source too (after Original price), with wider columns.
const WIDE_GRID = { ...ROW_GRID, gridTemplateColumns: 'auto minmax(200px, 1fr) 112px 112px 148px 92px 104px' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
const CARET = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: '0 0 auto', width: 20 };
const END = { textAlign: 'end' };
// Row separators inside the overrides table (top border on every row but the first).
const rowBorder = (first) => (first ? 'none' : 'base none none none');

// The Options select + Amount field for one override (or a product's bulk edit).
function OverrideOptions({ value, options, onChange }) {
  return (
    <s-select label="Options" labelAccessibilityVisibility="exclusive" value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {options.map((o) => (
        <s-option key={o.value} value={o.value} disabled={!!o.disabled}>
          {o.label}
        </s-option>
      ))}
    </s-select>
  );
}
function OverrideAmount({ pct, value, placeholder = '', onChange }) {
  // Keyed by unit so switching % ↔ $ remounts with the right prefix / suffix / max.
  return pct ? (
    <s-number-field
      key="pct"
      label="Amount"
      labelAccessibilityVisibility="exclusive"
      min={0}
      max={100}
      suffix="%"
      value={value}
      placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.value)}
      autocomplete="off"
    />
  ) : (
    <s-number-field
      key="amt"
      label="Amount"
      labelAccessibilityVisibility="exclusive"
      min={0}
      prefix="$"
      value={value}
      placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.value)}
      autocomplete="off"
    />
  );
}

// `locations`: [{ company, location }] the pricing reaches — expanded, the overrides
// can be viewed at one of them (see the View picker below).
export function ProductOverridesCard({ builder, patch, products, locations = [] }) {
  const overrides = builder.variantAdjustments || {};
  const tipId = useWcId('overrides');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  // Full-screen mode: `snapshot` is the overrides when it opened (Close puts them back).
  const [full, setFull] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [viewKey, setViewKey] = useState(null);

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
  // Selection setters are idempotent (checkbox onChange can fire twice): each sets
  // the rows to the checkbox's checked state rather than toggling them.
  const setAll = (on) => setSelected(on ? new Set(allIds) : new Set());
  const setRow = (id, on) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const setGroup = (vids, on) =>
    setSelected((s) => {
      const n = new Set(s);
      vids.forEach((id) => (on ? n.add(id) : n.delete(id)));
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
  // viewed when its price list sets one, else the Shopify price. A product in that
  // location's catalog reads Catalog either way.
  const originOf = (vid, view) => {
    const catalogPrice = view?.prices?.[vid];
    if (catalogPrice != null) return { price: catalogPrice, source: 'Catalog' };
    const inCatalog = !!view?.location?.catalog && view.skus.includes(variantIndex[vid]?.product?.sku);
    return { price: variantIndex[vid]?.variant?.list ?? variantIndex[vid]?.product?.list ?? 0, source: inCatalog ? 'Catalog' : 'Shopify' };
  };
  // Original price cell, plus Price source in the expanded view; a product outside
  // the viewed location's catalog has no price there, and its source says so.
  const originCells = (price, source, inCatalog, withSource) =>
    inCatalog ? (
      <>
        <div style={END}><s-text>{price}</s-text></div>
        {withSource && <div><s-badge tone={source === 'Catalog' ? 'info' : undefined}>{source}</s-badge></div>}
      </>
    ) : (
      <>
        <div style={END}><s-text color="subdued">—</s-text></div>
        {withSource && <div><s-badge tone="caution">Not in catalog</s-badge></div>}
      </>
    );
  // Original price, then the Options select + Amount input + resolved "Buyer pays"
  // price for one variant (wide: Price source after Original price).
  const rowCell = (vid, inCatalog = true, view = null, wide = false) => {
    const o = overrides[vid];
    const origin = originOf(vid, view);
    const final = applyAdjustment(o.rule || 'set', o.valueType || 'amount', o.value, origin.price);
    return (
      <>
        {originCells(money(origin.price), origin.source, inCatalog, wide)}
        <OverrideOptions value={overrideOptValue(o)} options={OVERRIDE_RULES} onChange={(v) => setField(vid, overrideOptPatch(v))} />
        <OverrideAmount pct={isPctOverride(o)} value={String(o.value ?? '')} onChange={(v) => setField(vid, { value: Number(v) || 0 })} />
        <div style={END}>
          {inCatalog ? <s-text fontWeight="medium">{money(final)}</s-text> : <s-text color="subdued">—</s-text>}
        </div>
      </>
    );
  };

  const searchButton = (
    // Looks like a search field but is a button — clicking opens the picker
    // modal (Shopify resource-picker pattern) rather than typing inline.
    <s-clickable
      onClick={() => setPickerOpen(true)}
      accessibilityLabel="Add products"
      border="base"
      borderRadius="base"
      background="base"
      paddingBlock="small-300"
      paddingInline="small"
    >
      <s-stack direction="inline" gap="small-300" alignItems="center">
        <s-icon type="search" color="subdued" />
        <s-text color="subdued">Add products</s-text>
      </s-stack>
    </s-clickable>
  );
  const table = (view, wide = false) => {
    const notIn = (product) => !!view && !view.skus.includes(product.sku);
    const grid = wide ? WIDE_GRID : ROW_GRID;
    return (
      <>
        {groups.length > 0 && (
          <s-box border="base" borderRadius="base" overflow="hidden">
            <div style={{ overflowX: 'auto' }}>
            {selCount > 0 ? (
              <s-box background="subdued" border="base" borderWidth="none none base none" paddingBlock="small-200" paddingInline="small">
                <s-grid gridTemplateColumns="1fr auto" alignItems="center">
                  <s-stack direction="inline" gap="small" alignItems="center">
                    <s-checkbox
                      accessibilityLabel="Select all overrides"
                      checked={allSel}
                      indeterminate={!allSel}
                      onChange={(e) => setAll(e.currentTarget.checked)}
                    />
                    <s-text fontSize="small" fontWeight="medium">{`${selCount} selected`}</s-text>
                  </s-stack>
                  <s-button variant="tertiary" tone="critical" onClick={removeSelected}>Remove</s-button>
                </s-grid>
              </s-box>
            ) : (
              <s-box background="subdued" border="base" borderWidth="none none base none" paddingBlock="small-300" paddingInline="small">
                <div style={grid}>
                  <s-checkbox accessibilityLabel="Select all overrides" checked={false} onChange={(e) => setAll(e.currentTarget.checked)} />
                  <s-text fontSize="small" color="subdued" fontWeight="medium">Product</s-text>
                  <div style={END}><s-text fontSize="small" color="subdued" fontWeight="medium">Original price</s-text></div>
                  {wide && <s-text fontSize="small" color="subdued" fontWeight="medium">Price source</s-text>}
                  <s-text fontSize="small" color="subdued" fontWeight="medium">Options</s-text>
                  <s-text fontSize="small" color="subdued" fontWeight="medium">Amount</s-text>
                  <div style={END}><s-text fontSize="small" color="subdued" fontWeight="medium">Buyer pays</s-text></div>
                </div>
              </s-box>
            )}
            {groups.map((g, gi) => {
              const vids = g.variants.map((v) => v.id);
              const collapsible = g.variants.length > 1;
              const isExp = expanded.has(g.product.sku);
              const pAll = vids.every((id) => selected.has(id));
              const pSome = vids.some((id) => selected.has(id));
              // Single priced variant → one inline row (no expand needed).
              if (!collapsible) {
                const v = g.variants[0];
                return (
                  <s-box key={g.product.sku} paddingBlock="small-200" paddingInline="small" border="base" borderWidth={rowBorder(gi === 0)}>
                    <div style={grid}>
                      <s-checkbox
                        accessibilityLabel={`Select ${g.product.title}`}
                        checked={selected.has(v.id)}
                        onChange={(e) => setRow(v.id, e.currentTarget.checked)}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 20, flex: '0 0 auto' }} />
                        <span style={THUMB}><s-icon type="image" color="subdued" /></span>
                        <div style={{ minWidth: 0 }}>
                          <s-paragraph lineClamp={1}>{g.product.title}</s-paragraph>
                          <s-paragraph color="subdued" fontSize="small" lineClamp={1}>{v.title || v.id}</s-paragraph>
                          {!wide && notIn(g.product) ? <s-badge tone="caution">Not in catalog</s-badge> : null}
                        </div>
                      </div>
                      {rowCell(v.id, !notIn(g.product), view, wide)}
                    </div>
                  </s-box>
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
                <s-box key={g.product.sku} border="base" borderWidth={rowBorder(gi === 0)}>
                  <s-box paddingBlock="small-200" paddingInline="small">
                    <div style={grid}>
                      <s-checkbox
                        accessibilityLabel={`Select all variants of ${g.product.title}`}
                        checked={pAll}
                        indeterminate={!pAll && pSome}
                        onChange={(e) => setGroup(vids, e.currentTarget.checked)}
                      />
                      <button
                        type="button"
                        aria-expanded={isExp}
                        onClick={() => toggleExpand(g.product.sku)}
                        style={{ all: 'unset', cursor: 'pointer', display: 'block', minWidth: 0 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={CARET}><s-icon type={isExp ? 'chevron-down' : 'chevron-right'} color="subdued" /></span>
                          <span style={THUMB}><s-icon type="image" color="subdued" /></span>
                          <div style={{ minWidth: 0 }}>
                            <s-paragraph lineClamp={1}>{g.product.title}</s-paragraph>
                            <s-paragraph color="subdued" fontSize="small">{`${g.variants.length} variants`}</s-paragraph>
                            {!wide && notIn(g.product) ? <s-badge tone="caution">Not in catalog</s-badge> : null}
                          </div>
                        </div>
                      </button>
                      {originCells(oLo === oHi ? money(oLo) : `${money(oLo)}–${money(oHi)}`, oSources.length === 1 ? oSources[0] : 'Mixed', !notIn(g.product), wide)}
                      <OverrideOptions
                        value={sameRule ? optVals[0] : 'mixed'}
                        options={groupOpts}
                        onChange={(v) => { if (v !== 'mixed') setGroupField(vids, overrideOptPatch(v)); }}
                      />
                      <OverrideAmount
                        pct={groupPct}
                        value={sameVal ? String(vals[0] ?? '') : ''}
                        placeholder={sameVal ? '' : 'Mixed'}
                        onChange={(v) => setGroupField(vids, { value: Number(v) || 0 })}
                      />
                      <div style={END}>
                        {notIn(g.product) ? <s-text color="subdued">—</s-text> : <s-text fontWeight="medium">{bulkPays}</s-text>}
                      </div>
                    </div>
                  </s-box>
                  {isExp && g.variants.map((v) => (
                    <s-box key={v.id} paddingBlock="small-200" paddingInline="small" border="base" borderWidth="base none none none" background="subdued">
                      <div style={grid}>
                        {/* Variant checkbox indented one level (under the thumbnail);
                            name aligned under the product title with its SKU on a
                            second line — Shopify variant-row pattern. */}
                        <span style={{ paddingInlineStart: 40, display: 'flex', alignItems: 'center' }}>
                          <s-checkbox
                            accessibilityLabel={`Select ${v.title || v.id}`}
                            checked={selected.has(v.id)}
                            onChange={(e) => setRow(v.id, e.currentTarget.checked)}
                          />
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ width: 20, flex: '0 0 auto' }} />
                          <div style={{ minWidth: 0 }}>
                            <s-paragraph lineClamp={1}>{v.title || v.id}</s-paragraph>
                            {v.id && v.id !== v.title ? <s-paragraph color="subdued" fontSize="small" lineClamp={1}>{v.id}</s-paragraph> : null}
                          </div>
                        </div>
                        {rowCell(v.id, !notIn(g.product), view, wide)}
                      </div>
                    </s-box>
                  ))}
                </s-box>
              );
            })}
            </div>
          </s-box>
        )}
      </>
    );
  };

  // Expanded: the same editor full screen (Shopify's maximize pattern). Both views
  // show the overrides at one location, picked next to Add products (the first
  // until another is picked) — a product outside its catalog doesn't get its
  // override there. Done keeps the edits; Close puts them back.
  const openFull = () => { setSnapshot(overrides); setFull(true); };
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
  const target = locations.find((t) => keyOf(t) === viewKey) || locations[0] || null;
  const view = target ? { ...target, ...locationCatalog(target.location, products) } : null;
  const severalCompanies = new Set(locations.map((t) => t.company.id)).size > 1;
  const countBadge = allIds.length > 0 ? <s-badge>{`${allIds.length} variant${allIds.length === 1 ? '' : 's'}`}</s-badge> : null;
  // The location picker; `labelHidden` in the card, where it sits beside Add products.
  const viewSelect = (labelHidden = false) => (
    <s-select
      label="Location"
      labelAccessibilityVisibility={labelHidden ? 'exclusive' : undefined}
      value={keyOf(target)}
      onChange={(e) => setViewKey(e.currentTarget.value)}
    >
      {locations.map((t) => (
        <s-option key={keyOf(t)} value={keyOf(t)}>
          {severalCompanies ? `${t.location.name} · ${t.company.name}` : t.location.name}
        </s-option>
      ))}
    </s-select>
  );

  return (
    <s-section>
      <s-stack gap="small">
        <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-heading>Product price overrides</s-heading>
            {countBadge}
          </s-stack>
          <div>
            <s-button
              icon="maximize"
              variant="tertiary"
              accessibilityLabel="Expand product price overrides"
              interestFor={`${tipId}-expand`}
              onClick={openFull}
            />
            <s-tooltip id={`${tipId}-expand`}>Expand</s-tooltip>
          </div>
        </s-grid>
        <s-paragraph color="subdued" fontSize="small">Give specific product variants their own price. Overrides win over rules and the default.</s-paragraph>
        {locations.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>{searchButton}</div>
            <div style={{ width: 220, flex: '0 0 auto' }}>{viewSelect(true)}</div>
          </div>
        ) : (
          searchButton
        )}
        {groups.length ? (
          table(view)
        ) : (
          <s-box background="subdued" borderRadius="base">
            <div style={{ padding: '40px 16px' }}>
              <s-stack gap="small-400" alignItems="center">
                <s-paragraph fontWeight="semibold">No products to display</s-paragraph>
                <s-paragraph color="subdued">Add products to set an override price</s-paragraph>
              </s-stack>
            </div>
          </s-box>
        )}
        {view && (
          <s-banner tone="info">
            <s-paragraph>
              Price source shows Catalog when the location uses a Shopify catalog. Products that aren’t in the catalog are left blank.
            </s-paragraph>
          </s-banner>
        )}
      </s-stack>

      {/* Portalled to <body>: inside the editor page it would sit under the admin
          frame's top bar, nav and the editor's aside. Modals (the product picker)
          still open on top of it. */}
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
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-heading fontSize="large">Product price overrides</s-heading>
              {countBadge}
            </s-stack>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <s-button onClick={() => closeFull(false)}>Close</s-button>
              <s-button variant="primary" onClick={() => closeFull(true)}>Done</s-button>
              <s-button variant="tertiary" icon="x" accessibilityLabel="Close" onClick={() => closeFull(false)} />
            </div>
          </div>
          <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: 16 }}>
            <s-stack gap="small">
              <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>{searchButton}</div>
                {locations.length > 0 && (
                  <div style={{ width: 320, flex: '0 0 auto' }}>{viewSelect()}</div>
                )}
              </div>
              {view && (
                <s-banner tone="info">
                  <s-paragraph>
                    Price source shows Catalog when the location uses a Shopify catalog. Products that aren’t in the catalog are left blank.
                  </s-paragraph>
                </s-banner>
              )}
              {groups.length ? (
                table(view, true)
              ) : (
                <s-box background="subdued" borderRadius="base">
                  <div style={{ padding: '128px 16px' }}>
                    <s-stack gap="small-400" alignItems="center">
                      <s-paragraph fontWeight="semibold">No products to display</s-paragraph>
                      <s-paragraph color="subdued">Add products to set an override price</s-paragraph>
                    </s-stack>
                  </div>
                </s-box>
              )}
            </s-stack>
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
    </s-section>
  );
}
