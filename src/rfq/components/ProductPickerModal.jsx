import React, { useState } from 'react';
import { Modal, Tip, useWcId } from '../../shared/wc.jsx';
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
// Row wrappers (custom grid rows, so native divs carry the borders / fills).
const ROW = { padding: '8px 16px' };
const ROW_BORDER = '1px solid var(--p-color-border)';
const NOWRAP_ROW = { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 };
const END = { textAlign: 'end' };
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, whiteSpace: 'nowrap' }}>
        <s-icon type="alert-triangle" tone="caution" />
        <s-text fontSize="small" tone="caution">Out of stock</s-text>
      </div>
    );
  }
  return (
    <div style={END}>
      <s-text color="subdued">{n.toLocaleString('en-US')}</s-text>
    </div>
  );
}

// "Added" status for a row: a green badge for a line this option added (ticked,
// removable), an info badge for a line another option added (unticked here) that
// flips to an "Override" badge once re-ticked (its price will be replaced on apply).
function AddedBadge({ mine, other, isSel }) {
  if (mine) return <s-badge tone="success">Added</s-badge>;
  if (!other) return null;
  if (isSel) return <s-badge tone="caution">Override</s-badge>;
  return (
    <Tip content={other.sourceLabel ? `On quote · ${other.sourceLabel}` : 'Already on this quote'}>
      <s-badge tone="info">Added</s-badge>
    </Tip>
  );
}

