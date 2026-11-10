import React, { useEffect, useRef, useState } from 'react';
import { money } from '../format.js';
import { Modal } from '../../shared/wc.jsx';
import { ProductPriceTable } from './ProductPriceTable.jsx';
import { StatusDot } from './companyLayout.jsx';

// The one price-preview modal: the company page's "Preview prices" and the pricing
// editor's "Preview all prices". Each entry is a product with its Shopify price,
// what the buyer pays and the layer that decided it; search + sort run here. With
// `renderWhy`, a row (click it) drills into "Why this price" (same modal — Back returns,
// ✕ / Esc close the modal as on the list);
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
  // Decided by, on two lines as the company page's cells: the pricing, then the part of it
  // ("Distributor Tier 2" over "Rule 2"). A product's own price (highlight) has a blue dot.
  const decidedBy = (e) => {
    const [name, ...rest] = String(e.decidedBy || '—').split(' · ');
    return (
      <>
        {e.highlight ? <StatusDot tone="info">{name}</StatusDot> : <span>{name}</span>}
        {rest.length ? <span className="cd-sub">{rest.join(' · ')}</span> : null}
      </>
    );
  };
  const muted = (v) => <span className="cd-muted">{v}</span>;
  const rows = sorted.map((e) => ({
    key: e.product.sku,
    title: e.product.title,
    subtitle: e.product.sku,
    cells: [
      muted(money(e.shopify)),
      decidedBy(e),
      ...(showPriority ? [e.priority == null ? muted('—') : String(e.priority)] : []),
      e.final == null ? muted('—') : <span className="cd-primary">{money(e.final)}</span>,
      e.off > 0 ? `${e.off}% off` : e.off < 0 ? `${-e.off}% over` : muted('—'),
    ],
    onOpen: renderWhy ? () => setWhySku(e.product.sku) : undefined,
  }));

  const back = () => setWhySku(null);

  return (
    <Modal onClose={onClose} heading={whyProduct ? 'Why this price' : title} size={whyProduct ? undefined : 'large'}>
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
              { title: 'Shopify price', align: 'end' },
              { title: 'Decided by' },
              ...(showPriority ? [{ title: 'Priority', align: 'end' }] : []),
              { title: 'Buyer pays', align: 'end' },
              { title: 'Off', align: 'end' },
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
