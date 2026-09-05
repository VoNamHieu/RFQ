import React, { useState } from 'react';
import { Modal, TextField, Checkbox, Text, InlineStack, Box, Icon, Badge } from '@shopify/polaris';
import { SearchIcon, ImageIcon, ChevronDownIcon, ChevronRightIcon, AlertTriangleIcon } from '@shopify/polaris-icons';
import { money } from '../utils.js';

// Shared Shopify-style resource picker (draft-order "Browse products" pattern),
// used by both the catalog picker and the whole-store picker. Features: search,
// select-all + indeterminate, product rows with a thumbnail / available inventory
// / price that expand (caret) into indented variant sub-rows, an out-of-stock
// warning, preselection ("Added" — variants already on the quote are checked,
// locked and excluded from the add), and a selected-count footer with a max cap.
//
// `products`: [{ sku, title, stock?, variants:[{ id, title, price, stock? }] }]
const GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 118px 96px', gap: 12, alignItems: 'center' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
const CARET = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: '0 0 auto', width: 20 };

const variantStock = (v, p) => (v.stock != null ? v.stock : p.stock != null ? p.stock : 0);
const productStock = (p) =>
  p.variants.some((v) => v.stock != null) ? p.variants.reduce((s, v) => s + (v.stock || 0), 0) : p.stock ?? 0;

function AvailCell({ n }) {
  if (n === 0) {
    return (
      <InlineStack gap="050" blockAlign="center" wrap={false} align="end">
        <span style={{ display: 'flex' }}><Icon source={AlertTriangleIcon} tone="caution" /></span>
        <Text as="span" variant="bodySm" tone="caution">Out of stock</Text>
      </InlineStack>
    );
  }
  return <Text as="span" variant="bodyMd" alignment="end" tone="subdued">{n.toLocaleString('en-US')}</Text>;
}