// "In quote" column: the price the variant currently carries on the quote, or an em
// dash when it isn't on the quote yet. `label` (a range) is used for a product header.
function InQuoteCell({ price, label }) {
  const text = label != null ? label : price != null ? money(price) : null;
  return (
    <div style={END}>
      <s-text color={text == null ? 'subdued' : undefined}>{text == null ? '—' : text}</s-text>
    </div>
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
  const id = useWcId('pp-help');
  return (
    <div style={{ justifySelf: 'end' }}>
      <s-text interestFor={id} fontSize="small" color="subdued" fontWeight="medium">
        <span style={{ borderBottom: '1px dotted var(--p-color-border)', cursor: 'help' }}>{label}</span>
      </s-text>
      <s-tooltip id={id}>{content}</s-tooltip>
    </div>
  );
}

// Column header text (bodySm, subdued, medium).
function ColHead({ children, end }) {
  const text = (
    <s-text fontSize="small" color="subdued" fontWeight="medium">
      {children}
    </s-text>
  );
  return end ? <div style={END}>{text}</div> : text;
}

// Title (+ "Added" badge) over a subdued, truncated second line.
function TitleBlock({ title, sub, badge }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <div className="wc-truncate">
          <s-text>{title}</s-text>
        </div>
        {badge}
      </div>
      <s-paragraph color="subdued" fontSize="small" lineClamp={1}>
        {sub}
      </s-paragraph>
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

  // Checkbox handlers SET the state read from the checkbox (idempotent — a web
  // component checkbox can fire change twice for one click), never toggle.
  const setVariant = (vid, on) => {
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(vid);
      else n.delete(vid);
      return n;
    });
  };
  const setProduct = (p, on) => {
    const vids = p.variants.map((v) => v.id).filter((id) => !otherOf(id)); // don't bulk-override other-option lines
    if (!vids.length) return;
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

  // Select-all acts on shown variants, excluding lines added from another option —
  // those are overridden only by a deliberate per-row tick, never in bulk.
  const shownSelectable = shown.flatMap((p) => p.variants.map((v) => v.id)).filter((id) => !otherOf(id));
  const hasOtherOption = shown.some((p) => p.variants.some((v) => otherOf(v.id)));
  const allShownSel = shownSelectable.length > 0 && shownSelectable.every((id) => selected.has(id));
  const someShownSel = shownSelectable.some((id) => selected.has(id));
  const setAllShown = (on) =>
    setSelected((s) => {
      const n = new Set(s);
      shownSelectable.forEach((id) => (on ? n.add(id) : n.delete(id)));
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

  const primaryLabel =
    changeCount === 0
      ? 'Done'
      : [
          addCount ? `Add ${addCount}` : null,
          overrideCount ? `Replace ${overrideCount}` : null,
          removeCount ? `Remove ${removeCount}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
  const secondary = backAction || { content: 'Cancel', onAction: onClose };

  // Editable-mode inputs (price / qty per variant).
  const priceInput = (v) => (
    <div style={{ width: 96, justifySelf: 'end' }}>
      <s-number-field
        label="Price"
        labelAccessibilityVisibility="exclusive"
        min={0}
        prefix="$"
        value={String(editOf(v).price)}
        onInput={(e) => setEdit(v.id, { price: Number(e.currentTarget.value) })}
        autocomplete="off"
      />
    </div>
  );
  const qtyInput = (v) => (
    <div style={{ width: 72, justifySelf: 'end' }}>
      <s-number-field
        label="Qty"
        labelAccessibilityVisibility="exclusive"
        min={1}
        inputMode="numeric"
        value={String(editOf(v).qty)}
        onInput={(e) => setEdit(v.id, { qty: Math.max(1, Number(e.currentTarget.value) || 1) })}
        autocomplete="off"
      />
    </div>
  );

  return (
    <Modal size={size === 'fullScreen' ? 'large-100' : size} onClose={onClose} heading={title} padding="none">
      <s-box padding="base">
        <s-stack gap="small">
          {hasOtherOption ? (
            <s-banner tone="info">
              <s-paragraph>
                Some products below are already on this quote from another option (marked{' '}
                <s-text fontWeight="semibold">Added</s-text>). Re-tick one to replace its price with this{' '}
                {opt.source === 'b2b' ? 'B2B price' : opt.source === 'catalog' ? 'catalog price' : opt.source === 'store' ? 'store price' : 'price'}.
              </s-paragraph>
            </s-banner>
          ) : null}
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
                <s-option key={o.value} value={o.value}>
                  {o.label}
                </s-option>
              ))}
            </s-select>
          </s-grid>
        </s-stack>
      </s-box>
      <div style={{ background: 'var(--p-color-bg-surface-secondary)', borderBlock: ROW_BORDER, padding: '6px 16px' }}>
        <div style={grid}>
          <s-checkbox
            accessibilityLabel="Select all shown products"
            checked={allShownSel}
            indeterminate={!allShownSel && someShownSel}
            onChange={(e) => setAllShown(e.currentTarget.checked)}
          />
          <ColHead>Product</ColHead>
          <ColHead end>Available</ColHead>
          <HeaderHelp
            label={priceHeader}
            content={`The price you’ll add this product at. You can still change it on the quote later.`}
          />
          <HeaderHelp
            label="In quote"
            content={`The product’s current price in this quote. “—” means it hasn’t been added yet. Select an added product to switch it to the ${priceHeader}.`}
          />
          {editable ? <ColHead end>{qtyHeader}</ColHead> : null}
        </div>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
        {shown.map((p, i) => {
          const multi = p.variants.length > 1;
          // Header checkbox reflects only the variants it controls — other-option
          // lines are excluded (they override per-row, not via the header).
          const vids = p.variants.map((v) => v.id).filter((id) => !otherOf(id));
          const allSel = vids.length > 0 && vids.every((id) => selected.has(id));
          const someSel = vids.some((id) => selected.has(id));
          const isExp = expanded.has(p.sku);
          const topBorder = i === 0 ? undefined : ROW_BORDER;

          if (!multi) {
            const v = p.variants[0];
            const mine = !!mineOf(v.id);
            const other = otherOf(v.id);
            const isSel = selected.has(v.id);
            return (
              <div key={p.sku} style={{ ...ROW, borderBlockStart: topBorder }}>
                <div style={grid}>
                  <s-checkbox
                    accessibilityLabel={`Select ${p.title}`}
                    checked={selected.has(v.id)}
                    onChange={(e) => setVariant(v.id, e.currentTarget.checked)}
                  />
                  <div style={NOWRAP_ROW}>
                    <span style={{ width: 20, flex: '0 0 auto' }} />
                    <span style={THUMB}><s-icon type="image" color="subdued" /></span>
                    <TitleBlock title={p.title} sub={p.sku} badge={<AddedBadge mine={mine} other={other} isSel={isSel} />} />
                  </div>
                  <AvailCell n={variantStock(v, p)} />
                  {editable ? priceInput(v) : (
                    <div style={END}>
                      <s-text>{money(v.price)}</s-text>
                    </div>
                  )}
                  <InQuoteCell price={quote.get(v.id)?.price} />
                  {editable ? qtyInput(v) : null}
                </div>
              </div>
            );
          }
          return (
            <div key={p.sku} style={{ borderBlockStart: topBorder }}>
              <div style={ROW}>
                <div style={grid}>
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
                    <div style={NOWRAP_ROW}>
                      <span style={CARET}><s-icon type={isExp ? 'chevron-down' : 'chevron-right'} color="subdued" /></span>
                      <span style={THUMB}><s-icon type="image" color="subdued" /></span>
                      <TitleBlock title={p.title} sub={`${p.variants.length} variants`} />
                    </div>
                  </button>
                  <AvailCell n={productStock(p)} />
                  <div style={END}>
                    <s-text>{priceLabel(p.variants)}</s-text>
                  </div>
                  <InQuoteCell label={inQuoteLabel(p.variants, quote)} />
                  {editable ? <span /> : null}
                </div>
              </div>
              {isExp && p.variants.map((v) => {
                const mine = !!mineOf(v.id);
                const other = otherOf(v.id);
                const isSel = selected.has(v.id);
                return (
                  <div key={v.id} style={{ ...ROW, borderBlockStart: ROW_BORDER, background: 'var(--p-color-bg-surface-secondary)' }}>
                    <div style={grid}>
                      <span style={{ paddingInlineStart: 40, display: 'flex', alignItems: 'center' }}>
                        <s-checkbox
                          accessibilityLabel={`Select ${p.title} — ${v.title}`}
                          checked={selected.has(v.id)}
                          onChange={(e) => setVariant(v.id, e.currentTarget.checked)}
                        />
                      </span>
                      <div style={NOWRAP_ROW}>
                        <span style={{ width: 20, flex: '0 0 auto' }} />
                        <TitleBlock title={v.title} sub={v.id} badge={<AddedBadge mine={mine} other={other} isSel={isSel} />} />
                      </div>
                      <AvailCell n={variantStock(v, p)} />
                      {editable ? priceInput(v) : (
                        <div style={END}>
                          <s-text>{money(v.price)}</s-text>
                        </div>
                      )}
                      <InQuoteCell price={quote.get(v.id)?.price} />
                      {editable ? qtyInput(v) : null}
                    </div>
                  </div>
                );
              })}
            </div>
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
      <div style={{ ...ROW, borderBlockStart: ROW_BORDER }}>
        <s-text color="subdued" fontSize="small">{`${addCount}/${max} variants selected`}</s-text>
      </div>
      <s-button slot="primary-action" variant="primary" disabled={changeCount === 0} onClick={doAdd}>
        {primaryLabel}
      </s-button>
      <s-button slot="secondary-actions" onClick={secondary.onAction}>
        {secondary.content}
      </s-button>
    </Modal>
  );
}
