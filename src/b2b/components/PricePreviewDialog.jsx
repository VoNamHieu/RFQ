import React, { useState } from 'react';
import { Modal, BlockStack, Text, Badge, Button } from '@shopify/polaris';
import { ViewIcon } from '@shopify/polaris-icons';
import { money } from '../format.js';
import { ProductPriceTable } from './ProductPriceTable.jsx';

// The one price-preview modal: the company page's "Preview prices" and the pricing
// editor's "Preview all prices". Each entry is a product with its Shopify price,
// what the buyer pays and the layer that decided it; search + sort run here. With
// `renderWhy`, each row drills into "Why this price" (same modal — Back returns);
// `toolbar` adds controls next to sort (e.g. the Location picker). Entries that
// carry a `priority` (the deciding pricing's) get a Priority column.
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
  const whyProduct = whySku ? entries.find((e) => e.product.sku === whySku)?.product || null : null;

  const withOff = entries.map((e) => ({ ...e, off: e.shopify > 0 ? Math.round((1 - e.final / e.shopify) * 100) : 0 }));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? withOff.filter((e) => e.product.title.toLowerCase().includes(q) || e.product.sku.toLowerCase().includes(q))
    : withOff;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.product.title.localeCompare(a.product.title);
      case 'shopify-asc': return a.shopify - b.shopify;
      case 'shopify-desc': return b.shopify - a.shopify;
      case 'final-asc': return a.final - b.final;
      case 'final-desc': return b.final - a.final;
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
      <Text as="span" tone="subdued">{money(e.shopify)}</Text>,
      <Badge tone={e.highlight ? 'info' : undefined}>{e.decidedBy}</Badge>,
      ...(showPriority ? [<Text as="span" tone={e.priority == null ? 'subdued' : undefined}>{e.priority == null ? '—' : e.priority}</Text>] : []),
      <Text as="span" fontWeight="semibold">{money(e.final)}</Text>,
      <Text as="span">{e.off > 0 ? `${e.off}% off` : e.off < 0 ? `${-e.off}% over` : '—'}</Text>,
    ],
    action: renderWhy ? (
      <Button icon={ViewIcon} variant="tertiary" accessibilityLabel="Why this price" onClick={() => setWhySku(e.product.sku)} />
    ) : undefined,
  }));

  return (
    <Modal
      open
      onClose={whyProduct ? () => setWhySku(null) : onClose}
      title={whyProduct ? 'Why this price' : title}
      size={whyProduct ? undefined : 'large'}
      secondaryActions={[whyProduct ? { content: 'Back', onAction: () => setWhySku(null) } : { content: 'Close', onAction: onClose }]}
    >
      <Modal.Section>
        {whyProduct ? (
          renderWhy(whyProduct)
        ) : (
          <BlockStack gap="300">
            {description ? <Text as="p" tone="subdued" variant="bodySm">{description}</Text> : null}
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
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}