export function ProductPickerModal({ title, products, priceHeader = 'Price', priced = false, initialSelected, onClose, onAdd, backAction, max = 500 }) {
  const locked = initialSelected || new Set();
  const [selected, setSelected] = useState(() => new Set(locked));
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = q ? products.filter((p) => [p.title, p.sku].join(' ').toLowerCase().includes(q)) : products;

  const toggleVariant = (vid) => {
    if (locked.has(vid)) return;
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(vid)) n.delete(vid);
      else n.add(vid);
      return n;
    });
  };
  const toggleProduct = (p) => {
    const vids = p.variants.map((v) => v.id).filter((id) => !locked.has(id));
    if (!vids.length) return;
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

  // Select-all acts only on the shown, not-yet-added variants.
  const shownSelectable = shown.flatMap((p) => p.variants.map((v) => v.id)).filter((id) => !locked.has(id));
  const allShownSel = shownSelectable.length > 0 && shownSelectable.every((id) => selected.has(id));
  const someShownSel = shownSelectable.some((id) => selected.has(id));
  const toggleAllShown = () =>
    setSelected((s) => {
      const n = new Set(s);
      shownSelectable.forEach((id) => (allShownSel ? n.delete(id) : n.add(id)));
      return n;
    });

  const priceLabel = (vs) => {
    const lo = Math.min(...vs.map((v) => v.price));
    const hi = Math.max(...vs.map((v) => v.price));
    return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
  };
  // New picks = selected minus what's already on the quote.
  const newCount = [...selected].filter((id) => !locked.has(id)).length;

  const doAdd = () => {
    const additions = [];
    products.forEach((p) => {
      const single = p.variants.length === 1 && p.variants[0].id === p.sku;
      p.variants.forEach((v) => {
        if (!selected.has(v.id) || locked.has(v.id)) return;
        additions.push({ sku: v.id, title: single ? p.title : `${p.title} — ${v.title}`, price: v.price, qty: 1, priced });
      });
    });
    onAdd(additions);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      primaryAction={{ content: newCount ? `Add ${newCount} variant${newCount === 1 ? '' : 's'}` : 'Done', onAction: doAdd, disabled: newCount === 0 }}
      secondaryActions={[backAction || { content: 'Cancel', onAction: onClose }]}
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
        <Box background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border" paddingBlock="150" paddingInline="400">
          <div style={GRID}>
            <Checkbox label="" labelHidden checked={allShownSel ? true : someShownSel ? 'indeterminate' : false} onChange={toggleAllShown} />
            <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Product</Text>
            <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium" alignment="end">Available</Text>
            <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium" alignment="end">{priceHeader}</Text>
          </div>
        </Box>
        <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
          {shown.map((p, i) => {
            const multi = p.variants.length > 1;
            const vids = p.variants.map((v) => v.id);
            const selectableVids = vids.filter((id) => !locked.has(id));
            const allSel = selectableVids.length > 0 && selectableVids.every((id) => selected.has(id));
            const someSel = vids.some((id) => selected.has(id));
            const allLocked = selectableVids.length === 0;
            const isExp = expanded.has(p.sku);
            const topBorder = i === 0 ? '0' : '025';

            if (!multi) {
              const v = p.variants[0];
              const added = locked.has(v.id);
              return (
                <Box key={p.sku} paddingBlock="200" paddingInline="400" borderBlockStartWidth={topBorder} borderColor="border">
                  <div style={GRID}>
                    <Checkbox label="" labelHidden checked={selected.has(v.id)} disabled={added} onChange={() => toggleVariant(v.id)} />
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <span style={{ width: 20, flex: '0 0 auto' }} />
                      <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                      <div style={{ minWidth: 0 }}>
                        <InlineStack gap="150" blockAlign="center" wrap={false}>
                          <Text as="span" variant="bodyMd" truncate>{p.title}</Text>
                          {added ? <Badge tone="success" size="small">Added</Badge> : null}
                        </InlineStack>
                        <Text as="p" tone="subdued" variant="bodySm" truncate>{p.sku}</Text>
                      </div>
                    </InlineStack>
                    <AvailCell n={variantStock(v, p)} />
                    <Text as="span" variant="bodyMd" alignment="end">{money(v.price)}</Text>
                  </div>
                </Box>
              );
            }
            return (
              <Box key={p.sku} borderBlockStartWidth={topBorder} borderColor="border">
                <Box paddingBlock="200" paddingInline="400">
                  <div style={GRID}>
                    <Checkbox label="" labelHidden checked={allSel ? true : someSel ? 'indeterminate' : false} disabled={allLocked} onChange={() => toggleProduct(p)} />
                    <button type="button" onClick={() => toggleExpand(p.sku)} style={{ all: 'unset', cursor: 'pointer', display: 'block', minWidth: 0 }}>
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <span style={CARET}><Icon source={isExp ? ChevronDownIcon : ChevronRightIcon} tone="subdued" /></span>
                        <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                        <div style={{ minWidth: 0 }}>
                          <Text as="span" variant="bodyMd" truncate>{p.title}</Text>
                          <Text as="p" tone="subdued" variant="bodySm">{`${p.variants.length} variants`}</Text>
                        </div>
                      </InlineStack>
                    </button>
                    <AvailCell n={productStock(p)} />
                    <Text as="span" variant="bodyMd" alignment="end">{priceLabel(p.variants)}</Text>
                  </div>
                </Box>
                {isExp && p.variants.map((v) => {
                  const added = locked.has(v.id);
                  return (
                    <Box key={v.id} paddingBlock="200" paddingInline="400" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                      <div style={GRID}>
                        <span style={{ paddingInlineStart: 40, display: 'flex', alignItems: 'center' }}>
                          <Checkbox label="" labelHidden checked={selected.has(v.id)} disabled={added} onChange={() => toggleVariant(v.id)} />
                        </span>
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <span style={{ width: 20, flex: '0 0 auto' }} />
                          <div style={{ minWidth: 0 }}>
                            <InlineStack gap="150" blockAlign="center" wrap={false}>
                              <Text as="span" variant="bodyMd" truncate>{v.title}</Text>
                              {added ? <Badge tone="success" size="small">Added</Badge> : null}
                            </InlineStack>
                            <Text as="p" tone="subdued" variant="bodySm" truncate>{v.id}</Text>
                          </div>
                        </InlineStack>
                        <AvailCell n={variantStock(v, p)} />
                        <Text as="span" variant="bodyMd" alignment="end">{money(v.price)}</Text>
                      </div>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
          {shown.length === 0 && (
            <Box padding="400">
              <Text as="p" alignment="center" tone="subdued">{`No products match “${query.trim()}”.`}</Text>
            </Box>
          )}
        </div>
        <Box paddingBlock="200" paddingInline="400" borderBlockStartWidth="025" borderColor="border">
          <Text as="span" tone="subdued" variant="bodySm">{`${newCount}/${max} variants selected`}</Text>
        </Box>
      </Modal.Section>
    </Modal>
  );
}
