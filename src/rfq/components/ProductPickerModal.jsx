import React, { useState } from 'react';
import { Modal, TextField, Select, Checkbox, Text, InlineStack, BlockStack, Box, Icon, Badge, Banner, Tooltip } from '@shopify/polaris';
import { SearchIcon, ImageIcon, ChevronDownIcon, ChevronRightIcon, AlertTriangleIcon } from '@shopify/polaris-icons';
import { money } from '../utils.js';

// Shared Shopify-style resource picker (draft-order "Browse products" pattern),
// used by both the catalog picker and the whole-store picker. Features: search,
// select-all + indeterminate, product rows with a thumbnail / available inventory
// / price that expand (caret) into indented variant sub-rows, an out-of-stock
// warning, an option-aware "Added" state (see below), and a selected-count footer
// with a max cap.
//
// `onQuote`: Map sku → { source, sourceRef, sourceLabel, price } of lines already on
// the quote, and `option`: { source, sourceRef, label } identifying THIS picker. A
// line added by this same option shows ticked "Added" and can be unticked to remove;
// a line added by another option shows an unticked info "Added" badge that, when
// re-ticked, overrides that line's price with this option's (one price per sku).
//
// `products`: [{ sku, title, stock?, variants:[{ id, title, price, stock? }] }]
const GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 118px 96px 96px', gap: 12, alignItems: 'center' };
// Same, plus a trailing Qty column, for the editable (custom-priced) mode.
const GRID_EDIT = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 118px 96px 96px 72px', gap: 12, alignItems: 'center' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };
const CARET = { all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: '0 0 auto', width: 20 };
// Sort options mirror Shopify's product index (title / price / inventory).
const SORT_OPTIONS = [
  { label: 'Product A–Z', value: 'title-asc' },
  { label: 'Product Z–A', value: 'title-desc' },
  { label: 'Price: low to high', value: 'price-asc' },
  { label: 'Price: high to low', value: 'price-desc' },
  { label: 'Available: high to low', value: 'avail-desc' },
];

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

// "Added" status for a row: a green badge for a line this option added (ticked,
// removable), an info badge for a line another option added (unticked here) that
// flips to an "Override" badge once re-ticked (its price will be replaced on apply).
function AddedBadge({ mine, other, isSel }) {
  if (mine) return <Badge tone="success" size="small">Added</Badge>;
  if (!other) return null;
  if (isSel) return <Badge tone="attention" size="small">Override</Badge>;
  return (
    <span title={other.sourceLabel ? `On quote · ${other.sourceLabel}` : 'Already on this quote'}>
      <Badge tone="info" size="small">Added</Badge>
    </span>
  );
}

// "In quote" column: the price the variant currently carries on the quote, or an em
// dash when it isn't on the quote yet. `label` (a range) is used for a product header.
function InQuoteCell({ price, label }) {
  const text = label != null ? label : price != null ? money(price) : null;
  return (
    <Text as="span" variant="bodyMd" alignment="end" tone={text == null ? 'subdued' : undefined}>
      {text == null ? '—' : text}
    </Text>
  );
}
// Range of on-quote prices across a product's variants (for the collapsed group row).
const inQuoteLabel = (variants, quote) => {
  const ps = variants.map((v) => quote.get(v.id)?.price).filter((x) => x != null);
  if (!ps.length) return null;
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
};

// A right-aligned column header with a hover tooltip (dotted underline = "hover me").
function HeaderHelp({ label, content }) {
  return (
    <div style={{ justifySelf: 'end' }}>
      <Tooltip content={content} preferredPosition="above" width="wide">
        <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
          <span style={{ borderBottom: '1px dotted var(--p-color-border)', cursor: 'help' }}>{label}</span>
        </Text>
      </Tooltip>
    </div>
  );
}

