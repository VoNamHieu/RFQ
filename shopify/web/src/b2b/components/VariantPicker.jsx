import React, { useState } from 'react';
import { Modal } from '../../shared/wc.jsx';
import { money } from '../format.js';
import { productVariants } from '../pricing.js';

// Shopify-style "add products" resource picker. Mirrors the ProductOverridesCard
// table layout (pricingEditorCards.jsx): a [checkbox] · Product (thumbnail + name)
// · Price grid, products with 2+ variants COLLAPSIBLE via a caret into indented
// variant sub-rows on a secondary background. Selection is committed on Add; mount
// it only while open so it resets from `initialSelected` each time. `heading` and
// `actionLabel(count)` let other flows reuse it (quantity pricing: Select products).
const addLabel = (count) => (count ? `Add ${count} variant${count === 1 ? '' : 's'}` : 'Done');
const PICK_GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 92px', gap: 12, alignItems: 'center' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
const CARET = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: '0 0 auto', width: 20 };
// Caret/spacer · thumbnail · name, on one line that never wraps.
const ROW_START = { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 };
// Sort options mirror Shopify's product index (title / price).
const SORT_OPTIONS = [
  { label: 'Product A–Z', value: 'title-asc' },
  { label: 'Product Z–A', value: 'title-desc' },
  { label: 'Price: low to high', value: 'price-asc' },
  { label: 'Price: high to low', value: 'price-desc' },
];

