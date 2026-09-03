import React, { useState } from 'react';
import { Modal, TextField, Checkbox, Text, InlineStack, Box, Icon } from '@shopify/polaris';
import { SearchIcon, ImageIcon, ChevronDownIcon, ChevronRightIcon } from '@shopify/polaris-icons';
import { money } from '../format.js';
import { productVariants } from '../pricing.js';

// Shopify-style "add products" resource picker. Mirrors the ProductOverridesCard
// table layout (pricingEditorCards.jsx): a [checkbox] · Product (thumbnail + name)
// · Price grid, products with 2+ variants COLLAPSIBLE via a caret into indented
// variant sub-rows on a secondary background. Selection is committed on Add; mount
// it only while open so it resets from `initialSelected` each time.
const PICK_GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 92px', gap: 12, alignItems: 'center' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
const CARET = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: '0 0 auto', width: 20 };

export function VariantPicker({ products, initialSelected, onCancel, onAdd }) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = q
    ? products.filter((p) => [p.title, p.sku, p.vendor].filter(Boolean).join(' ').toLowerCase().includes(q))
    : products;

  const toggleVariant = (vid) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(vid)) n.delete(vid);
      else n.add(vid);
      return n;
    });
  const toggleProduct = (p) => {
    const vids = productVariants(p).map((v) => v.id);
    const all = vids.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      vids.forEach((id) => (all ? n.delete(id) : n.add(id)));
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
  const toggleAllShown = () =>
    setSelected((s) => {
      const n = new Set(s);
      shownVids.forEach((id) => (allShownSel ? n.delete(id) : n.add(id)));
      return n;
    });

  const count = selected.size;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add products"
      primaryAction={{ content: count ? `Add ${count} variant${count === 1 ? '' : 's'}` : 'Done', onAction: () => onAdd(selected) }}
      secondaryActions={[{ content: 'Cancel', onAction: onCancel }]}
    >
      <Modal.Section>
        <TextField
          label="Search products"
          labelHidden
          value={query}
          onChange={setQuery}
          prefix={<Icon source={SearchIcon} tone="subdued" />}
          placeholder="Search products by name or SKU"
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setQuery('')}
        />
      </Modal.Section>
      <Modal.Section flush>
        {/* Column header — mirrors the overrides table. */}
        <Box background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border" paddingBlock="150" paddingInline="400">
          <div style={PICK_GRID}>
            <Checkbox label="" labelHidden checked={allShownSel ? true : someShownSel ? 'indeterminate' : false} onChange={toggleAllShown} />
            <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Product</Text>
            <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium" alignment="end">Price</Text>
          </div>
        </Box>
        <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
          {shown.map((p, i) => {
            const variants = productVariants(p);
            const multi = variants.length > 1;
            const vids = variants.map((v) => v.id);
            const allSel = vids.every((id) => selected.has(id));
            const someSel = vids.some((id) => selected.has(id));
            const isExp = expanded.has(p.sku);
            const topBorder = i === 0 ? '0' : '025';
            // A multi-variant product whose variants are priced differently reads
            // as "Mixed" (rather than a range), matching the overrides table.
            const listVals = variants.map((v) => v.list ?? p.list);
            const priceMixed = Math.min(...listVals) !== Math.max(...listVals);
            const price = priceMixed ? 'Mixed' : money(listVals[0]);

            // Single-variant product → one inline row (no caret, aligned via a spacer).
            if (!multi) {
              return (
                <Box key={p.sku} paddingBlock="200" paddingInline="400" borderBlockStartWidth={topBorder} borderColor="border">
                  <div style={PICK_GRID}>
                    <Checkbox label="" labelHidden checked={selected.has(vids[0])} onChange={() => toggleVariant(vids[0])} />
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <span style={{ width: 20, flex: '0 0 auto' }} />
                      <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                      <div style={{ minWidth: 0 }}>
                        <Text as="span" variant="bodyMd" truncate>{p.title}</Text>
                        <Text as="p" tone="subdued" variant="bodySm" truncate>{[p.sku, p.vendor].filter(Boolean).join(' · ')}</Text>
                      </div>
                    </InlineStack>
                    <Text as="span" variant="bodyMd" alignment="end" tone={priceMixed ? 'subdued' : undefined}>{price}</Text>
                  </div>
                </Box>
              );
            }
            // Multi-variant product → collapsible product row + variant sub-rows.
            return (
              <Box key={p.sku} borderBlockStartWidth={topBorder} borderColor="border">
                <Box paddingBlock="200" paddingInline="400">
                  <div style={PICK_GRID}>
                    <Checkbox label="" labelHidden checked={allSel ? true : someSel ? 'indeterminate' : false} onChange={() => toggleProduct(p)} />
                    <button type="button" onClick={() => toggleExpand(p.sku)} style={{ all: 'unset', cursor: 'pointer', display: 'block', minWidth: 0 }}>
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <span style={CARET}><Icon source={isExp ? ChevronDownIcon : ChevronRightIcon} tone="subdued" /></span>
                        <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                        <div style={{ minWidth: 0 }}>
                          <Text as="span" variant="bodyMd" truncate>{p.title}</Text>
                          <Text as="p" tone="subdued" variant="bodySm">{`${variants.length} variants`}</Text>
                        </div>
                      </InlineStack>
                    </button>
                    <Text as="span" variant="bodyMd" alignment="end" tone={priceMixed ? 'subdued' : undefined}>{price}</Text>
                  </div>
                </Box>
                {isExp && variants.map((v) => (
                  <Box key={v.id} paddingBlock="200" paddingInline="400" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                    <div style={PICK_GRID}>
                      {/* Indent the variant checkbox one level (under the product's
                          thumbnail) so the row reads as a child; the name stays
                          aligned under the product title. No variant thumbnail —
                          matching the Shopify desktop resource picker. */}
                      <span style={{ paddingInlineStart: 40, display: 'flex', alignItems: 'center' }}>
                        <Checkbox label="" labelHidden checked={selected.has(v.id)} onChange={() => toggleVariant(v.id)} />
                      </span>
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <span style={{ width: 20, flex: '0 0 auto' }} />
                        <div style={{ minWidth: 0 }}>
                          <Text as="span" variant="bodyMd" truncate>{v.title || v.id}</Text>
                          {v.id && v.id !== v.title ? <Text as="p" tone="subdued" variant="bodySm" truncate>{v.id}</Text> : null}
                        </div>
                      </InlineStack>
                      <Text as="span" variant="bodyMd" alignment="end">{money(v.list ?? p.list)}</Text>
                    </div>
                  </Box>
                ))}
              </Box>
            );
          })}
          {shown.length === 0 && (
            <Box padding="400">
              <Text as="p" alignment="center" tone="subdued">{`No products match “${query.trim()}”.`}</Text>
            </Box>
          )}
        </div>
      </Modal.Section>
    </Modal>
  );
}