export function ProductPickerModal({ title, products, priceHeader = 'Price', qtyHeader = 'Qty', priced = false, editable = false, size = 'large', onQuote, option, onClose, onAdd, backAction, max = 500 }) {
  // Variants already on the quote, keyed by sku → { source, sourceRef, sourceLabel, price }.
  // A line "belongs" to this picker's option when (source, sourceRef) match: it shows as
  // ticked "Added" and can be unticked to remove. A line added from ANOTHER option shows
  // as an unticked "Added" (info) badge — re-ticking it re-applies THIS option's price to
  // the single quote line (one price per sku, last pick wins). See CreateQuote.mergeLines.
  const quote = onQuote instanceof Map ? onQuote : new Map();
  const opt = option || {};
  const sameOption = (info) => !!info && info.source === opt.source && (info.sourceRef ?? null) === (opt.sourceRef ?? null);
  const mineOf = (id) => { const i = quote.get(id); return sameOption(i) ? i : null; }; // added by this option
  const otherOf = (id) => { const i = quote.get(id); return i && !sameOption(i) ? i : null; }; // added by another option
  const mineSkus = [...quote.keys()].filter((id) => sameOption(quote.get(id)));
  const [selected, setSelected] = useState(() => new Set(mineSkus)); // seed only same-option picks
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('title-asc');
  // Editable mode: per-variant price/qty overrides (price defaults to the variant
  // price, qty to 1). Used by the "Add custom priced items" flow.
  const [edits, setEdits] = useState({});
  const grid = editable ? GRID_EDIT : GRID;
  const editOf = (v) => ({ price: v.price, qty: 1, ...(edits[v.id] || {}) });
  const setEdit = (vid, patch) => setEdits((e) => ({ ...e, [vid]: { ...(e[vid] || {}), ...patch } }));

  const q = query.trim().toLowerCase();
  const filtered = q ? products.filter((p) => [p.title, p.sku].join(' ').toLowerCase().includes(q)) : products;
  const productPrice = (p) => Math.min(...p.variants.map((v) => v.price));
  const shown = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.title.localeCompare(a.title);
      case 'price-asc': return productPrice(a) - productPrice(b);
      case 'price-desc': return productPrice(b) - productPrice(a);
      case 'avail-desc': return productStock(b) - productStock(a);
      default: return a.title.localeCompare(b.title);
    }
  });

  const toggleVariant = (vid) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(vid)) n.delete(vid);
      else n.add(vid);
      return n;
    });
  };
  const toggleProduct = (p) => {
    const vids = p.variants.map((v) => v.id).filter((id) => !otherOf(id)); // don't bulk-override other-option lines
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

  // Select-all acts on shown variants, excluding lines added from another option —
  // those are overridden only by a deliberate per-row tick, never in bulk.
  const shownSelectable = shown.flatMap((p) => p.variants.map((v) => v.id)).filter((id) => !otherOf(id));
  const hasOtherOption = shown.some((p) => p.variants.some((v) => otherOf(v.id)));
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
  // Three kinds of change: brand-new picks (not on the quote at all), overrides (a line
  // from another option, re-ticked → its price is replaced by this option's), and
  // removals (a same-option line the user unticked).
  const addCount = [...selected].filter((id) => !quote.has(id)).length;
  const overrideCount = [...selected].filter((id) => otherOf(id)).length;
  const removeCount = mineSkus.filter((id) => !selected.has(id)).length;
  const changeCount = addCount + overrideCount + removeCount;

  const doAdd = () => {
    const additions = [];
    const removals = [];
    products.forEach((p) => {
      const single = p.variants.length === 1 && p.variants[0].id === p.sku;
      p.variants.forEach((v) => {
        const mine = mineOf(v.id);
        const other = otherOf(v.id);
        const isSel = selected.has(v.id);
        if (mine) { if (!isSel) removals.push(v.id); return; } // same-option line unticked → remove
        if (!isSel) return; // untouched new / other-option line → leave as-is
        const e = editable ? editOf(v) : null;
        additions.push({
          sku: v.id,
          title: single ? p.title : `${p.title} — ${v.title}`,
          price: e ? Number(e.price) : v.price,
          qty: e ? Number(e.qty) : 1,
          priced,
          source: opt.source,
          sourceRef: opt.sourceRef ?? null,
          sourceLabel: opt.label || '',
          override: !!other, // re-ticked a line from another option → replace its price, keep its qty
        });
      });
    });
    onAdd(additions, removals);
  };

  return (
    <Modal
      open
      size={size}
      onClose={onClose}
      title={title}
      primaryAction={{
        content:
          changeCount === 0
            ? 'Done'
            : [
                addCount ? `Add ${addCount}` : null,
                overrideCount ? `Replace ${overrideCount}` : null,
                removeCount ? `Remove ${removeCount}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
        onAction: doAdd,
        disabled: changeCount === 0,
      }}
      secondaryActions={[backAction || { content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {hasOtherOption ? (
            <Banner tone="info">
              <Text as="p">
                Some products below are already on this quote from another option (marked{' '}
                <Text as="span" fontWeight="semibold">Added</Text>). Re-tick one to replace its price with this{' '}
                {opt.source === 'b2b' ? 'B2B price' : opt.source === 'catalog' ? 'catalog price' : opt.source === 'store' ? 'store price' : 'price'}.
              </Text>
            </Banner>
          ) : null}
          <InlineStack gap="200" blockAlign="center" wrap={false}>
          <div style={{ flex: 1, minWidth: 0 }}>
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
          </div>
          <div style={{ width: 210, flex: '0 0 auto' }}>
            <Select label="Sort by" labelHidden options={SORT_OPTIONS} value={sort} onChange={setSort} />
          </div>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
      <Modal.Section flush>
        <Box background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border" paddingBlock="150" paddingInline="400">
          <div style={grid}>
            <Checkbox label="" labelHidden checked={allShownSel ? true : someShownSel ? 'indeterminate' : false} onChange={toggleAllShown} />
            <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Product</Text>
            <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium" alignment="end">Available</Text>
            <HeaderHelp
              label={priceHeader}
              content={`The price you’ll add this product at. You can still change it on the quote later.`}
            />
            <HeaderHelp
              label="In quote"
              content={`The product’s current price in this quote. “—” means it hasn’t been added yet. Select an added product to switch it to the ${priceHeader}.`}
            />
            {editable ? <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium" alignment="end">{qtyHeader}</Text> : null}
          </div>
        </Box>
        <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
          {shown.map((p, i) => {
            const multi = p.variants.length > 1;
            // Header checkbox reflects only the variants it controls — other-option
            // lines are excluded (they override per-row, not via the header).
            const vids = p.variants.map((v) => v.id).filter((id) => !otherOf(id));
            const allSel = vids.length > 0 && vids.every((id) => selected.has(id));
            const someSel = vids.some((id) => selected.has(id));
            const isExp = expanded.has(p.sku);
            const topBorder = i === 0 ? '0' : '025';

            if (!multi) {
              const v = p.variants[0];
              const mine = !!mineOf(v.id);
              const other = otherOf(v.id);
              const isSel = selected.has(v.id);
              return (
                <Box key={p.sku} paddingBlock="200" paddingInline="400" borderBlockStartWidth={topBorder} borderColor="border">
                  <div style={grid}>
                    <Checkbox label="" labelHidden checked={selected.has(v.id)} onChange={() => toggleVariant(v.id)} />
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <span style={{ width: 20, flex: '0 0 auto' }} />
                      <span style={THUMB}><Icon source={ImageIcon} tone="subdued" /></span>
                      <div style={{ minWidth: 0 }}>
                        <InlineStack gap="150" blockAlign="center" wrap={false}>
                          <Text as="span" variant="bodyMd" truncate>{p.title}</Text>
                          <AddedBadge mine={mine} other={other} isSel={isSel} />
                        </InlineStack>
                        <Text as="p" tone="subdued" variant="bodySm" truncate>{p.sku}</Text>
                      </div>
                    </InlineStack>
                    <AvailCell n={variantStock(v, p)} />
                    {editable ? (
                      <div style={{ width: 96, justifySelf: 'end' }}>
                        <TextField label="Price" labelHidden type="number" min={0} prefix="$" value={String(editOf(v).price)} onChange={(val) => setEdit(v.id, { price: Number(val) })} autoComplete="off" />
                      </div>
                    ) : (
                      <Text as="span" variant="bodyMd" alignment="end">{money(v.price)}</Text>
                    )}
                    <InQuoteCell price={quote.get(v.id)?.price} />
                    {editable ? (
                      <div style={{ width: 72, justifySelf: 'end' }}>
                        <TextField label="Qty" labelHidden type="number" min={1} value={String(editOf(v).qty)} onChange={(val) => setEdit(v.id, { qty: Math.max(1, Number(val) || 1) })} autoComplete="off" />
                      </div>
                    ) : null}
                  </div>
                </Box>
              );
            }
            return (
              <Box key={p.sku} borderBlockStartWidth={topBorder} borderColor="border">
                <Box paddingBlock="200" paddingInline="400">
                  <div style={grid}>
                    <Checkbox label="" labelHidden checked={allSel ? true : someSel ? 'indeterminate' : false} onChange={() => toggleProduct(p)} />
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
                    <InQuoteCell label={inQuoteLabel(p.variants, quote)} />
                    {editable ? <span /> : null}
                  </div>
                </Box>
                {isExp && p.variants.map((v) => {
                  const mine = !!mineOf(v.id);
                  const other = otherOf(v.id);
                  const isSel = selected.has(v.id);
                  return (
                    <Box key={v.id} paddingBlock="200" paddingInline="400" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                      <div style={grid}>
                        <span style={{ paddingInlineStart: 40, display: 'flex', alignItems: 'center' }}>
                          <Checkbox label="" labelHidden checked={selected.has(v.id)} onChange={() => toggleVariant(v.id)} />
                        </span>
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <span style={{ width: 20, flex: '0 0 auto' }} />
                          <div style={{ minWidth: 0 }}>
                            <InlineStack gap="150" blockAlign="center" wrap={false}>
                              <Text as="span" variant="bodyMd" truncate>{v.title}</Text>
                              <AddedBadge mine={mine} other={other} isSel={isSel} />
                            </InlineStack>
                            <Text as="p" tone="subdued" variant="bodySm" truncate>{v.id}</Text>
                          </div>
                        </InlineStack>
                        <AvailCell n={variantStock(v, p)} />
                        {editable ? (
                          <div style={{ width: 96, justifySelf: 'end' }}>
                            <TextField label="Price" labelHidden type="number" min={0} prefix="$" value={String(editOf(v).price)} onChange={(val) => setEdit(v.id, { price: Number(val) })} autoComplete="off" />
                          </div>
                        ) : (
                          <Text as="span" variant="bodyMd" alignment="end">{money(v.price)}</Text>
                        )}
                        <InQuoteCell price={quote.get(v.id)?.price} />
                        {editable ? (
                          <div style={{ width: 72, justifySelf: 'end' }}>
                            <TextField label="Qty" labelHidden type="number" min={1} value={String(editOf(v).qty)} onChange={(val) => setEdit(v.id, { qty: Math.max(1, Number(val) || 1) })} autoComplete="off" />
                          </div>
                        ) : null}
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
          <Text as="span" tone="subdued" variant="bodySm">{`${addCount}/${max} variants selected`}</Text>
        </Box>
      </Modal.Section>
    </Modal>
  );
}