export function VariantPicker({ products, initialSelected, onCancel, onAdd, heading = 'Add products', actionLabel = addLabel }) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('title-asc');

  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter((p) => [p.title, p.sku, p.vendor].filter(Boolean).join(' ').toLowerCase().includes(q))
    : products;
  const productPrice = (p) => Math.min(...productVariants(p).map((v) => v.list ?? p.list));
  const shown = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.title.localeCompare(a.title);
      case 'price-asc': return productPrice(a) - productPrice(b);
      case 'price-desc': return productPrice(b) - productPrice(a);
      default: return a.title.localeCompare(b.title);
    }
  });

  // Checkbox handlers set the state from the box's checked value (a repeated change
  // event is then harmless): a variant, or every variant of a product.
  const setVariant = (vid, on) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(vid);
      else n.delete(vid);
      return n;
    });
  const setProduct = (p, on) => {
    const vids = productVariants(p).map((v) => v.id);
    setSelected((s) => {
      const n = new Set(s);
      vids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  };
  const toggleExpand = (sku) =>
    setExpanded((e) => {
      const n = new Set(e);
      if (n.has(sku)) n.delete(sku);
      else n.add(sku);
      return n;
    });

  // Header select-all acts on every variant of the currently shown (filtered) products.
  const shownVids = shown.flatMap((p) => productVariants(p).map((v) => v.id));
  const allShownSel = shownVids.length > 0 && shownVids.every((id) => selected.has(id));
  const someShownSel = shownVids.some((id) => selected.has(id));
  const setAllShown = (on) =>
    setSelected((s) => {
      const n = new Set(s);
      shownVids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  const count = selected.size;

  return (
    <Modal onClose={onCancel} heading={heading} padding="none">
      <s-box padding="base">
        <s-grid gridTemplateColumns="minmax(0, 1fr) 210px" gap="small-200" alignItems="center">
          <s-search-field
            label="Search products"
            labelAccessibilityVisibility="exclusive"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search products by name or SKU"
            autocomplete="off"
          />
          <s-select label="Sort by" labelAccessibilityVisibility="exclusive" value={sort} onChange={(e) => setSort(e.currentTarget.value)}>
            {SORT_OPTIONS.map((o) => (
              <s-option key={o.value} value={o.value}>{o.label}</s-option>
            ))}
          </s-select>
        </s-grid>
      </s-box>
      <s-divider />
      {/* Column header — mirrors the overrides table. */}
      <s-box background="subdued" paddingBlock="small-300" paddingInline="base">
        <div style={PICK_GRID}>
          <s-checkbox
            accessibilityLabel="Select all shown products"
            checked={allShownSel}
            indeterminate={!allShownSel && someShownSel}
            onChange={(e) => setAllShown(e.currentTarget.checked)}
          />
          <s-text fontSize="small" color="subdued" fontWeight="medium">Product</s-text>
          <div style={{ textAlign: 'end' }}>
            <s-text fontSize="small" color="subdued" fontWeight="medium">Price</s-text>
          </div>
        </div>
      </s-box>
      <s-divider />
      <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
        {shown.map((p, i) => {
          const variants = productVariants(p);
          const multi = variants.length > 1;
          const vids = variants.map((v) => v.id);
          const allSel = vids.every((id) => selected.has(id));
          const someSel = vids.some((id) => selected.has(id));
          const isExp = expanded.has(p.sku);
          // Price shown for the product: a single value, or a low–high range
          // when its variants are priced differently.
          const listVals = variants.map((v) => v.list ?? p.list);
          const listLo = Math.min(...listVals);
          const listHi = Math.max(...listVals);
          const price = listLo === listHi ? money(listLo) : `${money(listLo)}–${money(listHi)}`;

          // Single-variant product → one inline row (no caret, aligned via a spacer).
          if (!multi) {
            return (
              <React.Fragment key={p.sku}>
                {i > 0 ? <s-divider /> : null}
                <s-box paddingBlock="small-200" paddingInline="base">
                  <div style={PICK_GRID}>
                    <s-checkbox
                      accessibilityLabel={`Select ${p.title}`}
                      checked={selected.has(vids[0])}
                      onChange={(e) => setVariant(vids[0], e.currentTarget.checked)}
                    />
                    <div style={ROW_START}>
                      <span style={{ width: 20, flex: '0 0 auto' }} />
                      <span style={THUMB}><s-icon type="image" color="subdued" /></span>
                      <div style={{ minWidth: 0 }}>
                        <s-paragraph lineClamp={1}>{p.title}</s-paragraph>
                        <s-paragraph color="subdued" fontSize="small" lineClamp={1}>{[p.sku, p.vendor].filter(Boolean).join(' · ')}</s-paragraph>
                      </div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <s-text>{price}</s-text>
                    </div>
                  </div>
                </s-box>
              </React.Fragment>
            );
          }
          // Multi-variant product → collapsible product row + variant sub-rows.
          return (
            <React.Fragment key={p.sku}>
              {i > 0 ? <s-divider /> : null}
              <s-box paddingBlock="small-200" paddingInline="base">
                <div style={PICK_GRID}>
                  <s-checkbox
                    accessibilityLabel={`Select all variants of ${p.title}`}
                    checked={allSel}
                    indeterminate={!allSel && someSel}
                    onChange={(e) => setProduct(p, e.currentTarget.checked)}
                  />
                  <button
                    type="button"
                    aria-expanded={isExp}
                    onClick={() => toggleExpand(p.sku)}
                    style={{ all: 'unset', cursor: 'pointer', display: 'block', minWidth: 0 }}
                  >
                    <div style={ROW_START}>
                      <span style={CARET}><s-icon type={isExp ? 'chevron-down' : 'chevron-right'} color="subdued" /></span>
                      <span style={THUMB}><s-icon type="image" color="subdued" /></span>
                      <div style={{ minWidth: 0 }}>
                        <s-paragraph lineClamp={1}>{p.title}</s-paragraph>
                        <s-paragraph color="subdued" fontSize="small">{`${variants.length} variants`}</s-paragraph>
                      </div>
                    </div>
                  </button>
                  <div style={{ textAlign: 'end' }}>
                    <s-text>{price}</s-text>
                  </div>
                </div>
              </s-box>
              {isExp && variants.map((v) => (
                <React.Fragment key={v.id}>
                  <s-divider />
                  <s-box paddingBlock="small-200" paddingInline="base" background="subdued">
                    <div style={PICK_GRID}>
                      {/* Indent the variant checkbox one level (under the product's
                          thumbnail) so the row reads as a child; the name stays
                          aligned under the product title. No variant thumbnail —
                          matching the Shopify desktop resource picker. */}
                      <span style={{ paddingInlineStart: 40, display: 'flex', alignItems: 'center' }}>
                        <s-checkbox
                          accessibilityLabel={`Select ${v.title || v.id}`}
                          checked={selected.has(v.id)}
                          onChange={(e) => setVariant(v.id, e.currentTarget.checked)}
                        />
                      </span>
                      <div style={ROW_START}>
                        <span style={{ width: 20, flex: '0 0 auto' }} />
                        <div style={{ minWidth: 0 }}>
                          <s-paragraph lineClamp={1}>{v.title || v.id}</s-paragraph>
                          {v.id && v.id !== v.title ? <s-paragraph color="subdued" fontSize="small" lineClamp={1}>{v.id}</s-paragraph> : null}
                        </div>
                      </div>
                      <div style={{ textAlign: 'end' }}>
                        <s-text>{money(v.list ?? p.list)}</s-text>
                      </div>
                    </div>
                  </s-box>
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        })}
        {shown.length === 0 && (
          <s-box padding="base">
            <div style={{ textAlign: 'center' }}>
              <s-text color="subdued">{`No products match “${query.trim()}”.`}</s-text>
            </div>
          </s-box>
        )}
      </div>
      <s-button slot="primary-action" variant="primary" onClick={() => onAdd(selected)}>
        {actionLabel(count)}
      </s-button>
      <s-button slot="secondary-actions" onClick={onCancel}>
        Cancel
      </s-button>
    </Modal>
  );
}
