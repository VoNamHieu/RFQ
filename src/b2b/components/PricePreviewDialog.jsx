import React, { useEffect, useRef, useState } from 'react';
import { money } from '../format.js';
import { Modal } from '../../shared/wc.jsx';
import { ProductPriceTable } from './ProductPriceTable.jsx';

// The one price-preview modal: the company page's "Preview prices" and the pricing
// editor's "Preview all prices". Each entry is a product with its Shopify price,
// what the buyer pays and the layer that decided it; search + sort run here. With
// `renderWhy`, each row drills into "Why this price" (same modal — Back returns);
// `toolbar` adds controls next to sort (e.g. the Location picker). Entries that
// carry a `priority` (the deciding pricing's) get a Priority column. A `final` of
// null means the buyer can't get the product there (e.g. it's outside their
// catalog): Buyer pays shows "—" and it sorts last.
const PREVIEW_SORTS = [
  { label: 'Product A–Z', value: 'title-asc' },
  { label: 'Product Z–A', value: 'title-desc' },
  { label: 'Shopify price: low to high', value: 'shopify-asc' },
  { label: 'Shopify price: high to low', value: 'shopify-desc' },
  { label: 'Buyer pays: low to high', value: 'final-asc' },
  { label: 'Buyer pays: high to low', value: 'final-desc' },
  { label: 'Biggest discount', value: 'off-desc' },
];

export function PricePreviewDialog({ title, description, entries, emptyLabel, toolbar = null, renderWhy = null, onClose }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('title-asc');
  const [whySku, setWhySku] = useState(null);
  // Dismissing (X / Esc) while on "Why this price" goes back to the list: the
  // modal has already hidden itself, so remount it to show the list again.
  const [mountKey, setMountKey] = useState(0);
  // Opening "Why this price" removes the row button that had focus; move focus to
  // Back so the modal keeps it (and Escape still reaches the modal).
  const backRef = useRef(null);
  useEffect(() => {
    if (whySku) backRef.current?.focus?.();
  }, [whySku]);
  const whyProduct = whySku ? entries.find((e) => e.product.sku === whySku)?.product || null : null;

  const withOff = entries.map((e) => ({ ...e, off: e.final != null && e.shopify > 0 ? Math.round((1 - e.final / e.shopify) * 100) : 0 }));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? withOff.filter((e) => e.product.title.toLowerCase().includes(q) || e.product.sku.toLowerCase().includes(q))
    : withOff;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.product.title.localeCompare(a.product.title);
      case 'shopify-asc': return a.shopify - b.shopify;
      case 'shopify-desc': return b.shopify - a.shopify;
      case 'final-asc': return (a.final ?? Infinity) - (b.final ?? Infinity);
      case 'final-desc': return (b.final ?? -Infinity) - (a.final ?? -Infinity);
      case 'off-desc': return b.off - a.off;
      default: return a.product.title.localeCompare(b.product.title);
    }
  });

  const showPriority = entries.some((e) => e.priority !== undefined);
  const rows = sorted.map((e) => ({
    key: e.product.sku,
    title: e.product.title,
    subtitle: e.product.sku,
    cells: [
      <s-text color="subdued">{money(e.shopify)}</s-text>,
      <s-badge tone={e.highlight ? 'info' : undefined}>{e.decidedBy}</s-badge>,
      ...(showPriority ? [<s-text color={e.priority == null ? 'subdued' : undefined}>{e.priority == null ? '—' : e.priority}</s-text>] : []),
      e.final == null ? <s-text color="subdued">—</s-text> : <s-text fontWeight="semibold">{money(e.final)}</s-text>,
      <s-text>{e.off > 0 ? `${e.off}% off` : e.off < 0 ? `${-e.off}% over` : '—'}</s-text>,
    ],
    action: renderWhy ? (
      <s-button icon="view" variant="tertiary" accessibilityLabel="Why this price" onClick={() => setWhySku(e.product.sku)} />
    ) : undefined,
  }));

  const back = () => setWhySku(null);

  return (
    <Modal
      key={mountKey}
      onClose={
        whyProduct
          ? () => {
              back();
              setMountKey((k) => k + 1);
            }
          : onClose
      }
      heading={whyProduct ? 'Why this price' : title}
      size={whyProduct ? undefined : 'large'}
    >
      {whyProduct ? (
        renderWhy(whyProduct)
      ) : (
        <s-stack gap="small">
          {description ? (
            <s-paragraph color="subdued" fontSize="small">
              {description}
            </s-paragraph>
          ) : null}
          <ProductPriceTable
            search={query}
            onSearch={setQuery}
            sort={sort}
            onSort={setSort}
            sortOptions={PREVIEW_SORTS}
            toolbar={toolbar}
            columns={[
              { title: 'Shopify price', width: '96px', align: 'end' },
              { title: 'Decided by', width: '160px', align: 'start' },
              ...(showPriority ? [{ title: 'Priority', width: '64px', align: 'end' }] : []),
              { title: 'Buyer pays', width: '96px', align: 'end' },
              { title: 'Off', width: '72px', align: 'end' },
            ]}
            rows={rows}
            emptyLabel={entries.length === 0 ? emptyLabel : `No products match “${query.trim()}”.`}
          />
        </s-stack>
      )}

      {whyProduct ? (
        <s-button ref={backRef} slot="secondary-actions" onClick={back}>
          Back
        </s-button>
      ) : (
        <s-button slot="secondary-actions" onClick={onClose}>
          Close
        </s-button>
      )}
    </Modal>
  );
}
